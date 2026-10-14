import type { Currency } from '@/shared/types/common';

export type CashMovementType = 'income' | 'expense';

export interface CashMovement {
  id: string;
  cashSessionId: string;
  type: CashMovementType;
  concept: string;
  amountCents: number;
  currency: Currency;
  responsibleUserId?: string;
  occurredAt: Date;
  paymentId?: string;
  createdAt: Date;
}
