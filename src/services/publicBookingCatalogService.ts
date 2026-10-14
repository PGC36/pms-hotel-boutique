import type { Currency } from '@/shared/types/common';
import { toDomain as toRate, type Rate, type RateDto } from '@/shared/types/entities/rate';
import {
  toDomain as toRoomFeature,
  type RoomFeature,
  type RoomFeatureDto,
} from '@/shared/types/entities/room-feature';
import {
  toDomain as toAmenity,
  type Amenity,
  type AmenityDto,
} from '@/shared/types/entities/amenity';
import {
  toDomain as toRoomType,
  type RoomType,
  type RoomTypeDto,
} from '@/shared/types/entities/room-type';
import { HttpError, httpClient } from './http-client';
import { toMediaImageDtos, type ApiMediaImage } from './mediaService';
import { normalizeAmenityTime } from '@/shared/utils/amenitySchedule';
import { mockUtils, simulateLatency } from './mockUtils';

type ApiRoomType = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  capacity: number;
  bedConfiguration: string;
  roomFeatureIds?: string[];
  roomFeatures?: ApiRoomFeature[];
  features?: ApiRoomFeature[];
  active?: boolean;
  images?: ApiMediaImage[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiRoomFeature = {
  id: string;
  name?: string | null;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiRate = {
  id: string;
  roomTypeId?: string;
  roomType?: { id: string };
  name: string;
  validFrom: string;
  /** null = tarifa sin fecha de fin (el backend lo permite). */
  validTo?: string | null;
  priceCents: number;
  currency?: RateDto['currency'];
  minimumNights?: number;
  refundable?: boolean;
  active?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type PublicAvailabilityResult = {
  roomTypeId: string;
  code: string;
  name: string;
  capacity: number;
  bedConfiguration: string;
  availableRooms: number;
  rate: ApiRate;
  totalAmountCents: number;
  currency: string;
};

type PublicAvailabilityResponse = {
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  results: PublicAvailabilityResult[];
};

/** Amenidad activa de `GET /public/amenities`: sin `active` ni timestamps internos. */
type ApiPublicAmenity = {
  id: string;
  name: string;
  description?: string | null;
  category: AmenityDto['category'];
  location?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  images?: ApiMediaImage[];
};

export type PublicAvailableRoomType = {
  roomType: RoomType;
  availableRooms: number;
  rate: Rate;
  totalAmountCents: number;
};

export type PublicRoomTypeCatalog = {
  roomTypes: RoomType[];
  features: RoomFeature[];
};

export type PublicBookingRequest = {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  notes?: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    nationality?: string;
    documentType?: 'national_id' | 'passport' | 'driver_license';
    documentNumber?: string;
  };
};

export type PublicBookingConfirmation = {
  confirmationCode: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  roomTypeId: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  rateName: string;
  totalAmountCents: number;
  currency: Currency;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  createdAt: string;
};

const nowIso = () => new Date().toISOString();

/**
 * El contrato compartido de Rate exige validTo, pero el backend devuelve null
 * para una tarifa sin fecha de fin. Solo aquí se traduce ese null a una fecha
 * abierta para que el mapper compartido no falle; no es una fecha de negocio y
 * ninguna pantalla debe mostrarla (usar isOpenEndedRate). El mismo defecto del
 * contrato compartido y de roomService queda pendiente de un issue aparte.
 */
const OPEN_ENDED_VALID_TO = '9999-12-31';

export function isOpenEndedRate(rate: Rate): boolean {
  return rate.validTo.getFullYear() === 9999;
}

function requiredId(id: string | undefined | null, label: string): string {
  if (!id) throw new Error(`La respuesta del backend no incluye ${label}.`);
  return id;
}

function toRoomTypeDto(api: ApiRoomType): RoomTypeDto {
  const timestamp = api.updatedAt ?? api.createdAt ?? nowIso();
  return {
    id: api.id,
    code: api.code,
    name: api.name,
    description: api.description ?? undefined,
    capacity: api.capacity,
    bed_configuration: api.bedConfiguration,
    room_feature_ids:
      api.roomFeatureIds ??
      api.roomFeatures?.map((feature) => feature.id) ??
      api.features?.map((feature) => feature.id) ??
      [],
    active: api.active ?? true,
    images: toMediaImageDtos(api.images),
    created_at: api.createdAt ?? timestamp,
    updated_at: timestamp,
  };
}

function toRoomFeatureDto(api: ApiRoomFeature): RoomFeatureDto {
  const timestamp = api.updatedAt ?? api.createdAt ?? nowIso();
  return {
    id: api.id,
    name: api.name ?? api.id,
    description: api.description ?? undefined,
    created_at: api.createdAt ?? timestamp,
    updated_at: timestamp,
  };
}

function toRateDto(api: ApiRate): RateDto {
  const timestamp = api.updatedAt ?? api.createdAt ?? nowIso();
  return {
    id: api.id,
    room_type_id: requiredId(api.roomTypeId ?? api.roomType?.id, 'roomTypeId'),
    name: api.name,
    valid_from: api.validFrom,
    valid_to: api.validTo ?? OPEN_ENDED_VALID_TO,
    price_cents: api.priceCents,
    currency: api.currency ?? 'GTQ',
    minimum_nights: api.minimumNights ?? 1,
    refundable: api.refundable ?? true,
    active: api.active ?? true,
    created_at: api.createdAt ?? timestamp,
    updated_at: timestamp,
  };
}

export type PublicBookingErrorKind =
  | 'invalid_request'
  | 'service_unavailable'
  | 'not_found'
  | 'no_availability'
  | 'guest_conflict'
  | 'conflict';

/**
 * Error de la web pública con un mensaje en español ya controlado. Nunca lleva
 * el texto interno del backend; `kind` permite a la pantalla reaccionar (por
 * ejemplo, volver a consultar disponibilidad tras un 409).
 */
export class PublicBookingError extends Error {
  constructor(
    public readonly kind: PublicBookingErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'PublicBookingError';
  }
}

type PublicOperation = 'catalog' | 'availability' | 'booking';

const SERVICE_UNAVAILABLE_MESSAGE =
  'El servicio de reservas no está disponible en este momento. Intenta nuevamente más tarde.';

const INVALID_REQUEST_MESSAGES: Record<PublicOperation, string> = {
  catalog: 'No fue posible cargar la información de habitaciones.',
  availability: 'Revisa las fechas y la cantidad de huéspedes.',
  booking: 'Revisa los datos de la reserva.',
};

// Mensajes fijos del contrato público del backend (#62). Solo se usan para
// elegir un texto en español; el texto original nunca llega a la pantalla.
const BACKEND_NO_AVAILABILITY = 'No availability for the requested room type and dates';
const BACKEND_GUEST_CONFLICT_PREFIX = 'Guest details conflict';
const BACKEND_BAD_REQUEST_MESSAGES: Array<[match: string, message: string]> = [
  ['Check-in date cannot be in the past', 'La fecha de entrada no puede ser anterior a hoy.'],
  ['Stay cannot exceed', 'La estadía no puede superar 30 noches.'],
  [
    'Check-in date must be before check-out date',
    'La fecha de salida debe ser posterior a la de entrada.',
  ],
  [
    'Guest count exceeds room type capacity',
    'La cantidad de huéspedes supera la capacidad de la habitación.',
  ],
  ['No rate available for the requested stay', 'No hay una tarifa disponible para esas fechas.'],
  [
    'Stay does not meet the rate minimum nights',
    'La estadía no cumple el mínimo de noches de la tarifa.',
  ],
  ['Room type not available', 'El tipo de habitación seleccionado no está disponible.'],
];

function backendMessage(error: HttpError): string {
  const data = error.data as { message?: unknown } | undefined;
  return data && typeof data.message === 'string' ? data.message : '';
}

function hasGuestFieldErrors(error: HttpError): boolean {
  const data = error.data as { errors?: unknown } | undefined;
  return (
    !!data?.errors &&
    typeof data.errors === 'object' &&
    Object.keys(data.errors).some((field) => field === 'guest' || field.startsWith('guest.'))
  );
}

export function toPublicBookingError(
  error: unknown,
  operation: PublicOperation,
): PublicBookingError {
  if (error instanceof PublicBookingError) return error;
  if (!(error instanceof HttpError)) {
    // Error de red (fetch rechazado) u otra falla sin respuesta HTTP.
    return new PublicBookingError('service_unavailable', SERVICE_UNAVAILABLE_MESSAGE);
  }

  const message = backendMessage(error);
  switch (error.status) {
    case 400: {
      const known = BACKEND_BAD_REQUEST_MESSAGES.find(([match]) => message.startsWith(match));
      if (known) return new PublicBookingError('invalid_request', known[1], 400);
      if (hasGuestFieldErrors(error)) {
        return new PublicBookingError('invalid_request', 'Revisa los datos del huésped.', 400);
      }
      return new PublicBookingError('invalid_request', INVALID_REQUEST_MESSAGES[operation], 400);
    }
    case 401:
    case 403:
      return new PublicBookingError(
        'service_unavailable',
        SERVICE_UNAVAILABLE_MESSAGE,
        error.status,
      );
    case 404:
      return new PublicBookingError(
        'not_found',
        'El servicio público de reservas no está disponible.',
        404,
      );
    case 409:
      if (message === BACKEND_NO_AVAILABILITY) {
        return new PublicBookingError(
          'no_availability',
          'Ya no hay habitaciones disponibles para esas fechas. Elige otras fechas u otro tipo de habitación.',
          409,
        );
      }
      if (message.startsWith(BACKEND_GUEST_CONFLICT_PREFIX)) {
        return new PublicBookingError(
          'guest_conflict',
          'No pudimos registrar la reserva con esos datos de huésped. Contacta al hotel para completarla.',
          409,
        );
      }
      return new PublicBookingError(
        'conflict',
        'No fue posible completar la reserva. Intenta nuevamente.',
        409,
      );
    default:
      return new PublicBookingError(
        'service_unavailable',
        SERVICE_UNAVAILABLE_MESSAGE,
        error.status,
      );
  }
}

async function publicRequest<T>(call: () => Promise<T>, operation: PublicOperation): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw toPublicBookingError(error, operation);
  }
}

async function fetchPublicRoomTypes(): Promise<ApiRoomType[]> {
  return publicRequest(
    () =>
      httpClient.get<ApiRoomType[]>('/public/room-types', {
        auth: { skipAuthorization: true, skipRefresh: true },
      }),
    'catalog',
  );
}

function buildRoomTypeCatalog(roomTypes: ApiRoomType[]): PublicRoomTypeCatalog {
  const featuresById = new Map<string, RoomFeature>();

  roomTypes.forEach((roomType) => {
    (roomType.features ?? roomType.roomFeatures ?? []).forEach((feature) => {
      featuresById.set(feature.id, toRoomFeature(toRoomFeatureDto(feature)));
    });
  });

  return {
    roomTypes: roomTypes.map(toRoomTypeDto).map(toRoomType),
    features: [...featuresById.values()],
  };
}

/**
 * El endpoint público solo devuelve amenidades activas y omite timestamps:
 * se completan para cumplir el contrato compartido, sin valor de negocio.
 */
function toPublicAmenityDto(api: ApiPublicAmenity): AmenityDto {
  const timestamp = nowIso();
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? undefined,
    category: api.category,
    location: api.location ?? undefined,
    opens_at: normalizeAmenityTime(api.opensAt),
    closes_at: normalizeAmenityTime(api.closesAt),
    active: true,
    images: toMediaImageDtos(api.images),
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function buildRoomTypeFromAvailability(result: PublicAvailabilityResult): RoomType {
  return toRoomType(
    toRoomTypeDto({
      id: result.roomTypeId,
      code: result.code,
      name: result.name,
      capacity: result.capacity,
      bedConfiguration: result.bedConfiguration,
      active: true,
    }),
  );
}

/**
 * Arma el body campo por campo: tarifa, habitación, estado, importes e ids de
 * huésped los decide el backend y nunca salen del navegador.
 */
function toBookingBody(data: PublicBookingRequest): PublicBookingRequest {
  return {
    roomTypeId: data.roomTypeId,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    adults: data.adults,
    children: data.children,
    notes: data.notes,
    guest: {
      firstName: data.guest.firstName,
      lastName: data.guest.lastName,
      email: data.guest.email,
      phone: data.guest.phone,
      nationality: data.guest.nationality,
      documentType: data.guest.documentType,
      documentNumber: data.guest.documentNumber,
    },
  };
}

export const publicBookingCatalogService = {
  async getRoomTypes(): Promise<RoomType[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar los tipos de habitacion.');
    const roomTypes = await fetchPublicRoomTypes();
    return roomTypes.map(toRoomTypeDto).map(toRoomType);
  },
  async getRoomTypeCatalog(): Promise<PublicRoomTypeCatalog> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar los tipos de habitacion.');
    return buildRoomTypeCatalog(await fetchPublicRoomTypes());
  },
  /** Amenidades activas del hotel con sus imágenes, sin sesión. */
  async getAmenities(): Promise<Amenity[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar las amenidades.');
    const amenities = await publicRequest(
      () =>
        httpClient.get<ApiPublicAmenity[]>('/public/amenities', {
          auth: { skipAuthorization: true, skipRefresh: true },
        }),
      'catalog',
    );
    return amenities.map(toPublicAmenityDto).map(toAmenity);
  },
  async getRates(): Promise<Rate[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar las tarifas.');
    const rates = await publicRequest(
      () =>
        httpClient.get<ApiRate[]>('/public/rates', {
          auth: { skipAuthorization: true, skipRefresh: true },
        }),
      'catalog',
    );
    return rates.map(toRateDto).map(toRate);
  },
  async getAvailability(filters: {
    checkIn: string;
    checkOut: string;
    adults: number;
    children?: number;
    roomTypeId?: string;
  }): Promise<PublicAvailableRoomType[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible buscar disponibilidad.');
    const query = new URLSearchParams({
      checkIn: filters.checkIn,
      checkOut: filters.checkOut,
      adults: String(filters.adults),
      children: String(filters.children ?? 0),
    });
    if (filters.roomTypeId) query.set('roomTypeId', filters.roomTypeId);
    const response = await publicRequest(
      () =>
        httpClient.get<PublicAvailabilityResponse>(`/public/availability?${query.toString()}`, {
          auth: { skipAuthorization: true, skipRefresh: true },
        }),
      'availability',
    );
    return response.results.map((result) => ({
      roomType: buildRoomTypeFromAvailability(result),
      availableRooms: result.availableRooms,
      rate: toRate(toRateDto(result.rate)),
      totalAmountCents: result.totalAmountCents,
    }));
  },
  async createBooking(data: PublicBookingRequest): Promise<PublicBookingConfirmation> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible crear la reserva.');
    return publicRequest(
      () =>
        httpClient.post<PublicBookingConfirmation>('/public/bookings', toBookingBody(data), {
          auth: { skipAuthorization: true, skipRefresh: true },
        }),
      'booking',
    );
  },
};
