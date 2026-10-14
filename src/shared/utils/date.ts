/**
 * Date and stay-range utilities for Guatemala's display conventions:
 * dd-mm-aaaa dates and 24-hour HH:mm time.
 *
 * Two kinds of `Date` value flow through the domain and must not be
 * confused:
 *
 * - Calendar date (check-in, check-out, valid_from, valid_to): a civil day.
 *   Its identity comes only from year/month/day read with LOCAL getters
 *   (getFullYear/getMonth/getDate), never from toISOString() or UTC getters,
 *   so the day it represents never shifts because of the runtime's
 *   timezone.
 * - Timestamp (createdAt, updatedAt): a real instant. When it needs to be
 *   shown, only its local hour/minute matter (formatTimeGT); the utilities
 *   here never need its calendar day.
 *
 * Parsing dd-mm-aaaa strings back into a Date is intentionally out of scope
 * in this stage; it is decided once the mock/mapper contract that needs it
 * is settled.
 */

function assertValidDate(date: Date, label = 'date'): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error(`${label} inválida: se esperaba un objeto Date válido.`);
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Encodes a Date's local calendar day (year/month/day only, time discarded)
 * as a UTC millisecond anchor. UTC has no DST and no offset transitions, so
 * the distance between two such anchors is always an exact multiple of a
 * day — this is used purely as an arithmetic distance between civil days,
 * never to reinterpret or display the date.
 */
function calendarDayUTC(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Formats a calendar date as dd-mm-aaaa (e.g. 08-09-2026). */
export function formatDateGT(date: Date): string {
  assertValidDate(date);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/** Formats a timestamp's local time as 24-hour HH:mm (e.g. 23:05). */
export function formatTimeGT(date: Date): string {
  assertValidDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function assertOrderedStay(checkIn: Date, checkOut: Date): void {
  if (calendarDayUTC(checkOut) < calendarDayUTC(checkIn)) {
    throw new Error(
      `Rango de estadía inválido: checkOut (${formatDateGT(checkOut)}) es anterior a checkIn (${formatDateGT(checkIn)}).`,
    );
  }
}

/**
 * Formats a stay range as "dd-mm-aaaa – dd-mm-aaaa" using formatDateGT for
 * each end. Throws if either date is invalid or checkOut is before checkIn
 * (compared by calendar day, not time of day).
 */
export function formatStayRange(checkIn: Date, checkOut: Date): string {
  assertValidDate(checkIn, 'checkIn');
  assertValidDate(checkOut, 'checkOut');
  assertOrderedStay(checkIn, checkOut);
  return `${formatDateGT(checkIn)} – ${formatDateGT(checkOut)}`;
}

/**
 * Number of nights between two calendar dates. Same-day returns 0. Throws if
 * either date is invalid or checkOut is before checkIn, instead of returning
 * a negative number or masking it with Math.abs().
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  assertValidDate(checkIn, 'checkIn');
  assertValidDate(checkOut, 'checkOut');
  assertOrderedStay(checkIn, checkOut);
  return (calendarDayUTC(checkOut) - calendarDayUTC(checkIn)) / MS_PER_DAY;
}

/** Whether two Dates fall on the same calendar day, ignoring time of day. */
export function isSameCalendarDay(a: Date, b: Date): boolean {
  assertValidDate(a, 'a');
  assertValidDate(b, 'b');
  return calendarDayUTC(a) === calendarDayUTC(b);
}
