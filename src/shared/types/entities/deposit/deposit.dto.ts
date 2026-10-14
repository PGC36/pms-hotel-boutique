import type { Currency } from '@/shared/types/common';

export type DepositMethodDto = 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer';
export type DepositStatusDto = 'held' | 'refunded' | 'applied';

/** Depósito o garantía entregado al check-in (Lote C, WEB-11). */
export interface DepositDTO {
  id: string;
  booking_id: string;
  guest_id: string;
  amount_cents: number;
  currency: Currency;
  method: DepositMethodDto;
  status: DepositStatusDto;
  collected_at: string;
  refunded_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type DepositDto = DepositDTO;
