import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { GuestAccountDto } from './guest-account.dto';
import type { GuestAccount } from './guest-account.model';

export const toDomain = (dto: GuestAccountDto): GuestAccount => ({
  id: dto.id,
  bookingId: dto.booking_id,
  guestId: dto.guest_id,
  status: dto.status,
  balanceCents: dto.balance_cents,
  currency: dto.currency,
  openedAt: toDomainDate(dto.opened_at),
  closedAt: dto.closed_at ? toDomainDate(dto.closed_at) : undefined,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: GuestAccount): GuestAccountDto => ({
  id: model.id,
  booking_id: model.bookingId,
  guest_id: model.guestId,
  status: model.status,
  balance_cents: model.balanceCents,
  currency: model.currency,
  opened_at: toDtoDate(model.openedAt),
  closed_at: model.closedAt ? toDtoDate(model.closedAt) : undefined,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
