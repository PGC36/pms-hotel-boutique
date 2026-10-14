import type { Currency } from '@/shared/types/common';
import type { DepositStatus } from '@/shared/constants/statuses';

export type { DepositStatus };

export type DepositMethod = 'cash' | 'creditCard' | 'debitCard' | 'bankTransfer';

export interface Deposit {
  id: string;
  bookingId: string;
  guestId: string;
  amountCents: number;
  currency: Currency;
  method: DepositMethod;
  status: DepositStatus;
  collectedAt: Date;
  refundedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
