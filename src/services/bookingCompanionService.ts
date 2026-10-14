import {
  toDomain as toBookingCompanion,
  type BookingCompanion,
  type BookingCompanionDto,
  type UpsertBookingCompanionDto,
} from '@/shared/types/entities/booking-companion';
import type { ID } from '@/shared/types/common';
import { HttpError, httpClient } from './http-client';
import { mockUtils, simulateLatency } from './mockUtils';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ApiBookingCompanion = {
  id: string;
  bookingId?: string;
  booking?: { id: string };
  firstName: string;
  lastName: string;
  documentType: BookingCompanionDto['document_type'];
  documentNumber: string;
  guestType: BookingCompanionDto['guest_type'];
  createdAt?: string | null;
  updatedAt?: string | null;
};

function isUuid(value: ID): boolean {
  return UUID_PATTERN.test(value);
}

function assertBackendId(id: ID, operation: string): void {
  if (!isUuid(id)) {
    throw new Error(`${operation} requiere una reserva integrada con backend real.`);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function toCompanionDto(api: ApiBookingCompanion, bookingId: ID): BookingCompanionDto {
  const timestamp = api.updatedAt ?? api.createdAt ?? nowIso();
  return {
    id: api.id,
    booking_id: api.bookingId ?? api.booking?.id ?? bookingId,
    first_name: api.firstName,
    last_name: api.lastName,
    document_type: api.documentType,
    document_number: api.documentNumber,
    guest_type: api.guestType,
    created_at: api.createdAt ?? timestamp,
    updated_at: timestamp,
  };
}

function toCompanionRequest(companion: UpsertBookingCompanionDto) {
  return {
    firstName: companion.first_name.trim(),
    lastName: companion.last_name.trim(),
    documentType: companion.document_type,
    documentNumber: companion.document_number.trim(),
    guestType: companion.guest_type,
  };
}

function getHttpErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpError)) return error instanceof Error ? error.message : fallback;
  const data = error.data;
  if (data && typeof data === 'object') {
    const value = data as { message?: unknown; error?: unknown; detail?: unknown };
    if (typeof value.message === 'string' && value.message.trim()) return value.message;
    if (typeof value.error === 'string' && value.error.trim()) return value.error;
    if (typeof value.detail === 'string' && value.detail.trim()) return value.detail;
  }
  if (error.status === 401) return 'Tu sesion expiro. Inicia sesion nuevamente.';
  if (error.status === 403) return 'No tienes permisos para operar acompanantes.';
  if (error.status === 404) return `${fallback} La reserva o acompanantes ya no existen.`;
  if (error.status === 409) return `${fallback} El backend reporto un conflicto.`;
  return fallback;
}

async function request<T>(call: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new Error(getHttpErrorMessage(error, fallback));
  }
}

async function getBackendCompanions(bookingId: ID): Promise<ApiBookingCompanion[]> {
  return request(
    () => httpClient.get<ApiBookingCompanion[]>(`/bookings/${bookingId}/companions`),
    'No fue posible cargar los acompanantes.',
  );
}

function normalizeCompanion(data: UpsertBookingCompanionDto): UpsertBookingCompanionDto {
  return {
    ...data,
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    document_number: data.document_number.trim(),
  };
}

function assertCompanionFields(companions: UpsertBookingCompanionDto[]) {
  companions.forEach((companion, index) => {
    const label = `Acompanante ${index + 1}`;
    if (!companion.first_name) throw new Error(`${label}: ingresa el nombre.`);
    if (!companion.last_name) throw new Error(`${label}: ingresa el apellido.`);
    if (!companion.document_type) throw new Error(`${label}: selecciona el tipo de documento.`);
    if (!companion.document_number) throw new Error(`${label}: ingresa el numero de documento.`);
    if (companion.guest_type !== 'adult' && companion.guest_type !== 'child') {
      throw new Error(`${label}: selecciona si es adulto o menor.`);
    }
  });
}

export const bookingCompanionService = {
  async getCompanionsByBookingId(bookingId: ID): Promise<BookingCompanion[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar los acompanantes.');
    assertBackendId(bookingId, 'La consulta de acompanantes');

    const companions = await getBackendCompanions(bookingId);
    return companions.map((item) => toCompanionDto(item, bookingId)).map(toBookingCompanion);
  },

  async saveCompanionsForBooking(
    bookingId: ID,
    data: UpsertBookingCompanionDto[],
  ): Promise<BookingCompanion[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible guardar los acompanantes.');
    assertBackendId(bookingId, 'La sincronizacion de acompanantes');

    const companions = data.map(normalizeCompanion);
    assertCompanionFields(companions);

    const existing = await getBackendCompanions(bookingId);
    const nextIds = new Set(companions.map((item) => item.id).filter(Boolean));

    for (const companion of existing.filter((item) => !nextIds.has(item.id))) {
      await request(
        () => httpClient.delete<void>(`/bookings/${bookingId}/companions/${companion.id}`),
        'No fue posible eliminar un acompanante.',
      );
    }

    for (const companion of companions.filter((item) => item.id)) {
      await request(
        () =>
          httpClient.put<ApiBookingCompanion>(
            `/bookings/${bookingId}/companions/${companion.id}`,
            toCompanionRequest(companion),
          ),
        'No fue posible actualizar un acompanante.',
      );
    }

    for (const companion of companions.filter((item) => !item.id)) {
      await request(
        () =>
          httpClient.post<ApiBookingCompanion>(
            `/bookings/${bookingId}/companions`,
            toCompanionRequest(companion),
          ),
        'No fue posible crear un acompanante.',
      );
    }

    const saved = await getBackendCompanions(bookingId);
    return saved.map((item) => toCompanionDto(item, bookingId)).map(toBookingCompanion);
  },
};

export default bookingCompanionService;
