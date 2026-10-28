/**
 * Validaciones genéricas de campos de formulario (textos obligatorios, montos,
 * cantidades enteras y rangos de fechas). Cada función devuelve el mensaje de
 * error en español o `null` si el valor es válido. No definen reglas de
 * negocio: los límites concretos los pasa cada formulario (los del backend
 * cuando existen). Nombres, teléfonos y correos de huéspedes usan las reglas
 * aprobadas de `modules/front-desk/utils/reservationFormValidation.ts`.
 */

/** Mayor entero de las columnas `Integer` del backend (Java int). Límite técnico, no de negocio. */
export const MAX_WHOLE_NUMBER = 2_147_483_647;

const DIGITS_ONLY = /^\d*$/;
const PERSON_NAME_INPUT = /[^\p{L}\p{M} '’-]/gu;
/** Monto en edición: dígitos con punto decimal opcional y como máximo 2 decimales. */
const MONEY_TYPING = /^\d*(?:\.\d{0,2})?$/;
const MONEY_VALUE = /^\d+(?:\.\d{1,2})?$|^\.\d{1,2}$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const REQUIRED_FIELD = 'Este campo es obligatorio.';
export const WHOLE_NUMBER_INVALID = 'Ingresa un número entero.';
export const NUMBER_TOO_LARGE = 'El número es demasiado grande.';
export const MONEY_REQUIRED = 'Ingresa el monto.';
export const MONEY_INVALID = 'Ingresa un monto válido (hasta 2 decimales).';
export const MONEY_POSITIVE = 'El monto debe ser mayor a 0.';
export const MONEY_TOO_LARGE = 'El monto es demasiado grande.';
export const DATE_REQUIRED = 'Ingresa la fecha.';
export const DATE_INVALID = 'Fecha no válida.';

export const maxLengthMessage = (max: number) => `Máximo ${max} caracteres.`;

/**
 * Filtro de escritura para cantidades enteras: acepta el cambio solo si son
 * dígitos 0–9 (o vacío). Signos, letras, decimales, espacios y notación
 * científica se rechazan y el campo conserva el valor anterior.
 */
export function isWholeNumberInput(value: string): boolean {
  return DIGITS_ONLY.test(value);
}

/** Conserva letras Unicode y separadores válidos de nombres al escribir o pegar. */
export function keepPersonNameCharacters(value: string): string {
  return value.normalize('NFC').replace(PERSON_NAME_INPUT, '');
}

/** Conserva únicamente los dígitos ASCII de un documento o teléfono numérico. */
export function keepDigits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/** Filtro de escritura para montos: dígitos y como máximo un punto con 2 decimales. */
export function isMoneyInput(value: string): boolean {
  return MONEY_TYPING.test(value);
}

/** Texto obligatorio: rechaza vacío o solo espacios y, si se indica, más de `maxLength` caracteres. */
export function validateRequiredText(
  value: string,
  requiredMessage: string = REQUIRED_FIELD,
  maxLength?: number,
): string | null {
  const text = value.trim();
  if (!text) return requiredMessage;
  if (maxLength !== undefined && text.length > maxLength) return maxLengthMessage(maxLength);
  return null;
}

/** Texto opcional con límite de longitud (sin contar los espacios exteriores). */
export function validateOptionalText(value: string, maxLength: number): string | null {
  return value.trim().length > maxLength ? maxLengthMessage(maxLength) : null;
}

export type WholeNumberRules = {
  min?: number;
  max?: number;
  requiredMessage?: string;
  minMessage?: string;
  maxMessage?: string;
};

/** Cantidad entera sin signo ni decimales, dentro de `min`/`max` (vacío nunca equivale a 0). */
export function validateWholeNumber(value: string, rules: WholeNumberRules = {}): string | null {
  const text = value.trim();
  if (!text) return rules.requiredMessage ?? REQUIRED_FIELD;
  if (!/^\d+$/.test(text)) return WHOLE_NUMBER_INVALID;
  const number = Number(text);
  if (number > MAX_WHOLE_NUMBER) return NUMBER_TOO_LARGE;
  if (rules.min !== undefined && number < rules.min) {
    return rules.minMessage ?? `El valor mínimo es ${rules.min}.`;
  }
  if (rules.max !== undefined && number > rules.max) {
    return rules.maxMessage ?? `El valor máximo es ${rules.max}.`;
  }
  return null;
}

/**
 * Convierte un monto escrito ("1250", "1250.5", "1250.50") a centavos enteros
 * sin pasar por coma flotante. Devuelve `null` si el texto no es un monto
 * válido o si los centavos no caben en un entero seguro.
 */
export function moneyInputToCents(value: string): number | null {
  const text = value.trim();
  if (!MONEY_VALUE.test(text)) return null;
  const [whole = '', decimals = ''] = text.split('.');
  const cents = Number(whole || '0') * 100 + Number(decimals.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export type MoneyRules = { allowZero?: boolean; requiredMessage?: string };

/** Monto monetario positivo (o cero si `allowZero`), con hasta 2 decimales y sin notación científica. */
export function validateMoneyAmount(value: string, rules: MoneyRules = {}): string | null {
  const text = value.trim();
  if (!text) return rules.requiredMessage ?? MONEY_REQUIRED;
  if (!MONEY_VALUE.test(text)) return MONEY_INVALID;
  const cents = moneyInputToCents(text);
  if (cents === null) return MONEY_TOO_LARGE;
  if (cents === 0 && !rules.allowZero) return MONEY_POSITIVE;
  return null;
}

/** Monto guardado (en quetzales) como texto editable, sin notación exponencial. */
export function amountToMoneyInput(amount: number): string {
  return Number.isFinite(amount) ? String(Math.round(amount * 100) / 100) : '';
}

export function isCalendarDateValue(value: string): boolean {
  return CALENDAR_DATE.test(value);
}

export type DateRangeErrors = { start?: string; end?: string };

/**
 * Rango de fechas civiles YYYY-MM-DD: ambas obligatorias y la final no anterior
 * a la inicial (`allowSameDay`) o estrictamente posterior. No limita fechas
 * pasadas ni la duración: eso lo decide cada formulario.
 */
export function validateDateRange(
  start: string,
  end: string,
  { allowSameDay = true, endMessage }: { allowSameDay?: boolean; endMessage?: string } = {},
): DateRangeErrors {
  const errors: DateRangeErrors = {};
  if (!start) errors.start = DATE_REQUIRED;
  else if (!CALENDAR_DATE.test(start)) errors.start = DATE_INVALID;
  if (!end) errors.end = DATE_REQUIRED;
  else if (!CALENDAR_DATE.test(end)) errors.end = DATE_INVALID;
  if (errors.start || errors.end) return errors;
  // En formato YYYY-MM-DD el orden de texto coincide con el cronológico.
  if (allowSameDay ? end < start : end <= start) {
    errors.end =
      endMessage ??
      (allowSameDay
        ? 'La fecha final no puede ser anterior a la inicial.'
        : 'La fecha final debe ser posterior a la inicial.');
  }
  return errors;
}

/**
 * Nombre o apellido de una persona (empleados, acompañantes): letras Unicode
 * (con tildes, ñ y marcas combinadas) en palabras separadas por un único
 * espacio, guion o apóstrofo entre letras. Rechaza números, emojis, símbolos,
 * caracteres de control y separadores repetidos o en los extremos.
 */
const PERSON_NAME_PART = /^\p{L}[\p{L}\p{M}]*(?:[ '’-]\p{L}[\p{L}\p{M}]*)*$/u;

export const PERSON_NAME_CHARACTERS =
  'Solo se permiten letras, con espacios, guiones o apóstrofos entre ellas.';

/** Forma en que se guarda: Unicode NFC y espacios interiores reducidos a uno. */
export function normalizePersonNamePart(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/**
 * Valida un nombre o apellido sin límites de longitud propios: los de Nueva y
 * Editar reserva (3–20) siguen en `reservationFormValidation`. No elimina
 * caracteres inválidos: los informa.
 */
export function validatePersonNamePart(value: string, label: 'nombre' | 'apellido'): string | null {
  const name = normalizePersonNamePart(value);
  if (!name) return `Ingresa el ${label}.`;
  return PERSON_NAME_PART.test(name) ? null : PERSON_NAME_CHARACTERS;
}

/**
 * Atributos de accesibilidad de un campo con mensaje de error: lo marca como
 * inválido y lo asocia al mensaje (`id`) solo cuando hay error.
 */
export function fieldErrorProps(id: string, error?: string | null) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? id : undefined,
  } as const;
}

export function hasErrors(errors: Record<string, string | null | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
