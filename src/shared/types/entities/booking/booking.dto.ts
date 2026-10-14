import type { Currency } from '@/shared/types/common';

export type BookingStatusDto =
  'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

export interface BookingDTO {
  id: string;
  confirmation_code: string;
  /**
   * Código que el huésped teclea en la app móvil para vincularse a esta
   * reserva (MOV-14). La web lo genera al confirmar la reserva; distinto de
   * `confirmation_code` (identifica la reserva ante recepción/el huésped en
   * general), este es específicamente el secreto de vinculación de móvil.
   */
  guest_link_code: string;
  guest_id: string;
  room_id?: string;
  room_type_id: string;
  rate_id?: string;
  check_in: string;
  check_out: string;
  status: BookingStatusDto;
  adults: number;
  children: number;
  total_amount_cents: number;
  currency: Currency;
  notes?: string;
  /** Motivo registrado por `POST /bookings/{id}/cancel`; solo en reservas canceladas. */
  cancellation_reason?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export type BookingDto = BookingDTO;

export interface CreateBookingDto {
  guest_id: string;
  room_id?: string;
  room_type_id: string;
  rate_id?: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  notes?: string;
}

export type UpdateBookingDto = Partial<CreateBookingDto>;
