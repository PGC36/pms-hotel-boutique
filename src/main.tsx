import { StrictMode, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router.tsx';
import './index.css';
import { AuthProvider } from '@/modules/auth/components/AuthProvider';
import { AppErrorBoundary } from '@/app/observability/AppErrorBoundary';

type ErrorBoundary = ComponentType<{ children: ReactNode }>;

function render(Boundary: ErrorBoundary) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Boundary>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </Boundary>
    </StrictMode>,
  );
}

// Sentry solo existe en el bundle si el build tiene VITE_SENTRY_DSN (Vite reemplaza la
// variable por su valor y el import() muerto se elimina). Ver docs/sentry.md.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  import('@/app/observability/sentry').then(
    ({ initSentry, SentryErrorBoundary }) => {
      initSentry(sentryDsn);
      render(SentryErrorBoundary);
    },
    () => render(AppErrorBoundary),
  );
} else {
  render(AppErrorBoundary);
}
