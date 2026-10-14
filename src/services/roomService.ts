import {
  toDomain as toRoom,
  type CreateRoomDto,
  type Room,
  type RoomDto,
  type UpdateRoomDto,
} from '@/shared/types/entities/room';
import { toDomain as toRate, type Rate, type RateDto } from '@/shared/types/entities/rate';
import {
  toDomain as toRoomFeature,
  type RoomFeature,
  type RoomFeatureDto,
} from '@/shared/types/entities/room-feature';
import {
  toDomain as toRoomType,
  type CreateRoomTypeDto,
  type RoomType,
  type RoomTypeDto,
  type UpdateRoomTypeDto,
} from '@/shared/types/entities/room-type';
import type { ID } from '@/shared/types/common';
import { mockUtils, simulateLatency } from './mockUtils';
import { HttpError, httpClient } from './http-client';
import {
  describeImageAssignmentError,
  toImagesRequest,
  toMediaImageDtos,
  type ApiMediaImage,
} from './mediaService';

type SaveRateDto = {
  room_type_id: ID;
  name: string;
  valid_from: string;
  valid_to: string;
  price_cents: number;
  currency?: RateDto['currency'];
  minimum_nights?: number;
  refundable?: boolean;
  active?: boolean;
};

type ApiRoom = {
  id: string;
  roomNumber: string;
  roomTypeId?: string;
  roomType?: { id: string };
  floor: number;
  status: RoomDto['status'] | Room['status'];
  housekeepingStatus: RoomDto['housekeeping_status'];
  notes?: string | null;
  cleaningUserEmail?: string | null;
  cleaningStartedAt?: string | null;
  cleaningCompletedByUserEmail?: string | null;
  cleaningCompletedAt?: string | null;
  inspectorUserEmail?: string | null;
  inspectedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiRoomType = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  capacity: number;
  bedConfiguration: string;
  roomFeatureIds?: string[];
  roomFeatures?: { id: string }[];
  active: boolean;
  images?: ApiMediaImage[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiRoomFeature = {
  id: string;
  name: string;
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
  validTo: string;
  priceCents: number;
  currency?: RateDto['currency'];
  minimumNights?: number;
  refundable?: boolean;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const nowIso = () => new Date().toISOString();
const isHttpNotFound = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 404;

function normalizeRoomStatus(status: ApiRoom['status']): RoomDto['status'] {
  return status === 'outOfService' ? 'out_of_service' : status;
}

function requireRelatedId(id: string | undefined, label: string): string {
  if (!id) throw new Error(`La respuesta del backend no incluye ${label}.`);
  return id;
}

function toRoomDto(api: ApiRoom): RoomDto {
  const timestamp = api.updatedAt ?? api.createdAt ?? nowIso();
  return {
    id: api.id,
    room_number: api.roomNumber,
    room_type_id: requireRelatedId(api.roomTypeId ?? api.roomType?.id, 'roomTypeId'),
    floor: api.floor,
    status: normalizeRoomStatus(api.status),
    housekeeping_status: api.housekeepingStatus,
    notes: api.notes ?? undefined,
    cleaning_user_email: api.cleaningUserEmail ?? undefined,
    cleaning_started_at: api.cleaningStartedAt ?? undefined,
    cleaning_completed_by_user_email: api.cleaningCompletedByUserEmail ?? undefined,
    cleaning_completed_at: api.cleaningCompletedAt ?? undefined,
    inspector_user_email: api.inspectorUserEmail ?? undefined,
    inspected_at: api.inspectedAt ?? undefined,
    created_at: api.createdAt ?? timestamp,
    updated_at: timestamp,
  };
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
    room_feature_ids: api.roomFeatureIds ?? api.roomFeatures?.map((feature) => feature.id) ?? [],
    active: api.active,
    images: toMediaImageDtos(api.images),
    created_at: api.createdAt ?? timestamp,
    updated_at: timestamp,
  };
}

function toRoomFeatureDto(api: ApiRoomFeature): RoomFeatureDto {
  const timestamp = api.updatedAt ?? api.createdAt ?? nowIso();
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? undefined,
    created_at: api.createdAt ?? timestamp,
    updated_at: timestamp,
  };
}

function toRateDto(api: ApiRate): RateDto {
  const timestamp = api.updatedAt ?? api.createdAt ?? nowIso();
  return {
    id: api.id,
    room_type_id: requireRelatedId(api.roomTypeId ?? api.roomType?.id, 'roomTypeId'),
    name: api.name,
    valid_from: api.validFrom,
    valid_to: api.validTo,
    price_cents: api.priceCents,
    currency: api.currency ?? 'GTQ',
    minimum_nights: api.minimumNights ?? 1,
    refundable: api.refundable ?? true,
    active: api.active,
    created_at: api.createdAt ?? timestamp,
    updated_at: timestamp,
  };
}

function toRoomRequest(data: CreateRoomDto | UpdateRoomDto) {
  return {
    roomNumber: data.room_number?.trim(),
    roomTypeId: data.room_type_id,
    floor: data.floor,
    status: data.status,
    housekeepingStatus: data.housekeeping_status,
    notes: data.notes?.trim() || undefined,
  };
}

function toRoomTypeRequest(data: CreateRoomTypeDto | UpdateRoomTypeDto) {
  return {
    code: data.code?.trim().toUpperCase(),
    name: data.name?.trim(),
    description: data.description?.trim() || undefined,
    capacity: data.capacity,
    bedConfiguration: data.bed_configuration?.trim(),
    roomFeatureIds: data.room_feature_ids,
    active: data.active,
    images: toImagesRequest(data.images),
  };
}

function toRateRequest(data: SaveRateDto | Partial<SaveRateDto>) {
  return {
    roomTypeId: data.room_type_id,
    name: data.name?.trim(),
    validFrom: data.valid_from,
    validTo: data.valid_to,
    priceCents: data.price_cents,
    currency: data.currency,
    minimumNights: data.minimum_nights,
    refundable: data.refundable,
    active: data.active,
  };
}

function getHttpErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpError)) return error instanceof Error ? error.message : fallback;
  const imageMessage = describeImageAssignmentError(error);
  if (imageMessage) return imageMessage;
  if (error.status === 400) return `${fallback} Revisa los datos enviados.`;
  if (error.status === 401) return 'Tu sesion expiro. Inicia sesion nuevamente.';
  if (error.status === 403) return 'No tienes permisos para operar habitaciones, tipos o tarifas.';
  if (error.status === 404) return `${fallback} El recurso ya no existe.`;
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

export const roomService = {
  async getRoomFeatures(): Promise<RoomFeature[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar las caracteristicas.');
    const features = await request(
      () => httpClient.get<ApiRoomFeature[]>('/room-features'),
      'No fue posible cargar las caracteristicas.',
    );
    return features.map(toRoomFeatureDto).map(toRoomFeature);
  },
  async getRates(): Promise<Rate[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar las tarifas.');
    const rates = await request(
      () => httpClient.get<ApiRate[]>('/rates'),
      'No fue posible cargar las tarifas.',
    );
    return rates.map(toRateDto).map(toRate);
  },
  async createRate(data: SaveRateDto): Promise<Rate> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible crear la tarifa.');
    const rate = await request(
      () => httpClient.post<ApiRate>('/rates', toRateRequest(data)),
      'No fue posible crear la tarifa.',
    );
    return toRate(toRateDto(rate));
  },
  async updateRate(id: ID, data: Partial<SaveRateDto>): Promise<Rate> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible actualizar la tarifa.');
    const rate = await request(
      () => httpClient.put<ApiRate>(`/rates/${id}`, toRateRequest(data)),
      'No fue posible actualizar la tarifa.',
    );
    return toRate(toRateDto(rate));
  },
  async getRooms(): Promise<Room[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar las habitaciones.');
    const rooms = await request(
      () => httpClient.get<ApiRoom[]>('/rooms'),
      'No fue posible cargar las habitaciones.',
    );
    return rooms.map(toRoomDto).map(toRoom);
  },
  async getRoomById(id: ID): Promise<Room | undefined> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar la habitacion.');
    try {
      const room = await httpClient.get<ApiRoom>(`/rooms/${id}`);
      return toRoom(toRoomDto(room));
    } catch (error) {
      if (isHttpNotFound(error)) return undefined;
      throw new Error(getHttpErrorMessage(error, 'No fue posible cargar la habitacion.'));
    }
  },
  async createRoom(data: CreateRoomDto): Promise<Room> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible crear la habitacion.');
    const room = await request(
      () => httpClient.post<ApiRoom>('/rooms', toRoomRequest(data)),
      'No fue posible crear la habitacion.',
    );
    return toRoom(toRoomDto(room));
  },
  async updateRoom(id: ID, data: UpdateRoomDto): Promise<Room> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible actualizar la habitacion.');
    const room = await request(
      () => httpClient.put<ApiRoom>(`/rooms/${id}`, toRoomRequest(data)),
      'No fue posible actualizar la habitacion.',
    );
    return toRoom(toRoomDto(room));
  },
  async getRoomTypes(): Promise<RoomType[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar los tipos de habitacion.');
    const roomTypes = await request(
      () => httpClient.get<ApiRoomType[]>('/room-types'),
      'No fue posible cargar los tipos de habitacion.',
    );
    return roomTypes.map(toRoomTypeDto).map(toRoomType);
  },
  async getRoomTypeById(id: ID): Promise<RoomType | undefined> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar el tipo de habitacion.');
    try {
      const roomType = await httpClient.get<ApiRoomType>(`/room-types/${id}`);
      return toRoomType(toRoomTypeDto(roomType));
    } catch (error) {
      if (isHttpNotFound(error)) return undefined;
      throw new Error(getHttpErrorMessage(error, 'No fue posible cargar el tipo de habitacion.'));
    }
  },
  async createRoomType(data: CreateRoomTypeDto): Promise<RoomType> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible crear el tipo de habitacion.');
    const roomType = await request(
      () => httpClient.post<ApiRoomType>('/room-types', toRoomTypeRequest(data)),
      'No fue posible crear el tipo de habitacion.',
    );
    return toRoomType(toRoomTypeDto(roomType));
  },
  async updateRoomType(id: ID, data: UpdateRoomTypeDto): Promise<RoomType> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible actualizar el tipo de habitacion.');
    const roomType = await request(
      () => httpClient.put<ApiRoomType>(`/room-types/${id}`, toRoomTypeRequest(data)),
      'No fue posible actualizar el tipo de habitacion.',
    );
    return toRoomType(toRoomTypeDto(roomType));
  },
};

export default roomService;
