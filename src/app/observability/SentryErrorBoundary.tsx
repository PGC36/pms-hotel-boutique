import * as Sentry from '@sentry/react';
import type { ReactNode } from 'react';
import { AppErrorFallback } from './AppErrorFallback';

/** Error boundary de Sentry: reporta el error con el árbol de componentes y muestra la pantalla amable. */
export function SentryErrorBoundary({ children }: { children: ReactNode }) {
  return <Sentry.ErrorBoundary fallback={<AppErrorFallback />}>{children}</Sentry.ErrorBoundary>;
}
