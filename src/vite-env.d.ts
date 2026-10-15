/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** DSN del proyecto de Sentry. Sin él, Sentry no se carga (docs/sentry.md). */
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** SHA del commit; lo pasa la CI como ARG del Dockerfile. */
  readonly VITE_SENTRY_RELEASE?: string;
}
