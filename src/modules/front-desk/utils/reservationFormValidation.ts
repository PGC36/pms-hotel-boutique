import { toDomainCalendarDate } from '@/shared/types/common';
import { calculateNights, formatDateGT } from '@/shared/utils/date';

/**
 * Reglas del formulario "Nueva reserva" de Recepción (subfase 1B). Cada
 * función devuelve el mensaje de error en español, o `null` si el valor es
 * válido. El backend sigue siendo quien decide al guardar.
 */

export const HOTEL_TIME_ZONE = 'America/Guatemala';
export const MAX_STAY_NIGHTS = 90;
/**
 * Teléfono: solo dígitos (sin prefijo +, espacios, guiones ni paréntesis), de 8
 * a 20. El backend no valida el teléfono (sin @Size ni @Pattern, columna
 * VARCHAR sin longitud): esta regla vive solo en el frontend.
 */
export const PHONE_MIN_DIGITS = 8;
export const PHONE_MAX_DIGITS = 20;
export const EMAIL_MAX_LENGTH = 254;
export const EMAIL_LOCAL_MAX_LENGTH = 64;
export const EMAIL_LABEL_MAX_LENGTH = 63;
/** Observaciones de Nueva reserva (solo este formulario). */
export const NOTES_MAX_LENGTH = 500;
/** Por campo (nombre o apellido) en Nueva reserva. */
export const NAME_MAX_LENGTH = 20;

export const PHONE_REQUIRED = 'Ingresa el teléfono.';
export const PHONE_INVALID = 'Ingresa un teléfono válido.';
/** Letras reales mínimas por campo: no cuentan espacios, guiones, puntos ni apóstrofos. */
export const NAME_MIN_LETTERS = 3;
export const NAME_INVALID = 'Solo se permiten letras.';
export const NAME_TOO_LONG = `Máximo ${NAME_MAX_LENGTH} caracteres.`;
export const NAME_TOO_SHORT = `Mínimo ${NAME_MIN_LETTERS} letras.`;
export const NOTES_TOO_LONG = `Máximo ${NOTES_MAX_LENGTH} caracteres.`;
export const ADULTS_REQUIRED = 'Ingresa la cantidad de adultos.';
export const ADULTS_MIN = 'Mínimo 1 adulto.';
export const WHOLE_NUMBER_INVALID = 'Ingresa un número entero.';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DIGITS_ONLY = /^\d*$/;

/**
 * Filtro de escritura para cantidades: acepta el cambio solo si son dígitos
 * 0–9 (o vacío). Signos, letras, decimales, espacios y notación científica se
 * rechazan y el estado conserva el valor anterior.
 */
export function isDigitsOnly(value: string): boolean {
  return DIGITS_ONLY.test(value);
}

/** Filtro de escritura del teléfono: conserva solo dígitos y como máximo 20 (también al pegar). */
export function keepPhoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);
}

/** Menores vacíos equivalen a 0 (nunca NaN en el estado ni en la petición). */
export function normalizeChildren(value: string): string {
  return value.trim() === '' ? '0' : value;
}
/**
 * Correo: subconjunto de lo que acepta el `@Email` del backend (Hibernate
 * Validator), para que nada que pase aquí lo rechace el servidor. Parte local
 * "dot-atom": caracteres permitidos (incluido Unicode) separados por puntos
 * simples, sin punto al inicio ni al final. Dominio: dos o más etiquetas sin
 * guion al inicio ni al final.
 */
const EMAIL_LOCAL_PART =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~\u0080-\uFFFF-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~\u0080-\uFFFF-]+)*$/u;
const EMAIL_DOMAIN_LABEL =
  /^[A-Za-z0-9_\u0080-\uFFFF](?:[A-Za-z0-9_\u0080-\uFFFF-]*[A-Za-z0-9_\u0080-\uFFFF])?$/u;
const WHOLE_NUMBER = /^\d+$/;
/**
 * Nombre o apellido ya normalizado: empieza con letra (cualquier alfabeto, con
 * sus marcas diacríticas); entre palabras un solo separador (espacio, guion,
 * apóstrofo recto o tipográfico, o punto opcionalmente seguido de espacio);
 * termina en letra o punto ("Ma. José", "Jr.").
 */
const PERSON_NAME = /^\p{L}[\p{L}\p{M}]*(?:(?:[ '\u2019-]|\. ?)\p{L}[\p{L}\p{M}]*)*\.?$/u;

/**
 * Fecha civil de hoy en Guatemala (YYYY-MM-DD), independiente de la zona
 * horaria del navegador. `en-CA` formatea las fechas como YYYY-MM-DD.
 */
export function hotelToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HOTEL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Día siguiente de una fecha civil YYYY-MM-DD. */
export function nextCalendarDay(day: string): string {
  const date = toDomainCalendarDate(day);
  date.setDate(date.getDate() + 1);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${dayOfMonth}`;
}

export function validatePhone(value: string): string | null {
  const phone = value.trim();
  if (!phone) return PHONE_REQUIRED;
  // Validación al guardar, además del filtro de escritura: solo dígitos, de 8 a 20.
  if (
    !WHOLE_NUMBER.test(phone) ||
    phone.length < PHONE_MIN_DIGITS ||
    phone.length > PHONE_MAX_DIGITS
  ) {
    return PHONE_INVALID;
  }
  return null;
}

const EMAIL_FORMAT_ERROR = 'El correo no tiene un formato válido (ejemplo: nombre@dominio.com).';

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return 'Ingresa el correo electrónico del huésped.';
  if (email.length > EMAIL_MAX_LENGTH) {
    return `El correo no puede superar ${EMAIL_MAX_LENGTH} caracteres.`;
  }
  const parts = email.split('@');
  if (parts.length !== 2) return EMAIL_FORMAT_ERROR;
  const [local, domain] = parts;
  if (local.length > EMAIL_LOCAL_MAX_LENGTH) {
    return `La parte antes de @ no puede superar ${EMAIL_LOCAL_MAX_LENGTH} caracteres.`;
  }
  if (!EMAIL_LOCAL_PART.test(local)) return EMAIL_FORMAT_ERROR;
  const labels = domain.split('.');
  if (labels.length < 2) return EMAIL_FORMAT_ERROR;
  if (labels.some((label) => label.length > EMAIL_LABEL_MAX_LENGTH)) {
    return `Cada parte del dominio puede tener como máximo ${EMAIL_LABEL_MAX_LENGTH} caracteres.`;
  }
  if (!labels.every((label) => EMAIL_DOMAIN_LABEL.test(label))) return EMAIL_FORMAT_ERROR;
  return null;
}

/**
 * Forma en que se guarda un nombre: Unicode NFC (una "é" con acento combinado
 * pasa a ser un solo carácter), espacios repetidos reducidos a uno y sin
 * espacios en los extremos. Conserva mayúsculas y minúsculas.
 */
export function normalizePersonName(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** Valida un nombre o un apellido (`label` para el mensaje: "nombre" o "apellido"). */
export function validatePersonName(value: string, label: 'nombre' | 'apellido'): string | null {
  const name = normalizePersonName(value);
  if (!name) return `Ingresa el ${label}.`;
  if (name.length > NAME_MAX_LENGTH) return NAME_TOO_LONG;
  // "Letras" incluye los separadores propios de nombres: espacio, apóstrofo, guion y punto.
  if (!PERSON_NAME.test(name)) return NAME_INVALID;
  // Tras NFC cada letra con tilde es un solo carácter \p{L}; los separadores no cuentan.
  const letters = name.match(/\p{L}/gu)?.length ?? 0;
  if (letters < NAME_MIN_LETTERS) return NAME_TOO_SHORT;
  return null;
}

export const STAY_DATES_REQUIRED = 'Las fechas de entrada y salida son obligatorias.';
export const STAY_RANGE_INVALID =
  'Rango de fechas no válido. La fecha de salida debe ser posterior a la fecha de entrada.';

/** Entrada ≥ hoy en Guatemala, salida > entrada y como máximo 90 noches. */
export function validateStayDates(
  checkIn: string,
  checkOut: string,
  today: string = hotelToday(),
): string | null {
  if (!checkIn || !checkOut) return STAY_DATES_REQUIRED;
  if (!CALENDAR_DATE.test(checkIn) || !CALENDAR_DATE.test(checkOut)) {
    return 'Formato de fecha no válido.';
  }
  // En formato YYYY-MM-DD el orden de texto coincide con el cronológico.
  if (checkIn < today) {
    return `La fecha de entrada no puede ser anterior a hoy (${formatDateGT(toDomainCalendarDate(today))}).`;
  }
  if (checkOut <= checkIn) return STAY_RANGE_INVALID;
  const nights = calculateNights(toDomainCalendarDate(checkIn), toDomainCalendarDate(checkOut));
  if (nights > MAX_STAY_NIGHTS) {
    return `La estancia no puede superar ${MAX_STAY_NIGHTS} noches (seleccionaste ${nights}).`;
  }
  return null;
}

export type GuestCountErrors = { adults?: string; children?: string; capacity?: string };

/**
 * Adultos ≥ 1 y menores ≥ 0, ambos enteros sin signo ni decimales; con
 * habitación elegida, adultos + menores no superan su capacidad (misma regla
 * que el backend).
 */
export function validateGuestCounts(
  adults: string,
  children: string,
  capacity?: number,
): GuestCountErrors {
  const errors: GuestCountErrors = {};
  const adultsValue = adults.trim();
  const childrenValue = children.trim();
  if (!adultsValue) errors.adults = ADULTS_REQUIRED;
  else if (!WHOLE_NUMBER.test(adultsValue)) errors.adults = WHOLE_NUMBER_INVALID;
  else if (Number(adultsValue) < 1) errors.adults = ADULTS_MIN;

  // El formulario convierte los menores vacíos en 0 antes de validar (normalizeChildren).
  if (!childrenValue) errors.children = 'Indica la cantidad de menores (0 si no hay).';
  else if (!WHOLE_NUMBER.test(childrenValue)) errors.children = WHOLE_NUMBER_INVALID;

  if (!errors.adults && !errors.children && capacity !== undefined) {
    const total = Number(adultsValue) + Number(childrenValue);
    if (total > capacity) {
      errors.capacity = `La habitación admite ${capacity} ${capacity === 1 ? 'huésped' : 'huéspedes'} como máximo (seleccionaste ${total}).`;
    }
  }
  return errors;
}

export function validateNotes(value: string): string | null {
  return value.length > NOTES_MAX_LENGTH ? NOTES_TOO_LONG : null;
}

// --- Editar reserva -----------------------------------------------------------
//
// Una reserva existente puede tener datos históricos que hoy no pasarían las
// reglas de Nueva reserva (entrada pasada, más de 90 noches, observaciones de
// más de 500 caracteres desde otros canales). Esas reglas solo se aplican a lo
// que el usuario cambia, para no impedir editar otros campos.

export const EDIT_CHECK_IN_REQUIRED = 'Ingresa la fecha de entrada.';
export const EDIT_CHECK_OUT_REQUIRED = 'Ingresa la fecha de salida.';
export const EDIT_DATE_INVALID = 'Fecha no válida.';
export const EDIT_CHECK_OUT_AFTER = 'La salida debe ser posterior a la entrada.';
export const EDIT_MAX_NIGHTS = `Máximo ${MAX_STAY_NIGHTS} noches.`;
export const EDIT_NOTES_OVER_LIMIT_WARNING = `Estas observaciones superan ${NOTES_MAX_LENGTH} caracteres. Se conservan sin cambios; si las editas, deberán quedar en ${NOTES_MAX_LENGTH} o menos.`;

export const EDIT_DATE_PAST = 'No puede ser anterior a hoy.';

export type EditStayErrors = { checkIn?: string; checkOut?: string };

/**
 * Fechas de Editar reserva: ambas obligatorias y con formato válido, y la
 * salida posterior a la entrada. Una fecha que el usuario cambia no puede ser
 * anterior a hoy (Guatemala); si cambió alguna, el máximo es de 90 noches. Las
 * fechas guardadas que no se tocan se conservan aunque ya hayan pasado.
 */
export function validateEditedStay(
  checkIn: string,
  checkOut: string,
  original: { checkIn: string; checkOut: string },
  today: string = hotelToday(),
): EditStayErrors {
  const errors: EditStayErrors = {};
  if (!checkIn) errors.checkIn = EDIT_CHECK_IN_REQUIRED;
  else if (!CALENDAR_DATE.test(checkIn)) errors.checkIn = EDIT_DATE_INVALID;
  if (!checkOut) errors.checkOut = EDIT_CHECK_OUT_REQUIRED;
  else if (!CALENDAR_DATE.test(checkOut)) errors.checkOut = EDIT_DATE_INVALID;
  if (errors.checkIn || errors.checkOut) return errors;

  const checkInChanged = checkIn !== original.checkIn;
  const checkOutChanged = checkOut !== original.checkOut;
  if (checkInChanged && checkIn < today) errors.checkIn = EDIT_DATE_PAST;
  if (checkOutChanged && checkOut < today) errors.checkOut = EDIT_DATE_PAST;
  if (errors.checkOut) return errors;

  if (checkOut <= checkIn) {
    errors.checkOut = EDIT_CHECK_OUT_AFTER;
  } else if (checkInChanged || checkOutChanged) {
    const nights = calculateNights(toDomainCalendarDate(checkIn), toDomainCalendarDate(checkOut));
    if (nights > MAX_STAY_NIGHTS) errors.checkOut = EDIT_MAX_NIGHTS;
  }
  return errors;
}

/** Mínimo del selector de salida: el día siguiente a la entrada, nunca antes de hoy. */
export function editCheckOutMin(checkIn: string, today: string = hotelToday()): string {
  if (!CALENDAR_DATE.test(checkIn)) return today;
  const afterCheckIn = nextCalendarDay(checkIn);
  return afterCheckIn > today ? afterCheckIn : today;
}

export const EDIT_ROOM_UNAVAILABLE = 'La habitación no está disponible en esas fechas.';

/**
 * Errores del backend al actualizar la reserva (`PUT /bookings/{id}`), con el
 * campo junto al que se muestran. El backend es quien comprueba los cruces con
 * otras reservas de la habitación (excluyendo la propia) y la capacidad.
 */
const EDIT_BACKEND_ERRORS: Record<string, { field: string; message: string }> = {
  'Room is not available for the requested dates': {
    field: 'checkOut',
    message: EDIT_ROOM_UNAVAILABLE,
  },
  'Guest count exceeds room type capacity': {
    field: 'adults',
    message: 'Supera la capacidad de la habitación.',
  },
  'Rate is not valid for the requested stay dates': {
    field: 'checkOut',
    message: 'La tarifa no aplica en esas fechas.',
  },
  'Stay does not meet the rate minimum nights': {
    field: 'checkOut',
    message: 'No cumple las noches mínimas de la tarifa.',
  },
  'Check-in date must be before check-out date': {
    field: 'checkOut',
    message: EDIT_CHECK_OUT_AFTER,
  },
  'Room is not operable for booking assignment': {
    field: 'form',
    message: 'La habitación está fuera de servicio.',
  },
  'Checked-in bookings cannot be structurally modified through the general update endpoint': {
    field: 'form',
    message: 'Con check-in solo se puede extender la salida o editar las notas.',
  },
};

export function describeEditSaveError(message: string): { field: string; message: string } {
  return EDIT_BACKEND_ERRORS[message.trim()] ?? { field: 'form', message };
}

/**
 * Observaciones de Editar reserva: si no cambiaron se conservan aunque superen
 * el límite (solo una advertencia); si cambiaron, se exige el máximo de 500.
 */
export function validateEditedNotes(
  value: string,
  original: string,
): { error: string | null; warning: string | null } {
  if (value === original) {
    return {
      error: null,
      warning: value.length > NOTES_MAX_LENGTH ? EDIT_NOTES_OVER_LIMIT_WARNING : null,
    };
  }
  return { error: validateNotes(value), warning: null };
}

// --- Disponibilidad -----------------------------------------------------------
//
// Consulta sin datos guardados: las dos fechas se validan siempre como nuevas
// (desde hoy en Guatemala, salida posterior y máximo 90 noches) y la cantidad de
// huéspedes es un entero de al menos 1, sin máximo fijo.

export const AVAIL_GUESTS_REQUIRED = 'Ingresa la cantidad de huéspedes.';
export const AVAIL_GUESTS_MIN = 'Mínimo 1 huésped.';
export const AVAIL_FIX_FIELDS = 'Corrige los campos marcados para ver la disponibilidad.';

export type AvailabilityErrors = { checkIn?: string; checkOut?: string; guests?: string };

export function isCalendarDate(value: string): boolean {
  return CALENDAR_DATE.test(value);
}

export function validateAvailabilityQuery(
  checkIn: string,
  checkOut: string,
  guests: string,
  today: string = hotelToday(),
): AvailabilityErrors {
  const errors: AvailabilityErrors = {
    ...validateEditedStay(checkIn, checkOut, { checkIn: '', checkOut: '' }, today),
  };
  if (!guests) errors.guests = AVAIL_GUESTS_REQUIRED;
  else if (!isDigitsOnly(guests)) errors.guests = WHOLE_NUMBER_INVALID;
  else if (/^0+$/.test(guests)) errors.guests = AVAIL_GUESTS_MIN;
  return errors;
}

/**
 * Aviso cuando ninguna habitación cargada admite tantos huéspedes. La cantidad
 * se muestra como la escribió el usuario (sin ceros a la izquierda): con
 * `Number` un valor enorme se vería en notación exponencial.
 */
export function availabilityCapacityMessage(guests: string, maxCapacity: number): string {
  return `Ninguna habitación admite ${guests.replace(/^0+(?=\d)/, '')} huéspedes (máximo ${maxCapacity}).`;
}
