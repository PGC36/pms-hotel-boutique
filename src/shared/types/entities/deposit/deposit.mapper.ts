import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { DepositDto } from './deposit.dto';
import type { Deposit } from './deposit.model';

const toDomainMethod = (method: DepositDto['method']): Deposit['method'] =>
  method === 'credit_card'
    ? 'creditCard'
    : method === 'debit_card'
      ? 'debitCard'
      : method === 'bank_transfer'
        ? 'bankTransfer'
        : method;

const toDtoMethod = (method: Deposit['method']): DepositDto['method'] =>
  method === 'creditCard'
    ? 'credit_card'
    : method === 'debitCard'
      ? 'debit_card'
      : method === 'bankTransfer'
        ? 'bank_transfer'
        : method;

export const toDomain = (dto: DepositDto): Deposit => ({
  id: dto.id,
  bookingId: dto.booking_id,
  guestId: dto.guest_id,
  amountCents: dto.amount_cents,
  currency: dto.currency,
  method: toDomainMethod(dto.method),
  status: dto.status,
  collectedAt: toDomainDate(dto.collected_at),
  refundedAt: dto.refunded_at ? toDomainDate(dto.refunded_at) : undefined,
  notes: dto.notes,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: Deposit): DepositDto => ({
  id: model.id,
  booking_id: model.bookingId,
  guest_id: model.guestId,
  amount_cents: model.amountCents,
  currency: model.currency,
  method: toDtoMethod(model.method),
  status: model.status,
  collected_at: toDtoDate(model.collectedAt),
  refunded_at: model.refundedAt ? toDtoDate(model.refundedAt) : undefined,
  notes: model.notes,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
