import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { useAuth } from '@/modules/auth/components/auth-context';
import { SessionStatus } from '@/modules/auth/components/SessionStatus';
import { authService } from '@/modules/auth/services/auth-service';

export function RequireSession() {
  const { session, isLoading, error } = useAuth();
  const location = useLocation();
  if (isLoading || error) return <SessionStatus />;
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    // Un huésped cuyo acceso venció vuelve a su pantalla de código, no al login del personal.
    if (session?.role === 'GUEST' || authService.isGuestAccessExpired()) {
      return <Navigate to={routePaths.public.register} replace state={{ guestExpired: true }} />;
    }
    return (
      <Navigate
        to={routePaths.public.login}
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  }
  return <Outlet />;
}
