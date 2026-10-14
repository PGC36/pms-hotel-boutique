import type { Currency } from '@/shared/types/common';

/** Clasificación del movimiento, no un estado con transiciones — se declara
 * localmente, igual que `ChargeStatusDto`/`ProductCategoryDto`. */
export type CashMovementTypeDto = 'income' | 'expense';

/**
 * Ingreso o egreso dentro de una jornada de caja (Lote C, WEB-11).
 * `payment_id?` se llena cuando el ingreso viene de un pago de huésped
 * (`payment.booking_id`) — trazabilidad opcional, no todo ingreso/egreso
 * tiene un pago detrás (p. ej. un egreso operativo).
 */
export interface CashMovementDTO {
  id: string;
  cash_session_id: string;
  type: CashMovementTypeDto;
  concept: string;
  amount_cents: number;
  currency: Currency;
  responsible_user_id?: string;
  occurred_at: string;
  payment_id?: string;
  created_at: string;
}

export type CashMovementDto = CashMovementDTO;
