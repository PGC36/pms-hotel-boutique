import type { Currency } from '@/shared/types/common';

export type PaymentMethodDto = 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'online';
export type PaymentStatusDto = 'pending' | 'completed' | 'failed' | 'refunded';

export interface PaymentDTO {
  id: string;
  booking_id: string;
  amount_cents: number;
  currency: Currency;
  method: PaymentMethodDto;
  status: PaymentStatusDto;
  transaction_reference?: string;
  paid_at?: string;
  processed_by_user_id?: string;
  created_at: string;
}

export type PaymentDto = PaymentDTO;

export interface AddPaymentDto {
  booking_id: string;
  amount_cents: number;
  currency: Currency;
  method?: PaymentMethodDto;
  transaction_reference?: string;
  paid_at?: string;
  processed_by_user_id?: string;
}
