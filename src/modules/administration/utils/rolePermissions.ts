import type { Role } from '@/shared/types/entities/role';

const roleAccessKey = (groupName: string, item: string) => `${groupName}::${item}`;

const ROLE_ACCESS_GROUPS = [
  {
    name: 'ADMINISTRACIÓN',
    roleCodes: ['admin'],
    items: [
      'Dashboard',
      'Usuarios y roles',
      'Habitaciones',
      'Tarifas',
      'Promociones',
      'Servicios',
      'Reportes',
      'Inventario',
      'Caja',
      'Auditoría',
    ],
  },
  {
    name: 'RECEPCIÓN',
    roleCodes: ['reception'],
    items: [
      'Resumen',
      'Calendario',
      'Reservas',
      'Huéspedes',
      'Disponibilidad',
      'Habitaciones',
      'Caja',
    ],
  },
  {
    name: 'LIMPIEZA',
    roleCodes: ['housekeeping'],
    items: ['Inicio', 'Habitaciones', 'Solicitudes', 'Historial'],
  },
  {
    name: 'ROOM SERVICE',
    roleCodes: ['roomService'],
    items: ['Pedidos activos', 'Menú', 'Historial', 'Inventario'],
  },
  {
    name: 'CONSERJERÍA',
    roleCodes: ['concierge'],
    items: ['Solicitudes', 'Por habitación', 'Historial'],
  },
  {
    name: 'HUÉSPED',
    roleCodes: ['guest'],
    items: [
      'Inicio',
      'Mis reservas',
      'Mi estancia',
      'Amenidades',
      'Conserjería',
      'Limpieza y artículos',
      'Room service',
      'Mis solicitudes y pedidos',
      'Notificaciones',
    ],
  },
] as const;

const ALL_PERMISSIONS = ROLE_ACCESS_GROUPS.flatMap((group) =>
  group.items.map((item) => roleAccessKey(group.name, item)),
);
const ADMIN_ACCESS_GROUP_NAME = 'ADMINISTRACIÓN';
const ADMIN_ACCESS_PERMISSION_KEYS =
  ROLE_ACCESS_GROUPS.find((group) => group.name === ADMIN_ACCESS_GROUP_NAME)?.items.map((item) =>
    roleAccessKey(ADMIN_ACCESS_GROUP_NAME, item),
  ) ?? [];

const backendPermissionsByAccessKey: Record<string, string[]> = {
  [roleAccessKey('ADMINISTRACIÓN', 'Dashboard')]: ['bookings.read', 'rooms.read', 'cash.read'],
  [roleAccessKey('ADMINISTRACIÓN', 'Usuarios y roles')]: [],
  [roleAccessKey('ADMINISTRACIÓN', 'Habitaciones')]: [
    'rooms.read',
    'rooms.write',
    'room-types.read',
    'room-types.write',
    'room-features.read',
  ],
  [roleAccessKey('ADMINISTRACIÓN', 'Tarifas')]: ['rates.read', 'rates.write'],
  [roleAccessKey('ADMINISTRACIÓN', 'Promociones')]: ['rates.read', 'rates.write'],
  [roleAccessKey('ADMINISTRACIÓN', 'Servicios')]: [
    'room-service.read',
    'room-service.write',
    'concierge.read',
    'concierge.write',
    'housekeeping.read',
  ],
  [roleAccessKey('ADMINISTRACIÓN', 'Reportes')]: [
    'bookings.read',
    'cash.read',
    'payments.read',
    'deposits.read',
    'charges.read',
  ],
  [roleAccessKey('ADMINISTRACIÓN', 'Inventario')]: ['inventory.read', 'inventory.write'],
  [roleAccessKey('ADMINISTRACIÓN', 'Caja')]: ['cash.read', 'cash.write'],
  [roleAccessKey('ADMINISTRACIÓN', 'Auditoría')]: [],
  [roleAccessKey('RECEPCIÓN', 'Resumen')]: ['bookings.read', 'guests.read', 'rooms.read'],
  [roleAccessKey('RECEPCIÓN', 'Calendario')]: ['bookings.read', 'rooms.read'],
  [roleAccessKey('RECEPCIÓN', 'Reservas')]: ['bookings.read', 'bookings.write'],
  [roleAccessKey('RECEPCIÓN', 'Huéspedes')]: ['guests.read', 'guests.write'],
  [roleAccessKey('RECEPCIÓN', 'Disponibilidad')]: ['rooms.read', 'rates.read'],
  [roleAccessKey('RECEPCIÓN', 'Habitaciones')]: ['rooms.read'],
  [roleAccessKey('RECEPCIÓN', 'Caja')]: ['cash.read', 'cash.write'],
  [roleAccessKey('LIMPIEZA', 'Inicio')]: ['housekeeping.read'],
  [roleAccessKey('LIMPIEZA', 'Habitaciones')]: ['housekeeping.read', 'rooms.read'],
  [roleAccessKey('LIMPIEZA', 'Solicitudes')]: ['housekeeping.read', 'housekeeping.write'],
  [roleAccessKey('LIMPIEZA', 'Historial')]: ['housekeeping.read'],
  [roleAccessKey('ROOM SERVICE', 'Pedidos activos')]: ['room-service.read', 'room-service.write'],
  [roleAccessKey('ROOM SERVICE', 'Menú')]: ['room-service.read'],
  [roleAccessKey('ROOM SERVICE', 'Historial')]: ['room-service.read'],
  [roleAccessKey('ROOM SERVICE', 'Inventario')]: ['inventory.read'],
  [roleAccessKey('CONSERJERÍA', 'Solicitudes')]: ['concierge.read', 'concierge.write'],
  [roleAccessKey('CONSERJERÍA', 'Por habitación')]: ['concierge.read', 'bookings.read'],
  [roleAccessKey('CONSERJERÍA', 'Historial')]: ['concierge.read'],
  [roleAccessKey('HUÉSPED', 'Inicio')]: ['guest-portal.home'],
  [roleAccessKey('HUÉSPED', 'Mis reservas')]: ['guest-portal.reservations'],
  [roleAccessKey('HUÉSPED', 'Mi estancia')]: ['guest-portal.stay'],
  [roleAccessKey('HUÉSPED', 'Amenidades')]: ['guest-portal.amenities'],
  [roleAccessKey('HUÉSPED', 'Conserjería')]: ['guest-portal.requests'],
  [roleAccessKey('HUÉSPED', 'Limpieza y artículos')]: ['guest-portal.services'],
  [roleAccessKey('HUÉSPED', 'Room service')]: ['guest-portal.room-service'],
  [roleAccessKey('HUÉSPED', 'Mis solicitudes y pedidos')]: ['guest-portal.requests'],
  [roleAccessKey('HUÉSPED', 'Notificaciones')]: ['guest-portal.notifications'],
};

const adminNavigationPermissionByAccessKey: Record<string, string> = {
  [roleAccessKey('RECEPCIÓN', 'Resumen')]: 'admin-nav.reception.summary',
  [roleAccessKey('RECEPCIÓN', 'Calendario')]: 'admin-nav.reception.calendar',
  [roleAccessKey('RECEPCIÓN', 'Reservas')]: 'admin-nav.reception.reservations',
  [roleAccessKey('RECEPCIÓN', 'Huéspedes')]: 'admin-nav.reception.guests',
  [roleAccessKey('RECEPCIÓN', 'Disponibilidad')]: 'admin-nav.reception.availability',
  [roleAccessKey('RECEPCIÓN', 'Habitaciones')]: 'admin-nav.reception.rooms',
  [roleAccessKey('RECEPCIÓN', 'Caja')]: 'admin-nav.reception.cash',
  [roleAccessKey('LIMPIEZA', 'Inicio')]: 'admin-nav.housekeeping.home',
  [roleAccessKey('LIMPIEZA', 'Habitaciones')]: 'admin-nav.housekeeping.rooms',
  [roleAccessKey('LIMPIEZA', 'Solicitudes')]: 'admin-nav.housekeeping.requests',
  [roleAccessKey('LIMPIEZA', 'Historial')]: 'admin-nav.housekeeping.history',
  [roleAccessKey('ROOM SERVICE', 'Pedidos activos')]: 'admin-nav.room-service.orders',
  [roleAccessKey('ROOM SERVICE', 'Menú')]: 'admin-nav.room-service.menu',
  [roleAccessKey('ROOM SERVICE', 'Historial')]: 'admin-nav.room-service.history',
  [roleAccessKey('ROOM SERVICE', 'Inventario')]: 'admin-nav.room-service.inventory',
  [roleAccessKey('CONSERJERÍA', 'Solicitudes')]: 'admin-nav.concierge.requests',
  [roleAccessKey('CONSERJERÍA', 'Por habitación')]: 'admin-nav.concierge.by-room',
  [roleAccessKey('CONSERJERÍA', 'Historial')]: 'admin-nav.concierge.history',
  [roleAccessKey('HUÉSPED', 'Inicio')]: 'admin-nav.guest.home',
  [roleAccessKey('HUÉSPED', 'Mis reservas')]: 'admin-nav.guest.reservations',
  [roleAccessKey('HUÉSPED', 'Mi estancia')]: 'admin-nav.guest.stay',
  [roleAccessKey('HUÉSPED', 'Amenidades')]: 'admin-nav.guest.amenities',
  [roleAccessKey('HUÉSPED', 'Conserjería')]: 'admin-nav.guest.concierge',
  [roleAccessKey('HUÉSPED', 'Limpieza y artículos')]: 'admin-nav.guest.services',
  [roleAccessKey('HUÉSPED', 'Room service')]: 'admin-nav.guest.room-service',
  [roleAccessKey('HUÉSPED', 'Mis solicitudes y pedidos')]: 'admin-nav.guest.requests',
  [roleAccessKey('HUÉSPED', 'Notificaciones')]: 'admin-nav.guest.notifications',
};

const withFixedAdminPermissions = (permissions: Record<string, boolean>) => ({
  ...permissions,
  ...Object.fromEntries(ADMIN_ACCESS_PERMISSION_KEYS.map((key) => [key, true])),
});

const normalizeRoleCode = (code: string) => (code === 'room_service' ? 'roomService' : code);

const getRoleDashboardPermissions = (roleCode: string) => {
  const normalized = normalizeRoleCode(roleCode);
  return Object.fromEntries(
    ROLE_ACCESS_GROUPS.flatMap((group) =>
      group.items.map((item) => [
        roleAccessKey(group.name, item),
        normalized === 'admin' || (group.roleCodes as readonly string[]).includes(normalized),
      ]),
    ),
  ) as Record<string, boolean>;
};

const uiPermissionsFromBackend = (role: Role): Record<string, boolean> => {
  if (role.permissionIds.length === 0) {
    const fallbackPermissions = getRoleDashboardPermissions(role.code);
    return normalizeRoleCode(role.code) === 'admin'
      ? withFixedAdminPermissions(fallbackPermissions)
      : fallbackPermissions;
  }
  const granted = new Set(role.permissionIds);
  if (normalizeRoleCode(role.code) === 'admin') {
    return withFixedAdminPermissions(
      Object.fromEntries(
        ALL_PERMISSIONS.map((key) => {
          const permission = adminNavigationPermissionByAccessKey[key];
          return [key, permission ? granted.has(permission) : false];
        }),
      ),
    );
  }
  const permissions = Object.fromEntries(
    ALL_PERMISSIONS.map((key) => {
      const backendKeys = backendPermissionsByAccessKey[key] ?? [];
      return [
        key,
        backendKeys.length === 0 ? false : backendKeys.some((item) => granted.has(item)),
      ];
    }),
  ) as Record<string, boolean>;
  return permissions;
};

export const rolePermissionsFromBackendRoles = (roles: Role[]) =>
  Object.fromEntries(
    roles.map((role) => [normalizeRoleCode(role.code), uiPermissionsFromBackend(role)]),
  ) as Record<string, Record<string, boolean>>;
