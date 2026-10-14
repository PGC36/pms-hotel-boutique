import type { AuthSession } from '@/shared/types/entities/session';
import { rolePermissions, type Permission, type Session } from '@/modules/auth/models/session';

const backendPermissionMap: Record<string, Permission[]> = {
  'bookings.read': ['dashboard:view', 'reception:view', 'occupancy:view'],
  'bookings.write': ['reception:view', 'front-desk:operate'],
  'bookings.check-in': ['reception:view', 'front-desk:operate'],
  'bookings.check-out': ['reception:view', 'front-desk:operate'],
  'housekeeping.read': ['housekeeping:view'],
  'room-service.read': ['room-service:view'],
  'concierge.read': ['concierge:view'],
  'cash.read': ['cash:view'],
  'rooms.read': ['rooms:manage'],
  'rooms.write': ['rooms:manage'],
};

function permissionsFromAuthorities(session: AuthSession): Permission[] {
  if (session.authorities.includes('ROLE_ADMIN')) return [...rolePermissions.ADMIN];
  const mapped = session.authorities.flatMap((authority) => backendPermissionMap[authority] ?? []);
  return [...new Set([...rolePermissions[session.user.role], ...mapped])];
}

export function toSession(session: AuthSession): Session {
  return {
    ...session,
    role: session.user.role,
    permissions: permissionsFromAuthorities(session),
  };
}
