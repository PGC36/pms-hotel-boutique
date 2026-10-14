import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { CashSessionDto } from './cash-session.dto';
import type { CashSession } from './cash-session.model';

export const toDomain = (dto: CashSessionDto): CashSession => ({
  id: dto.id,
  openedByUserId: dto.opened_by_user_id,
  openedAt: toDomainDate(dto.opened_at),
  openingBalanceCents: dto.opening_balance_cents,
  currency: dto.currency,
  status: dto.status,
  totalIncomeCents: dto.total_income_cents,
  totalExpenseCents: dto.total_expense_cents,
  closedByUserId: dto.closed_by_user_id,
  closedAt: dto.closed_at ? toDomainDate(dto.closed_at) : undefined,
  expectedBalanceCents: dto.expected_balance_cents,
  countedBalanceCents: dto.counted_balance_cents,
  differenceCents: dto.difference_cents,
  notes: dto.notes,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: CashSession): CashSessionDto => ({
  id: model.id,
  opened_by_user_id: model.openedByUserId,
  opened_at: toDtoDate(model.openedAt),
  opening_balance_cents: model.openingBalanceCents,
  currency: model.currency,
  status: model.status,
  total_income_cents: model.totalIncomeCents,
  total_expense_cents: model.totalExpenseCents,
  closed_by_user_id: model.closedByUserId,
  closed_at: model.closedAt ? toDtoDate(model.closedAt) : undefined,
  expected_balance_cents: model.expectedBalanceCents,
  counted_balance_cents: model.countedBalanceCents,
  difference_cents: model.differenceCents,
  notes: model.notes,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
