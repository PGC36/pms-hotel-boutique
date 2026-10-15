/**
 * Puente entre la app y Sentry. Sentry se carga aparte (import dinámico en main.tsx) y
 * solo si hay DSN: el resto del código reporta por aquí sin importar el SDK.
 * Sin DSN, reportError no hace nada.
 */
type ErrorReporter = (error: unknown) => void;

let reporter: ErrorReporter | null = null;

export function setErrorReporter(next: ErrorReporter | null) {
  reporter = next;
}

export function reportError(error: unknown) {
  reporter?.(error);
}
