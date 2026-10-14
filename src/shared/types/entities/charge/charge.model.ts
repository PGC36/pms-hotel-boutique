import type { Currency } from '@/shared/types/common';

export type ChargeStatus = 'pending' | 'posted' | 'voided';
export type ChargeCategory = 'stay' | 'consumption';

export interface Charge {
  id: string;
  bookingId: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  currency: Currency;
  category?: ChargeCategory;
  status: ChargeStatus;
  chargedAt: Date;
  createdByUserId?: string;
  voidReason?: string;
  createdAt: Date;
}
