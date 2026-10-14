import {
  toDomain as toBooking,
  type Booking,
  type BookingDto,
  type CreateBookingDto,
  type UpdateBookingDto,
} from '@/shared/types/entities/booking';
import type { ID } from '@/shared/types/common';
import { mockUtils, simulateLatency } from './mockUtils';
import { HttpError, httpClient } from './http-client';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ApiBooking = {
  id: string;
  confirmationCode: string;
  guestLinkCode?: string | null;
  guestId?: string;
  guest?: { id: string };
  roomId?: string | null;
  room?: { id: string } | null;
  roomTypeId?: string;
  roomType?: { id: string };
  rateId?: string | null;
  rate?: { id: string } | null;
  checkIn: string;
  checkOut: string;
  status: BookingDto['status'] | Booking['status'];
  adults: number;
  children: number;
  totalAmountCents: number;
  currency?: BookingDto['currency'];
  notes?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiCheckInResponse = {
  bookingId: string;
  status: BookingDto['status'] | Booking['status'];
  guestId: string;
  guestFirstName: string;
  guestLastName: string;
  roomId: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  companionCount: number;
  totalOccupants: number;
  operationTimestamp: string;
};

const nowIso = () => new Date().toISOString();
const isHttpNotFound = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 404;

function toDtoStatus(status: Booking['status']): BookingDto['status'] {
  return status === 'checkedIn'
    ? 'checked_in'
    : status === 'checkedOut'
      ? 'checked_out'
      : status === 'noShow'
        ? 'no_show'
        : status;
}

function normalizeApiStatus(status: ApiBooking['status']): BookingDto['status'] {
  return toDtoStatus(
    status === 'checked_in'
      ? 'checkedIn'
      : status === 'checked_out'
        ? 'checkedOut'
        : status === 'no_show'
          ? 'noShow'
          : status,
  );
}

function requireRelatedId(id: string | undefined, label: string): string {
  if (!id) throw new Error(`La respuesta del backend no incluye ${label}.`);
  return id;
}

function toBookingDto(api: ApiBooking): BookingDto {
  const timestamp = api.updatedAt ?? api.createdAt ?? nowIso();
  return {
    id: api.id,
    confirmation_code: api.confirmationCode,
    guest_link_code: api.guestLinkCode ?? api.confirmationCode,
    guest_id: requireRelatedId(api.guestId ?? api.guest?.id, 'guestId'),
    room_id: api.roomId ?? api.room?.id ?? undefined,
    room_type_id: requireRelatedId(api.roomTypeId ?? api.roomType?.id, 'roomTypeId'),
    rate_id: api.rateId ?? api.rate?.id ?? undefined,
    check_in: api.checkIn,
    check_out: api.checkOut,
    status: normalizeApiStatus(api.status),
    adults: api.adults,
    children: api.children,
    total_amount_cents: api.totalAmountCents,
    currency: api.currency ?? 'GTQ',
    notes: api.notes ?? undefined,
    cancellation_reason: api.cancellationReason ?? undefined,
    cancelled_at: api.cancelledAt ?? undefined,
    created_at: api.createdAt ?? timestamp,
    updated_at: timestamp,
  };
}

function toBookingRequest(data: CreateBookingDto | UpdateBookingDto) {
  return {
    guestId: data.guest_id,
    roomId: data.room_id,
    roomTypeId: data.room_type_id,
    rateId: data.rate_id,
    checkIn: data.check_in,
    checkOut: data.check_out,
    adults: data.adults,
    children: data.children,
    notes: data.notes?.trim() || undefined,
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
  if (error.status === 400) return `${fallback} Revisa los datos enviados.`;
  if (error.status === 401) return 'Tu sesion expiro. Inicia sesion nuevamente.';
  if (error.status === 403) return 'No tienes permisos para operar reservas.';
  if (error.status === 404) return `${fallback} La reserva ya no existe.`;
  if (error.status === 409) return `${fallback} El folio abierto tiene saldo distinto de cero.`;
  return fallback;
}

async function request<T>(call: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new Error(getHttpErrorMessage(error, fallback));
  }
}

function isUuid(value: ID): boolean {
  return UUID_PATTERN.test(value);
}

function assertBackendId(id: ID, operation: string): void {
  if (!isUuid(id)) {
    throw new Error(`${operation} requiere una reserva integrada con backend real.`);
  }
}

export const bookingService = {
  async getBookings(): Promise<Booking[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar las reservas.');
    const bookings = await request(
      () => httpClient.get<ApiBooking[]>('/bookings'),
      'No fue posible cargar las reservas.',
    );
    return bookings.map(toBookingDto).map(toBooking);
  },
  async getBookingById(id: ID): Promise<Booking | undefined> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar la reserva.');
    assertBackendId(id, 'La consulta de reserva');

    try {
      const booking = await httpClient.get<ApiBooking>(`/bookings/${id}`);
      return toBooking(toBookingDto(booking));
    } catch (error) {
      if (isHttpNotFound(error)) return undefined;
      throw new Error(getHttpErrorMessage(error, 'No fue posible cargar la reserva.'));
    }
  },
  async createBooking(data: CreateBookingDto): Promise<Booking> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible crear la reserva.');
    if (!isUuid(data.guest_id) || !isUuid(data.room_type_id)) {
      throw new Error('Crear reservas requiere huesped y tipo de habitacion del backend real.');
    }

    const booking = await request(
      () => httpClient.post<ApiBooking>('/bookings', toBookingRequest(data)),
      'No fue posible crear la reserva.',
    );
    return toBooking(toBookingDto(booking));
  },
  async checkIn(bookingId: ID): Promise<Booking> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible hacer check-in.');
    assertBackendId(bookingId, 'El check-in');

    await request(
      () => httpClient.post<ApiCheckInResponse>(`/bookings/${bookingId}/check-in`),
      'No fue posible hacer check-in.',
    );
    const booking = await request(
      () => httpClient.get<ApiBooking>(`/bookings/${bookingId}`),
      'No fue posible cargar la reserva actualizada despues del check-in.',
    );
    return toBooking(toBookingDto(booking));
  },
  async checkOut(bookingId: ID): Promise<Booking> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible hacer check-out.');
    assertBackendId(bookingId, 'El check-out');

    const booking = await request(
      () => httpClient.post<ApiBooking>(`/bookings/${bookingId}/check-out`),
      'No fue posible hacer check-out.',
    );
    return toBooking(toBookingDto(booking));
  },
  async updateBooking(id: ID, data: UpdateBookingDto): Promise<Booking> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible actualizar la reserva.');
    assertBackendId(id, 'La actualizacion de reserva');

    const booking = await request(
      () => httpClient.put<ApiBooking>(`/bookings/${id}`, toBookingRequest(data)),
      'No fue posible actualizar la reserva.',
    );
    return toBooking(toBookingDto(booking));
  },
  async confirmBooking(bookingId: ID): Promise<Booking> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible confirmar la reserva.');
    assertBackendId(bookingId, 'La confirmacion de reserva');

    const booking = await request(
      () => httpClient.post<ApiBooking>(`/bookings/${bookingId}/confirm`),
      'No fue posible confirmar la reserva.',
    );
    return toBooking(toBookingDto(booking));
  },
  async cancelBooking(bookingId: ID, reason: string): Promise<Booking> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cancelar la reserva.');
    assertBackendId(bookingId, 'La cancelacion de reserva');
    if (!reason.trim()) throw new Error('Se requiere un motivo para cancelar la reserva.');

    const booking = await request(
      () => httpClient.post<ApiBooking>(`/bookings/${bookingId}/cancel`, { reason: reason.trim() }),
      'No fue posible cancelar la reserva.',
    );
    return toBooking(toBookingDto(booking));
  },
  async assignRoom(bookingId: ID, roomId: ID): Promise<Booking> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible asignar la habitacion.');
    assertBackendId(bookingId, 'La asignacion de habitacion');
    if (!isUuid(roomId)) throw new Error('La asignacion requiere una habitacion del backend real.');

    const booking = await request(
      () => httpClient.put<ApiBooking>(`/bookings/${bookingId}`, { roomId }),
      'No fue posible asignar la habitacion.',
    );
    return toBooking(toBookingDto(booking));
  },
};
export default bookingService;
