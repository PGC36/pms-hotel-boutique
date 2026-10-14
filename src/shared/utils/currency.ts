import type { Currency } from '@/shared/types/common';

/**
 * Locale used to format each currency. `Currency` is closed to the literal
 * `'GTQ'` (team agreement, FASE 3+4 of the Fase 0 close-out): this record
 * stays keyed by `Currency` rather than a hardcoded `'GTQ'` string so it
 * still fails to compile if that type ever grows a second currency without
 * this locale table growing with it.
 */
const CURRENCY_LOCALES: Record<Currency, string> = {
  GTQ: 'es-GT',
};

/**
 * Formats an integer amount of cents as a currency string. GTQ renders as
 * symbol, comma thousands separator, dot decimal, two decimals, and no space
 * between the symbol and the amount (for example, 125000 cents becomes
 * Q1,250.00).
 *
 * Amounts are always integer cents so money never round-trips through a
 * floating-point quetzales/dollars value. Non-integer, NaN, or infinite input
 * throws instead of silently rounding.
 */
export function formatCurrency(amountCents: number, currency: Currency = 'GTQ'): string {
  if (!Number.isInteger(amountCents)) {
    throw new Error(
      `formatCurrency: amountCents debe ser un entero (centavos), recibido: ${amountCents}`,
    );
  }

  const formatted = new Intl.NumberFormat(CURRENCY_LOCALES[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);

  // Intl inserts a non-breaking space (code point U+00A0) between the
  // symbol/code and the amount for several locales, including GTQ. The PMS
  // has a single visual standard with no gap, so it is stripped here instead
  // of in each caller.
  return formatted.replace(/\s/g, '');
}
