import type { Currency } from '@/shared/types/common';

export type CashSessionStatusDto = 'open' | 'closed';

/**
 * Jornada de caja (Lote C, WEB-11). `expected_balance_cents`,
 * `counted_balance_cents` y `difference_cents` solo existen una vez cerrada
 * — mientras `status === 'open'` no llevan valor. `expected_balance_cents`
 * es un valor guardado (opening_balance_cents + ingresos - egresos), no
 * derivado en el mapper — la FASE 5 lo verifica aritméticamente contra los
 * movimientos reales de la jornada.
 */
export interface CashSessionDTO {
  id: string;
  opened_by_user_id?: string;
  opened_at: string;
  opening_balance_cents: number;
  currency: Currency;
  status: CashSessionStatusDto;
  total_income_cents?: number;
  total_expense_cents?: number;
  closed_by_user_id?: string;
  closed_at?: string;
  expected_balance_cents?: number;
  counted_balance_cents?: number;
  difference_cents?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type CashSessionDto = CashSessionDTO;
