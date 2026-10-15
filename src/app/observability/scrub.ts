import type { Breadcrumb, ErrorEvent } from '@sentry/react';

/**
 * Limpieza de los eventos antes de enviarlos a Sentry (beforeSend / beforeBreadcrumb).
 * Sin dependencias de runtime de Sentry: así se prueba sin cargar el SDK
 * (scripts/test-sentry-scrub.mjs).
 *
 * Qué se quita:
 * - cabeceras Authorization y Cookie, cookies y cuerpos de petición;
 * - JWT, "Bearer …", correos y códigos de vinculación de reserva (GL-XXXXXXXX)
 *   en cualquier texto (mensajes, excepciones, breadcrumbs, extras);
 * - parámetros de query con nombres sensibles (token, code, password, email…);
 * - claves de objetos con nombres sensibles, a cualquier profundidad;
 * - el usuario del evento (no se envía ni se infiere la IP).
 */

export const FILTERED = '[Filtered]';

const SENSITIVE_KEY =
  /authorization|cookie|passw|secret|token|jwt|api[-_]?key|credential|signature|^code$|link[-_]?code|^body$|request[-_]?body|^email$/i;
const SENSITIVE_PARAM =
  /token|code|passw|secret|key|auth|session|jwt|email|correo|signature|otp|pin/i;

const TEXT_PATTERNS: [RegExp, string][] = [
  [/Bearer\s+[\w.~+/=-]+/gi, `Bearer ${FILTERED}`],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]*/g, FILTERED],
  [/\bGL-[A-Z0-9]{4,16}\b/gi, FILTERED],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, FILTERED],
];

const MAX_DEPTH = 8;

/** Quita tokens, correos y códigos de reserva de un texto libre, y los parámetros sensibles de sus URL. */
export function scrubText(text: string): string {
  let result = text.replace(
    /([?&#;])([^=&#\s"']+)=([^&#\s"']*)/g,
    (match, separator: string, name: string) =>
      SENSITIVE_PARAM.test(decodeSafe(name)) ? `${separator}${name}=${FILTERED}` : match,
  );
  for (const [pattern, replacement] of TEXT_PATTERNS) result = result.replace(pattern, replacement);
  return result;
}

/** Recorre un valor y limpia textos y claves sensibles. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return FILTERED;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? FILTERED : scrubValue(item, depth + 1);
  }
  return result;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: breadcrumb.message === undefined ? undefined : scrubText(breadcrumb.message),
    data: breadcrumb.data && (scrubValue(breadcrumb.data) as Breadcrumb['data']),
  };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event, user: undefined };

  if (event.request) {
    const request = { ...event.request };
    delete request.cookies;
    delete request.data;
    scrubbed.request = scrubValue(request) as ErrorEvent['request'];
  }
  if (event.message) scrubbed.message = scrubText(event.message);
  if (event.exception?.values) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map((exception) => ({
        ...exception,
        value: exception.value === undefined ? undefined : scrubText(exception.value),
      })),
    };
  }
  if (event.breadcrumbs) scrubbed.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  if (event.extra) scrubbed.extra = scrubValue(event.extra) as ErrorEvent['extra'];
  if (event.contexts) scrubbed.contexts = scrubValue(event.contexts) as ErrorEvent['contexts'];
  if (event.tags) scrubbed.tags = scrubValue(event.tags) as ErrorEvent['tags'];
  if (event.transaction) scrubbed.transaction = scrubText(event.transaction);
  return scrubbed;
}

function decodeSafe(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
