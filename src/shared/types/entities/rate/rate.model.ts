import type { Currency } from '@/shared/types/common';

export interface Rate {
  id: string;
  roomTypeId: string;
  name: string;
  validFrom: Date;
  validTo: Date;
  priceCents: number;
  currency: Currency;
  minimumNights: number;
  refundable: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
