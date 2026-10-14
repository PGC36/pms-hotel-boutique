import { toDomainCalendarDate } from '@/shared/types/common';
import type { Currency, ID } from '@/shared/types/common';
import { httpClient } from './http-client';
import { guestRequest } from './guestHttp';

// Portal del huésped (INT-12). La estancia es una vista del backend (reserva +
// habitación + saldo del folio), no una entidad del contrato compartido.

type GuestStayResponse = {
  bookingId: string;
  guestId: string;
  guestFirstName?: string | null;
  guestLastName?: string | null;
  roomId?: string | null;
  roomNumber?: string | null;
  roomTypeId?: string | null;
  roomTypeName?: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  balanceCents?: number | null;
  currency: string;
};

export interface GuestStay {
  bookingId: ID;
  guestId: ID;
  guestFirstName: string;
  guestLastName: string;
  roomId?: ID;
  roomNumber?: string;
  roomTypeName?: string;
  /** Fechas civiles: se convierten sin desplazar el día por zona horaria. */
  checkIn: Date;
  checkOut: Date;
  status: string;
  balanceCents: number;
  currency: Currency;
}

function toGuestStay(response: GuestStayResponse): GuestStay {
  if (response.currency !== 'GTQ') {
    throw new Error(`El portal solo admite moneda GTQ; backend devolvio ${response.currency}.`);
  }
  return {
    bookingId: response.bookingId,
    guestId: response.guestId,
    guestFirstName: response.guestFirstName ?? '',
    guestLastName: response.guestLastName ?? '',
    roomId: response.roomId ?? undefined,
    roomNumber: response.roomNumber ?? undefined,
    roomTypeName: response.roomTypeName ?? undefined,
    checkIn: toDomainCalendarDate(response.checkIn),
    checkOut: toDomainCalendarDate(response.checkOut),
    status: response.status,
    balanceCents: response.balanceCents ?? 0,
    currency: 'GTQ',
  };
}

export interface GuestBooking {
  id: string;
  confirmationCode: string;
  guestLinkCode?: string;
  guestId: string;
  roomId?: string;
  roomTypeId: string;
  rateId?: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  adults: number;
  children: number;
  totalAmountCents: number;
  currency: Currency;
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateGuestBookingInput = {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  notes?: string;
};

type ApiGuestBookingResponse = {
  id: string;
  confirmationCode: string;
  guestLinkCode?: string | null;
  guestId: string;
  roomId?: string | null;
  roomTypeId: string;
  rateId?: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  adults: number;
  children: number;
  totalAmountCents: number;
  currency: string;
  notes?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

function toGuestBooking(response: ApiGuestBookingResponse): GuestBooking {
  return {
    id: response.id,
    confirmationCode: response.confirmationCode,
    guestLinkCode: response.guestLinkCode ?? undefined,
    guestId: response.guestId,
    roomId: response.roomId ?? undefined,
    roomTypeId: response.roomTypeId,
    rateId: response.rateId ?? undefined,
    checkIn: toDomainCalendarDate(response.checkIn),
    checkOut: toDomainCalendarDate(response.checkOut),
    status: response.status,
    adults: response.adults,
    children: response.children,
    totalAmountCents: response.totalAmountCents,
    currency: (response.currency as Currency) || 'GTQ',
    notes: response.notes ?? undefined,
    cancellationReason: response.cancellationReason ?? undefined,
    cancelledAt: response.cancelledAt ?? undefined,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

export const guestPortalService = {
  /** Estancia de la reserva asociada al JWT de huésped (`GET /guest/stay`). */
  async getStay(): Promise<GuestStay> {
    const response = await guestRequest(
      () => httpClient.get<GuestStayResponse>('/guest/stay'),
      'No fue posible cargar tu estancia.',
    );
    return toGuestStay(response);
  },

  /** Lista todas las reservas del huésped autenticado (`GET /guest/bookings`). */
  async getBookings(): Promise<GuestBooking[]> {
    const response = await guestRequest(
      () => httpClient.get<ApiGuestBookingResponse[]>('/guest/bookings'),
      'No fue posible cargar tus reservas.',
    );
    return response.map(toGuestBooking);
  },

  /** Obtiene el detalle de una reserva del huésped (`GET /guest/bookings/{id}`). */
  async getBooking(id: string): Promise<GuestBooking> {
    const response = await guestRequest(
      () => httpClient.get<ApiGuestBookingResponse>(`/guest/bookings/${id}`),
      'No fue posible consultar la reserva.',
    );
    return toGuestBooking(response);
  },

  /** Crea una nueva reserva para el huésped autenticado (`POST /guest/bookings`). */
  async createBooking(data: CreateGuestBookingInput): Promise<GuestBooking> {
    const response = await guestRequest(
      () =>
        httpClient.post<ApiGuestBookingResponse>('/guest/bookings', {
          roomTypeId: data.roomTypeId,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          adults: data.adults,
          children: data.children,
          notes: data.notes,
        }),
      'No fue posible crear la reserva.',
    );
    return toGuestBooking(response);
  },
};

export default guestPortalService;
