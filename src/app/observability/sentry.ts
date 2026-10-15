import * as Sentry from '@sentry/react';
import { setErrorReporter } from './error-reporting';
import { scrubBreadcrumb, scrubEvent } from './scrub';

export { SentryErrorBoundary } from './SentryErrorBoundary';

/**
 * Se carga con import() desde main.tsx solo si el build tiene VITE_SENTRY_DSN; sin DSN
 * este módulo (y el SDK) ni siquiera entra al bundle. Ver docs/sentry.md.
 */
export function initSentry(dsn: string) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    // SHA del commit (ARG del Dockerfile). Si falta, el plugin de Vite inyecta el suyo.
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    // Equivale a sendDefaultPii: false, que el SDK 11 reemplazó por dataCollection.
    // userInfo: false además le pide a Sentry no inferir la IP (infer_ip: never).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
      httpBodies: [],
      stackFrameVariables: false,
    },
    // Solo errores: sin trazas de rendimiento ni Session Replay (ver docs/sentry.md).
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
  setErrorReporter((error) => Sentry.captureException(error));
}
