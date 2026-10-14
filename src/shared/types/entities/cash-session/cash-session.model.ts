import type { Currency } from '@/shared/types/common';
import type { CashSessionStatus } from '@/shared/constants/statuses';

export type { CashSessionStatus };

export interface CashSession {
  id: string;
  openedByUserId?: string;
  openedAt: Date;
  openingBalanceCents: number;
  currency: Currency;
  status: CashSessionStatus;
  totalIncomeCents?: number;
  totalExpenseCents?: number;
  closedByUserId?: string;
  closedAt?: Date;
  expectedBalanceCents?: number;
  countedBalanceCents?: number;
  differenceCents?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
