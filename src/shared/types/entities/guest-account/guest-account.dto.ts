import type { Currency } from '@/shared/types/common';

export type GuestAccountStatusDto = 'open' | 'closed';

/**
 * Folio de una estadía: agrega los cargos y pagos de una reserva. Una
 * cuenta por reserva (1:1) — `charge`/`payment` siguen referenciando
 * `booking_id` directamente (no se les agregó `account_id`); esta entidad
 * es el encabezado del folio y su saldo ya calculado, no un nuevo nivel de
 * indirección. `balance_cents` es un valor guardado (como lo devolvería una
 * API real que ya hizo la cuenta), no derivado en el mapper — la FASE 5
 * verifica aritméticamente que coincide con cargos menos pagos.
 */
export interface GuestAccountDTO {
  id: string;
  booking_id: string;
  guest_id: string;
  status: GuestAccountStatusDto;
  balance_cents: number;
  currency: Currency;
  opened_at: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
}

export type GuestAccountDto = GuestAccountDTO;
