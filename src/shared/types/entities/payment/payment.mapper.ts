import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { PaymentDto } from './payment.dto';
import type { Payment } from './payment.model';

export const toDomain = (dto: PaymentDto): Payment => ({
  id: dto.id,
  bookingId: dto.booking_id,
  amountCents: dto.amount_cents,
  currency: dto.currency,
  method:
    dto.method === 'credit_card'
      ? 'creditCard'
      : dto.method === 'debit_card'
        ? 'debitCard'
        : dto.method === 'bank_transfer'
          ? 'bankTransfer'
          : dto.method,
  status: dto.status,
  transactionReference: dto.transaction_reference,
  paidAt: dto.paid_at ? toDomainDate(dto.paid_at) : undefined,
  processedByUserId: dto.processed_by_user_id,
  createdAt: toDomainDate(dto.created_at),
});

export const toDTO = (model: Payment): PaymentDto => ({
  id: model.id,
  booking_id: model.bookingId,
  amount_cents: model.amountCents,
  currency: model.currency,
  method:
    model.method === 'creditCard'
      ? 'credit_card'
      : model.method === 'debitCard'
        ? 'debit_card'
        : model.method === 'bankTransfer'
          ? 'bank_transfer'
          : model.method,
  status: model.status,
  transaction_reference: model.transactionReference,
  paid_at: model.paidAt ? toDtoDate(model.paidAt) : undefined,
  processed_by_user_id: model.processedByUserId,
  created_at: toDtoDate(model.createdAt),
});
