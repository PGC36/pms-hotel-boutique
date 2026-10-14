import type { UserRole } from '@/shared/types/common';
import type { AuthSession, LoginDTO } from '@/shared/types/entities/session';

export const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administración',
  GUEST: 'Huésped',
  RECEPTION: 'Recepción',
  HOUSEKEEPING: 'Limpieza',
  CONCIERGE: 'Conserjería',
  ROOM_SERVICE: 'Room Service',
};
export type StaffRole = UserRole;
export type Permission =
  | 'dashboard:view'
  | 'reception:view'
  | 'housekeeping:view'
  | 'room-service:view'
  | 'concierge:view'
  | 'cash:view'
  | 'users:view'
  | 'rooms:manage'
  | 'occupancy:view'
  | 'front-desk:operate';

export const rolePermissions: Record<UserRole, readonly Permission[]> = {
  ADMIN: [
    'dashboard:view',
    'reception:view',
    'housekeeping:view',
    'room-service:view',
    'concierge:view',
    'cash:view',
    'users:view',
    'rooms:manage',
    'occupancy:view',
    'front-desk:operate',
  ],
  GUEST: ['dashboard:view'],
  RECEPTION: ['dashboard:view', 'reception:view', 'occupancy:view', 'front-desk:operate'],
  HOUSEKEEPING: ['dashboard:view', 'housekeeping:view'],
  CONCIERGE: ['dashboard:view', 'concierge:view'],
  ROOM_SERVICE: ['dashboard:view', 'room-service:view'],
};
export interface Session extends AuthSession {
  role: UserRole;
  permissions: readonly Permission[];
}
export type Credentials = LoginDTO;
export function hasPermission(session: Session | null, permission: Permission) {
  return (
    !!session &&
    session.expiresAt.getTime() > Date.now() &&
    session.permissions.includes(permission)
  );
}
