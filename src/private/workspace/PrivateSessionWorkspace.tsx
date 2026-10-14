import { useNavigate } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { useAuth } from '@/modules/auth/components/auth-context';
import { roleLabels } from '@/modules/auth/models/session';
import { PrivateWorkspace, type RoleId } from '@/private/workspace/PrivateWorkspace';
import type { UserRole } from '@/shared/types/common';

const roleMap: Record<UserRole, RoleId> = {
  ADMIN: 'admin',
  GUEST: 'guest',
  RECEPTION: 'reception',
  HOUSEKEEPING: 'housekeeping',
  CONCIERGE: 'concierge',
  ROOM_SERVICE: 'room-service',
};

type PrivateSessionWorkspaceProps = {
  role?: RoleId;
  initialNav?: string;
};

export function PrivateSessionWorkspace({ role, initialNav }: PrivateSessionWorkspaceProps) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  if (!session) return null;

  return (
    <PrivateWorkspace
      role={role ?? roleMap[session.role]}
      initialNav={initialNav}
      sessionName={session.user.name}
      sessionEmail={session.user.email}
      sessionUserId={session.user.id}
      sessionRoleLabel={roleLabels[session.role]}
      onLogout={() => {
        navigate(routePaths.public.home, { replace: true, flushSync: true });
        logout();
      }}
    />
  );
}
