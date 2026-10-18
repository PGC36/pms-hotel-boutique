import { toDtoCalendarDate } from '@/shared/types/common';
import type { Payment } from '@/shared/types/entities/payment';
import type { Reservation, ReservationStatus } from '@/private/workspace/PrivateWorkspace';

/**
 * Criterios únicos del Resumen de recepción: las métricas de la cabecera y
 * las tarjetas/listas del panel cuentan llegadas, salidas, ocupación y pagos
 * con estas funciones para que nunca muestren cifras distintas.
 */

const ARRIVAL_PENDING: readonly ReservationStatus[] = ['Pendiente', 'Confirmada'];
const DEPARTURE_PENDING: readonly ReservationStatus[] = ['Check-in'];

export type DaySplit = {
  /** Todas las reservas del día que cuentan para el indicador. */
  all: Reservation[];
  /** Las que todavía están por ocurrir (llegar o salir). */
  pending: number;
  /** Las que ya ocurrieron (check-in o check-out registrado). */
  done: number;
};

/** Reservas con entrada hoy: por llegar (pendiente/confirmada) o ya con check-in. */
export function getArrivalsForDay(reservations: Reservation[], day: string): DaySplit {
  const all = reservations.filter(
    (reservation) =>
      reservation.checkIn === day &&
      (ARRIVAL_PENDING.includes(reservation.status) || reservation.status === 'Check-in'),
  );
  const pending = all.filter((reservation) => ARRIVAL_PENDING.includes(reservation.status)).length;
  return { all, pending, done: all.length - pending };
}

/** Reservas con salida hoy: por salir (check-in) o ya con check-out. */
export function getDeparturesForDay(reservations: Reservation[], day: string): DaySplit {
  const all = reservations.filter(
    (reservation) =>
      reservation.checkOut === day &&
      (DEPARTURE_PENDING.includes(reservation.status) || reservation.status === 'Check-out'),
  );
  const pending = all.filter((reservation) =>
    DEPARTURE_PENDING.includes(reservation.status),
  ).length;
  return { all, pending, done: all.length - pending };
}

/** Porcentaje entero de ocupación; `null` si no hay habitaciones (evita NaN%). */
export function getOccupancyPercent(occupied: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((occupied / total) * 100);
}

export type PaymentsDaySummary = { count: number; totalCents: number };

/**
 * Pagos completados en el backend durante el día. `null` cuando el panel no
 * pudo leer los pagos (sin permiso): no se sustituye por cero.
 */
export function summarizePaymentsForDay(
  payments: Payment[] | null,
  day: string,
): PaymentsDaySummary | null {
  if (payments === null) return null;
  const ofDay = payments.filter(
    (payment) =>
      payment.status === 'completed' &&
      toDtoCalendarDate(payment.paidAt ?? payment.createdAt) === day,
  );
  return {
    count: ofDay.length,
    totalCents: ofDay.reduce((total, payment) => total + payment.amountCents, 0),
  };
}
