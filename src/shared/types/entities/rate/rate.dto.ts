import type { Currency } from '@/shared/types/common';

export interface RateDTO {
  id: string;
  room_type_id: string;
  name: string;
  valid_from: string;
  valid_to: string;
  price_cents: number;
  currency: Currency;
  minimum_nights: number;
  refundable: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type RateDto = RateDTO;
