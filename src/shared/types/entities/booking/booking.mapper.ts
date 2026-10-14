import {
  toDomainCalendarDate,
  toDomainDate,
  toDtoCalendarDate,
  toDtoDate,
} from '@/shared/types/common';
import type { BookingDto } from './booking.dto';
import type { Booking } from './booking.model';

export const toDomain = (dto: BookingDto): Booking => ({
  id: dto.id,
  confirmationCode: dto.confirmation_code,
  guestLinkCode: dto.guest_link_code,
  guestId: dto.guest_id,
  roomId: dto.room_id,
  roomTypeId: dto.room_type_id,
  rateId: dto.rate_id,
  checkIn: toDomainCalendarDate(dto.check_in),
  checkOut: toDomainCalendarDate(dto.check_out),
  status:
    dto.status === 'checked_in'
      ? 'checkedIn'
      : dto.status === 'checked_out'
        ? 'checkedOut'
        : dto.status === 'no_show'
          ? 'noShow'
          : dto.status,
  adults: dto.adults,
  children: dto.children,
  totalAmountCents: dto.total_amount_cents,
  currency: dto.currency,
  notes: dto.notes,
  cancellationReason: dto.cancellation_reason,
  cancelledAt: dto.cancelled_at ? toDomainDate(dto.cancelled_at) : undefined,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: Booking): BookingDto => ({
  id: model.id,
  confirmation_code: model.confirmationCode,
  guest_link_code: model.guestLinkCode,
  guest_id: model.guestId,
  room_id: model.roomId,
  room_type_id: model.roomTypeId,
  rate_id: model.rateId,
  check_in: toDtoCalendarDate(model.checkIn),
  check_out: toDtoCalendarDate(model.checkOut),
  status:
    model.status === 'checkedIn'
      ? 'checked_in'
      : model.status === 'checkedOut'
        ? 'checked_out'
        : model.status === 'noShow'
          ? 'no_show'
          : model.status,
  adults: model.adults,
  children: model.children,
  total_amount_cents: model.totalAmountCents,
  currency: model.currency,
  notes: model.notes,
  cancellation_reason: model.cancellationReason,
  cancelled_at: model.cancelledAt ? toDtoDate(model.cancelledAt) : undefined,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
