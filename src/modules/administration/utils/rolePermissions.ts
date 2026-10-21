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

/**
 * Permisos de datos que concede cada sección al guardar un rol (P5). Parten de los de
 * detección y agregan lo que la pantalla necesita para operar. Con todas sus secciones,
 * Limpieza equivale al rol predefinido `housekeeping`, y Recepción a `reception` sin
 * Room Service, Conserjería ni solicitudes internas, que su panel no usa (#177).
 */
const operationalGrantsByAccessKey: Record<string, string[]> = {
  ...backendPermissionsByAccessKey,
  [roleAccessKey('RECEPCIÓN', 'Resumen')]: [
    'bookings.read',
    'guests.read',
    'rooms.read',
    'room-types.read',
    'room-features.read',
  ],
  [roleAccessKey('RECEPCIÓN', 'Calendario')]: ['bookings.read', 'rooms.read', 'room-types.read'],
  [roleAccessKey('RECEPCIÓN', 'Reservas')]: [
    'bookings.read',
    'bookings.write',
    'bookings.check-in',
    'bookings.check-out',
    'booking-companions.read',
    'booking-companions.write',
    'guests.read',
    'guests.write',
    'rooms.read',
    'rates.read',
    'folios.read',
    'folios.write',
    'charges.read',
    'payments.read',
    'deposits.read',
  ],
  [roleAccessKey('RECEPCIÓN', 'Disponibilidad')]: [
    'rooms.read',
    'rates.read',
    'room-types.read',
    'room-features.read',
  ],
  [roleAccessKey('RECEPCIÓN', 'Habitaciones')]: [
    'rooms.read',
    'room-types.read',
    'room-features.read',
  ],
  [roleAccessKey('RECEPCIÓN', 'Caja')]: [
    'cash.read',
    'cash.write',
    'bookings.read',
    'guests.read',
    'folios.read',
    'folios.write',
    'charges.read',
    'charges.write',
    'payments.read',
    'payments.write',
    'deposits.read',
    'deposits.write',
  ],
  // "Reportar desperfecto" vive en Inicio y crea la solicitud en /service-requests.
  [roleAccessKey('LIMPIEZA', 'Inicio')]: [
    'housekeeping.read',
    'service-requests.read',
    'service-requests.write',
  ],
  [roleAccessKey('LIMPIEZA', 'Habitaciones')]: [
    'housekeeping.read',
    'housekeeping.write',
    'rooms.read',
  ],
  [roleAccessKey('LIMPIEZA', 'Solicitudes')]: [
    'housekeeping.read',
    'housekeeping.write',
    'service-requests.read',
    'service-requests.write',
  ],
  [roleAccessKey('LIMPIEZA', 'Historial')]: ['housekeeping.read', 'service-requests.read'],
};

const adminNavigationPermissionByAccessKey: Record<string, string> = {
  [roleAccessKey('ADMINISTRACIÓN', 'Dashboard')]: 'navigation.administracion.dashboard',
  [roleAccessKey('ADMINISTRACIÓN', 'Usuarios y roles')]:
    'navigation.administracion.usuarios-y-roles',
  [roleAccessKey('ADMINISTRACIÓN', 'Habitaciones')]: 'navigation.administracion.habitaciones',
  [roleAccessKey('ADMINISTRACIÓN', 'Tarifas')]: 'navigation.administracion.tarifas',
  [roleAccessKey('ADMINISTRACIÓN', 'Promociones')]: 'navigation.administracion.promociones',
  [roleAccessKey('ADMINISTRACIÓN', 'Servicios')]: 'navigation.administracion.servicios',
  [roleAccessKey('ADMINISTRACIÓN', 'Reportes')]: 'navigation.administracion.reportes',
  [roleAccessKey('ADMINISTRACIÓN', 'Inventario')]: 'navigation.administracion.inventario',
  [roleAccessKey('ADMINISTRACIÓN', 'Caja')]: 'navigation.administracion.caja',
  [roleAccessKey('ADMINISTRACIÓN', 'Auditoría')]: 'navigation.administracion.auditoria',
  [roleAccessKey('RECEPCIÓN', 'Resumen')]: 'navigation.recepcion.resumen',
  [roleAccessKey('RECEPCIÓN', 'Calendario')]: 'navigation.recepcion.calendario',
  [roleAccessKey('RECEPCIÓN', 'Reservas')]: 'navigation.recepcion.reservas',
  [roleAccessKey('RECEPCIÓN', 'Huéspedes')]: 'navigation.recepcion.huespedes',
  [roleAccessKey('RECEPCIÓN', 'Disponibilidad')]: 'navigation.recepcion.disponibilidad',
  [roleAccessKey('RECEPCIÓN', 'Habitaciones')]: 'navigation.recepcion.habitaciones',
  [roleAccessKey('RECEPCIÓN', 'Caja')]: 'navigation.recepcion.caja',
  [roleAccessKey('LIMPIEZA', 'Inicio')]: 'navigation.limpieza.inicio',
  [roleAccessKey('LIMPIEZA', 'Habitaciones')]: 'navigation.limpieza.habitaciones',
  [roleAccessKey('LIMPIEZA', 'Solicitudes')]: 'navigation.limpieza.solicitudes',
  [roleAccessKey('LIMPIEZA', 'Historial')]: 'navigation.limpieza.historial',
  [roleAccessKey('ROOM SERVICE', 'Pedidos activos')]: 'navigation.room-service.pedidos-activos',
  [roleAccessKey('ROOM SERVICE', 'Menú')]: 'navigation.room-service.menu',
  [roleAccessKey('ROOM SERVICE', 'Historial')]: 'navigation.room-service.historial',
  [roleAccessKey('ROOM SERVICE', 'Inventario')]: 'navigation.room-service.inventario',
  [roleAccessKey('CONSERJERÍA', 'Solicitudes')]: 'navigation.conserjeria.solicitudes',
  [roleAccessKey('CONSERJERÍA', 'Por habitación')]: 'navigation.conserjeria.por-habitacion',
  [roleAccessKey('CONSERJERÍA', 'Historial')]: 'navigation.conserjeria.historial',
  [roleAccessKey('HUÉSPED', 'Inicio')]: 'navigation.huesped.inicio',
  [roleAccessKey('HUÉSPED', 'Mis reservas')]: 'navigation.huesped.mis-reservas',
  [roleAccessKey('HUÉSPED', 'Mi estancia')]: 'navigation.huesped.mi-estancia',
  [roleAccessKey('HUÉSPED', 'Amenidades')]: 'navigation.huesped.amenidades',
  [roleAccessKey('HUÉSPED', 'Conserjería')]: 'navigation.huesped.conserjeria',
  [roleAccessKey('HUÉSPED', 'Limpieza y artículos')]: 'navigation.huesped.servicios-de-habitacion',
  [roleAccessKey('HUÉSPED', 'Room service')]: 'navigation.huesped.room-service',
  [roleAccessKey('HUÉSPED', 'Mis solicitudes y pedidos')]:
    'navigation.huesped.mis-solicitudes-y-pedidos',
  [roleAccessKey('HUÉSPED', 'Notificaciones')]: 'navigation.huesped.notificaciones',
};

const withFixedAdminPermissions = (permissions: Record<string, boolean>) => ({
  ...permissions,
  ...Object.fromEntries(ADMIN_ACCESS_PERMISSION_KEYS.map((key) => [key, true])),
});

const normalizeRoleCode = (code: string) => (code === 'room_service' ? 'roomService' : code);

const BUILT_IN_OPERATIONAL_ROLES: readonly string[] = [
  'reception',
  'housekeeping',
  'roomService',
  'concierge',
];
const BUILT_IN_ROLES: readonly string[] = [...BUILT_IN_OPERATIONAL_ROLES, 'admin', 'guest'];
const GROUP_BY_ROLE: Record<string, string> = {
  admin: 'ADMINISTRACIÓN',
  reception: 'RECEPCIÓN',
  housekeeping: 'LIMPIEZA',
  roomService: 'ROOM SERVICE',
  concierge: 'CONSERJERÍA',
  guest: 'HUÉSPED',
};
/** Áreas de `navigation.<área>.*` que un rol personalizado puede tener (B3). */
const CUSTOM_ROLE_AREAS: Record<string, string> = {
  recepcion: 'reception',
  limpieza: 'housekeeping',
  'room-service': 'roomService',
  conserjeria: 'concierge',
};
const CUSTOM_ROLE_GROUPS = ['RECEPCIÓN', 'LIMPIEZA', 'ROOM SERVICE', 'CONSERJERÍA'];

export const isBuiltInRoleCode = (code: string) =>
  BUILT_IN_ROLES.includes(normalizeRoleCode(code.trim().toLowerCase()));

/**
 * Panel de un rol personalizado según sus llaves `navigation.<área>.*`: exactamente
 * un área operativa; si no, `null` (el inicio de sesión lo rechaza, B3).
 */
export const customRoleWorkspace = (permissionKeys: readonly string[]) => {
  const areas = new Set(
    permissionKeys
      .map((key) => /^navigation\.([a-z-]+)\./.exec(key)?.[1])
      .filter((area): area is string => Boolean(area)),
  );
  if (areas.size !== 1) return null;
  return CUSTOM_ROLE_AREAS[[...areas][0]] ?? null;
};

/** Grupos que el editor permite marcar para un rol. */
export const editableRoleGroups = (roleCode: string | undefined): readonly string[] => {
  if (!roleCode) return CUSTOM_ROLE_GROUPS;
  const normalized = normalizeRoleCode(roleCode.trim().toLowerCase());
  if (normalized === 'admin') return ROLE_ACCESS_GROUPS.map((group) => group.name);
  if (BUILT_IN_ROLES.includes(normalized)) return [GROUP_BY_ROLE[normalized]];
  return CUSTOM_ROLE_GROUPS;
};

/** Error si un rol personalizado combina áreas (no podría iniciar sesión). */
export const customRoleSelectionError = (
  roleCode: string | undefined,
  permissions: Record<string, boolean>,
) => {
  if (roleCode && isBuiltInRoleCode(roleCode)) return null;
  const groups = new Set(
    Object.entries(permissions)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key.split('::')[0]),
  );
  return groups.size > 1
    ? 'Un rol personalizado solo puede tener secciones de un área: Recepción, Limpieza, Room Service o Conserjería.'
    : null;
};

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

export const uiPermissionsFromBackend = (role: Role): Record<string, boolean> => {
  const code = normalizeRoleCode(role.code.trim().toLowerCase());
  // Operativos y personalizados: lo mismo que verá el empleado al iniciar sesión (P4).
  if (role.permissionIds.length > 0 && BUILT_IN_OPERATIONAL_ROLES.includes(code)) {
    return rolePermissionsFromSessionPermissions(code, role.permissionIds);
  }
  if (!BUILT_IN_ROLES.includes(code)) {
    const workspace = customRoleWorkspace(role.permissionIds);
    return workspace
      ? rolePermissionsFromSessionPermissions(workspace, role.permissionIds)
      : (Object.fromEntries(ALL_PERMISSIONS.map((key) => [key, false])) as Record<string, boolean>);
  }
  if (role.permissionIds.length === 0) {
    const fallbackPermissions = getRoleDashboardPermissions(role.code);
    return normalizeRoleCode(role.code) === 'admin'
      ? withFixedAdminPermissions(fallbackPermissions)
      : fallbackPermissions;
  }
  const granted = new Set(role.permissionIds);
  const hasConfiguredNavigation = granted.has('navigation.configured');
  if (normalizeRoleCode(role.code) === 'admin' || hasConfiguredNavigation) {
    const navigationPermissions = Object.fromEntries(
      ALL_PERMISSIONS.map((key) => {
        const permission = adminNavigationPermissionByAccessKey[key];
        return [key, permission ? granted.has(permission) : false];
      }),
    );
    return normalizeRoleCode(role.code) === 'admin'
      ? withFixedAdminPermissions(navigationPermissions)
      : navigationPermissions;
  }
  return uiPermissionsFromGrantedKeys(granted);
};

const uiPermissionsFromGrantedKeys = (granted: ReadonlySet<string>): Record<string, boolean> =>
  Object.fromEntries(
    ALL_PERMISSIONS.map((key) => {
      const backendKeys = backendPermissionsByAccessKey[key] ?? [];
      return [
        key,
        backendKeys.length === 0 ? false : backendKeys.some((item) => granted.has(item)),
      ];
    }),
  ) as Record<string, boolean>;

/**
 * Secciones visibles para un rol operativo a partir de los permisos reales de
 * la sesión (`GET /auth/permissions`). Reemplaza el fallback por grupo, que
 * mostraba secciones que el backend responde con 403 (p. ej. Inventario de
 * Room Service sin `inventory.read`). Solo habilita secciones del grupo del
 * propio rol: un permiso compartido como `bookings.read` no abre Administración.
 * Si Administración guardó la selección del rol (`navigation.configured`), la
 * sección además debe tener su llave `navigation.*`: ocultarla en el editor la
 * oculta al empleado aunque conserve el permiso operativo.
 */
export const rolePermissionsFromSessionPermissions = (
  roleCode: string,
  permissionKeys: readonly string[],
) => {
  const fallback = getRoleDashboardPermissions(roleCode);
  const granted = new Set(permissionKeys);
  const operational = uiPermissionsFromGrantedKeys(granted);
  const hasConfiguredNavigation = granted.has('navigation.configured');
  return Object.fromEntries(
    Object.entries(fallback).map(([key, inRoleGroup]) => {
      const navigationKey = adminNavigationPermissionByAccessKey[key];
      const allowedByNavigation =
        !hasConfiguredNavigation || (navigationKey !== undefined && granted.has(navigationKey));
      return [key, inRoleGroup && operational[key] && allowedByNavigation];
    }),
  ) as Record<string, boolean>;
};

export const rolePermissionsFromBackendRoles = (roles: Role[]) =>
  Object.fromEntries(
    roles.map((role) => [normalizeRoleCode(role.code), uiPermissionsFromBackend(role)]),
  ) as Record<string, Record<string, boolean>>;

export const rolePermissionKeysFromUi = (
  roleCode: string,
  permissions: Record<string, boolean>,
  previousPermissionKeys: readonly string[] = [],
) => {
  const isAdmin = normalizeRoleCode(roleCode) === 'admin';
  // Ocultar una sección de un rol predefinido no le retira permisos operativos.
  const preserved =
    !isAdmin && isBuiltInRoleCode(roleCode)
      ? previousPermissionKeys.filter((key) => !key.startsWith('navigation.'))
      : [];
  const operationalPermissions = isAdmin
    ? []
    : [
        ...preserved,
        ...Object.entries(permissions)
          .filter(([, enabled]) => enabled)
          .flatMap(([key]) => operationalGrantsByAccessKey[key] ?? []),
      ];
  const navigationPermissions = Object.entries(permissions)
    .filter(([, enabled]) => enabled)
    .flatMap(([key]) => {
      const permission = adminNavigationPermissionByAccessKey[key];
      return permission ? [permission] : [];
    });

  return [
    ...new Set([...operationalPermissions, ...navigationPermissions, 'navigation.configured']),
  ].sort();
};

export { ALL_PERMISSIONS, ROLE_ACCESS_GROUPS, roleAccessKey };
