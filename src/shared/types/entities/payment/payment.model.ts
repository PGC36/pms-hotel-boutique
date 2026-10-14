import type { Currency } from '@/shared/types/common';

export type PaymentMethod = 'cash' | 'creditCard' | 'debitCard' | 'bankTransfer' | 'online';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  bookingId: string;
  amountCents: number;
  currency: Currency;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string;
  paidAt?: Date;
  processedByUserId?: string;
  createdAt: Date;
}
