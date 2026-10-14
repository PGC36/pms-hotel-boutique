import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { CashMovementDto } from './cash-movement.dto';
import type { CashMovement } from './cash-movement.model';

export const toDomain = (dto: CashMovementDto): CashMovement => ({
  id: dto.id,
  cashSessionId: dto.cash_session_id,
  type: dto.type,
  concept: dto.concept,
  amountCents: dto.amount_cents,
  currency: dto.currency,
  responsibleUserId: dto.responsible_user_id,
  occurredAt: toDomainDate(dto.occurred_at),
  paymentId: dto.payment_id,
  createdAt: toDomainDate(dto.created_at),
});

export const toDTO = (model: CashMovement): CashMovementDto => ({
  id: model.id,
  cash_session_id: model.cashSessionId,
  type: model.type,
  concept: model.concept,
  amount_cents: model.amountCents,
  currency: model.currency,
  responsible_user_id: model.responsibleUserId,
  occurred_at: toDtoDate(model.occurredAt),
  payment_id: model.paymentId,
  created_at: toDtoDate(model.createdAt),
});
