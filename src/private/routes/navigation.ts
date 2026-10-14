import { routePaths } from '@/app/routes';
import { hasPermission, type Permission, type Session } from '@/modules/auth/models/session';

/**
 * privateNavigation alimenta el layout PMS clasico. Los workspaces Bolt
 * migrados de Limpieza, Room Service y Conserjeria entran por rutas dedicadas
 * en router.ts para conservar sus menus internos por rol.
 */
export const privateNavigation: { label: string; path: string; permission: Permission }[] = [
  { label: 'Panel operativo', path: routePaths.pms.dashboard, permission: 'dashboard:view' },
  { label: 'Recepción', path: routePaths.pms.reception, permission: 'reception:view' },
  { label: 'Caja', path: routePaths.pms.cash, permission: 'cash:view' },
  { label: 'Usuarios', path: routePaths.pms.users, permission: 'users:view' },
  { label: 'Habitaciones', path: routePaths.pms.rooms, permission: 'rooms:manage' },
  { label: 'Tipos de habitación', path: routePaths.pms.roomTypes, permission: 'rooms:manage' },
  { label: 'Ocupación', path: routePaths.pms.occupancy, permission: 'occupancy:view' },
];

export function getNavigation(session: Session | null) {
  return privateNavigation.filter((item) => hasPermission(session, item.permission));
}

const defaultDestinationByRole: Record<Session['role'], string> = {
  ADMIN: routePaths.pms.dashboard,
  GUEST: routePaths.pms.dashboard,
  RECEPTION: routePaths.pms.reception,
  HOUSEKEEPING: routePaths.pms.housekeeping,
  CONCIERGE: routePaths.pms.concierge,
  ROOM_SERVICE: routePaths.pms.roomService,
};

export function getLoginDestination(from: unknown, session?: Session | null) {
  if (typeof from === 'string' && !from.includes('\\')) {
    try {
      const base = 'https://hotel.invalid';
      const url = new URL(from, base);
      if (
        url.origin === base &&
        (url.pathname === routePaths.pms.root || url.pathname.startsWith(`${routePaths.pms.root}/`))
      ) {
        return url.pathname + url.search + url.hash;
      }
    } catch {
      /* An invalid destination falls back to the dashboard. */
    }
  }
  return session ? defaultDestinationByRole[session.role] : routePaths.pms.dashboard;
}
