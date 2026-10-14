// Every DTO with money uses this literal, never a bare `string`: the team
// agreement is quetzal-only (see PROGRESO-FASE-0.md, FASE 3+4).
export type Currency = 'GTQ';
export type ID = string;
export type ISODateString = string;
export type UserRole =
  'ADMIN' | 'GUEST' | 'RECEPTION' | 'HOUSEKEEPING' | 'CONCIERGE' | 'ROOM_SERVICE';

export const toDomainDate = (value: string): Date => new Date(value);

export const toDtoDate = (value: Date): string => value.toISOString();

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a calendar-date DTO field (check_in, check_out, valid_from,
 * valid_to: a civil day, never a timestamp) formatted as "YYYY-MM-DD" into a
 * local Date at local midnight.
 *
 * Deliberately does not use `new Date(value)`: a date-only ISO string is
 * parsed as UTC midnight by the spec, which shifts to the previous day once
 * read back with local getters in any timezone behind UTC (Guatemala is
 * UTC-6). Splitting the components and building with `new Date(year,
 * month - 1, day)` — the local-time constructor form — avoids that shift
 * entirely.
 *
 * Also rejects calendar-impossible dates (2026-02-30, 2026-13-01, ...) by
 * checking the constructed Date's components against the ones requested,
 * since `Date` otherwise rolls those over into the next month/day silently.
 * The same round-trip check rejects four-digit years below 100 (e.g.
 * "0026") as a side effect: the `Date` constructor's legacy two-digit-year
 * rule maps 0-99 to 1900-1999, so the reconstructed year no longer matches
 * the one requested and the mismatch throws — no separate branch needed for
 * a case the PMS domain (hotel bookings, rates, promotions) never produces.
 */
export const toDomainCalendarDate = (value: string): Date => {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error(
      `toDomainCalendarDate: se esperaba una fecha "YYYY-MM-DD", recibido: "${value}".`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  const isRealDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!isRealDate) {
    throw new Error(`toDomainCalendarDate: la fecha "${value}" no existe en el calendario.`);
  }

  return date;
};

/**
 * Serializes a calendar-date Date back to its "YYYY-MM-DD" DTO form using
 * local getters. Never uses `toISOString()`, which would convert through
 * UTC and risk the same day-shift `toDomainCalendarDate` avoids on parsing.
 */
export const toDtoCalendarDate = (value: Date): string => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error('toDtoCalendarDate: se esperaba un objeto Date válido.');
  }

  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
