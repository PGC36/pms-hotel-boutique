import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { useAuth } from '@/modules/auth/components/auth-context';
import { hasPermission, type Permission } from '@/modules/auth/models/session';

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children?: ReactNode;
}) {
  const { session } = useAuth();
  if (hasPermission(session, permission)) return children ?? <Outlet />;
  return (
    <section className="content">
      <p className="eyebrow">Acceso restringido</p>
      <h1>No tienes permiso para ver esta sección</h1>
      <Link className="button secondary" to={routePaths.pms.dashboard}>
        Volver al panel operativo
      </Link>
    </section>
  );
}
