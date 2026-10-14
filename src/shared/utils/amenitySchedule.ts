/**
 * Disponibilidad de una amenidad por horario (Lote D, WEB-12). Toma la
 * fecha de referencia como parámetro explícito — nunca `Date.now()` por
 * su cuenta — para que sea determinista en pruebas y no dependa de a qué
 * hora corre `npm run test`.
 */

export interface AmenitySchedule {
  opensAt?: string;
  closesAt?: string;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseHHmm(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/**
 * Hora de una amenidad en el formato del contrato, `"HH:mm"`. El backend
 * envía `LocalTime` como `"HH:mm:ss"`; los segundos no se usan en el PMS.
 * Devuelve `undefined` si el valor está vacío o no es una hora válida.
 */
export function normalizeAmenityTime(value?: string | null): string | undefined {
  const match = TIME_PATTERN.exec(value?.trim() ?? '');
  if (!match) return undefined;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** Horario como texto editable, `"09:00 - 18:00"`, o `""` si no tiene horario. */
export function formatAmenitySchedule(amenity: AmenitySchedule): string {
  const opensAt = normalizeAmenityTime(amenity.opensAt);
  const closesAt = normalizeAmenityTime(amenity.closesAt);
  return opensAt && closesAt ? `${opensAt} - ${closesAt}` : '';
}

export type ParsedAmenitySchedule =
  { ok: true; opensAt: string | null; closesAt: string | null } | { ok: false; error: string };

const SCHEDULE_PATTERN = /^(\S+)\s*(?:-|–|—|a)\s*(\S+)$/i;

/**
 * Lee el horario escrito en el formulario de amenidad. Vacío significa
 * servicio continuo (`null` en ambas horas, para quitar el horario). Un texto
 * que no se puede leer se rechaza con un mensaje: nunca se guarda "a medias".
 * El backend exige apertura antes del cierre, así que una ventana que cruza
 * medianoche también se rechaza aquí con un mensaje claro.
 */
export function parseAmenityScheduleInput(text: string): ParsedAmenitySchedule {
  const value = text.trim();
  if (!value) return { ok: true, opensAt: null, closesAt: null };

  const match = SCHEDULE_PATTERN.exec(value);
  const opensAt = normalizeAmenityTime(match?.[1]);
  const closesAt = normalizeAmenityTime(match?.[2]);
  if (!opensAt || !closesAt) {
    return {
      ok: false,
      error: 'Escribe el horario como HH:mm - HH:mm (p. ej. 07:00 - 21:00) o déjalo vacío.',
    };
  }
  if (parseHHmm(opensAt) >= parseHHmm(closesAt)) {
    return { ok: false, error: 'La hora de apertura debe ser anterior a la de cierre.' };
  }
  return { ok: true, opensAt, closesAt };
}

/**
 * `true` si la amenidad está abierta en el instante `at`. Sin horario
 * (`opensAt`/`closesAt` ausentes) significa servicio continuo — siempre
 * abierta. Soporta una ventana que cruza medianoche (p. ej. `22:00`–`02:00`).
 */
export function isAmenityOpenAt(amenity: AmenitySchedule, at: Date): boolean {
  if (!amenity.opensAt || !amenity.closesAt) return true;

  const now = minutesOfDay(at);
  const opens = parseHHmm(amenity.opensAt);
  const closes = parseHHmm(amenity.closesAt);

  if (opens <= closes) return now >= opens && now < closes;
  return now >= opens || now < closes;
}
