import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PrivatePage } from '@/private/page';
import { routePaths } from '@/app/routes';
import { useAuth } from '@/modules/auth/components/auth-context';
import { roleLabels } from '@/modules/auth/models/session';
import { getNavigation } from '@/private/routes/navigation';

export function PrivateLayout() {
  const { session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  if (!session) return null;
  const navigation = getNavigation(session);
  const pathname = location.pathname.replace(/\/$/, '').toLowerCase();
  const activeItem =
    navigation.find(
      (item) =>
        pathname === item.path ||
        pathname.startsWith(`${item.path}/`) ||
        (pathname === routePaths.pms.root && item.path === routePaths.pms.dashboard),
    )?.label ?? '';

  return (
    <PrivatePage
      activeItem={activeItem}
      menuItems={navigation.map((item) => item.label)}
      onNavigate={(label) => {
        const item = navigation.find((entry) => entry.label === label);
        if (item) navigate(item.path);
      }}
      sessionLabel={`${session.user.name} · ${roleLabels[session.role]}`}
      sessionEmail={session.user.email}
      onLogout={() => {
        navigate(routePaths.public.home, { replace: true, flushSync: true });
        logout();
      }}
    >
      <Outlet />
    </PrivatePage>
  );
}
