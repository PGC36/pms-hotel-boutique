import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Activity,
  Archive,
  ArrowRight,
  Ban,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  DollarSign,
  Dumbbell,
  Download,
  FileText,
  Package,
  Pencil,
  Percent,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  TrendingUp,
  Users as UsersIcon,
  Utensils,
  Wallet,
  Waves,
  Wifi,
  X,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { auditService } from '@/services/auditService';
import { bookingService } from '@/services/bookingService';
import { cashService } from '@/services/cashService';
import { catalogService } from '@/services/catalogService';
import { inventoryService } from '@/services/inventoryService';
import { personnelService } from '@/services/personnelService';
import { promotionService } from '@/services/promotionService';
import { reportingService, type OperationalReport } from '@/services/reportingService';
import { auditDescription } from '@/modules/administration/utils/auditDescription';
import {
  customRoleSelectionError,
  editableRoleGroups,
  rolePermissionKeysFromUi,
  uiPermissionsFromBackend,
} from '@/modules/administration/utils/rolePermissions';
import { roomService } from '@/services/roomService';
import { getUserFacingErrorMessage } from '@/services/http-client';
import { CatalogImage } from '@/shared/components/CatalogImage';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { ConciergeCatalogPanel } from './ConciergeCatalogPanel';
import { HousekeepingCatalogPanel } from './HousekeepingCatalogPanel';
import { HousekeepingChecklistTemplatePanel } from './HousekeepingChecklistTemplatePanel';
import { ErrorState } from '@/shared/components/ErrorState';
import { ImageGalleryField } from '@/shared/components/ImageGalleryField';
import { LoadingState } from '@/shared/components/LoadingState';
import { toDtoCalendarDate } from '@/shared/types/common';
import { catalogNameError } from '@/shared/utils/catalogName';
import { findBaseRate, getSeasonalRates } from '@/shared/utils/rateSelection';
import { formatAmenitySchedule, parseAmenityScheduleInput } from '@/shared/utils/amenitySchedule';
import { formatCurrency } from '@/shared/utils/currency';
import { exportDateSuffix, exportToCSV } from '@/shared/utils/exportCsv';
import {
  amountToMoneyInput,
  fieldErrorProps,
  isMoneyInput,
  isWholeNumberInput,
  moneyInputToCents,
  normalizePersonNamePart,
  validateDateRange,
  validateMoneyAmount,
  validatePersonNamePart,
  validateRequiredText,
  validateWholeNumber,
} from '@/shared/utils/formValidation';
import {
  EMAIL_MAX_LENGTH,
  validateEmail,
} from '@/modules/front-desk/utils/reservationFormValidation';
import {
  discardPendingUploads,
  galleryFromImages,
  getGallerySaveBlocker,
  toImageAssignments,
  type GalleryItem,
} from '@/shared/utils/mediaGallery';
import type {
  AuditAction,
  AuditLog,
  AuditModule,
  KnownAuditAction,
  KnownAuditModule,
} from '@/shared/types/entities/audit-log';
import type { Booking } from '@/shared/types/entities/booking';
import type { CashSession } from '@/shared/types/entities/cash-session';
import { formatDateGT } from '@/shared/utils/date';
import type { InventoryItemCategory, InventoryUnit } from '@/shared/types/entities/inventory-item';
import type { InventoryItemCategoryDto } from '@/shared/types/entities/inventory-item';
import type { InventoryMovementReasonDto } from '@/shared/types/entities/inventory-movement';
import type { InventoryMovementReason } from '@/shared/types/entities/inventory-movement';
import type { Amenity as DomainAmenity, AmenityCategory } from '@/shared/types/entities/amenity';
import {
  findPrimaryImage,
  type MediaImage,
  type MediaImageAssignmentDto,
} from '@/shared/types/entities/media-image';
import type { Product, ProductDto } from '@/shared/types/entities/product';
import type { RoomFeature } from '@/shared/types/entities/room-feature';
import type { Role } from '@/shared/types/entities/role';
import type { Room, RoomStatusDto } from '@/shared/types/entities/room';
import type { RoomType } from '@/shared/types/entities/room-type';
import type { User } from '@/shared/types/entities/user';
import './AdminContent.css';

type AdminUser = {
  id: number;
  dbId: string;
  /** Nombre visible (nombre + apellido). */
  name: string;
  /** Campos separados del contrato (`User.firstName`/`lastName`). */
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: string;
  /** Id real del rol (resuelto por código): no depende del nombre visible. */
  roleDbId?: string;
  status: 'Activo' | 'Inactivo';
  lastAccess: string;
};
type AdminRole = {
  id: number;
  dbId: string;
  code: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  permissionKeys: string[];
  userCount: number;
};
type AdminRoom = {
  id: number;
  dbId: string;
  roomTypeId: string;
  number: string;
  floor: string;
  type: string;
  capacity: number;
  rate: number;
  status: string;
  active: boolean;
  features: string[];
};
type AdminRoomType = {
  id: number;
  dbId: string;
  name: string;
  capacity: number;
  description: string;
  roomFeatureIds: string[];
  features: string[];
  basePrice: number;
  status: 'Activo' | 'Inactivo';
  images: MediaImage[];
};
type SeasonRate = {
  id: number;
  dbId: string;
  roomType: string;
  seasonName: string;
  startDate: string;
  endDate: string;
  baseRate: number;
  seasonalRate: number;
  /** Noches mínimas de la tarifa (el backend lo exige al crear). */
  minimumNights?: number;
  status: 'Activa' | 'Inactiva';
};
type Promo = {
  id: number;
  dbId: string;
  name: string;
  code: string;
  percentage: number;
  startDate: string;
  endDate: string;
  conditions: string;
  status: 'Activa' | 'Inactiva';
};
type Amenity = {
  id: number;
  dbId: string;
  name: string;
  description: string;
  category: AmenityCategory;
  /** Texto editable "HH:mm - HH:mm"; vacío = servicio continuo. */
  schedule: string;
  available: boolean;
  status: 'Activo' | 'Inactivo';
  icon: string;
  images: MediaImage[];
};
type RoomServiceItem = {
  id: number;
  dbId: string;
  name: string;
  description: string;
  /** Etiqueta y valor persistido de la categoría real del producto. */
  category: string;
  categoryCode: Product['category'];
  price: number;
  available: boolean;
  status: 'Activo' | 'Inactivo';
  images: MediaImage[];
};
type InventoryProduct = {
  id: number;
  dbId: string;
  sku: string;
  categoryCode: InventoryItemCategory;
  unit: InventoryUnit;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  status: 'Activo' | 'Inactivo';
  images: MediaImage[];
};
type InventoryMovement = {
  id: number;
  dbId: string;
  date: string;
  product: string;
  type: 'Entrada' | 'Salida';
  quantity: number;
  reason: string;
  responsible: string;
};
type CashMovement = {
  id: number;
  dbId: string;
  date: string;
  concept: string;
  type: 'Ingreso' | 'Egreso';
  amount: number;
  responsible: string;
};
type AuditEntry = {
  id: number;
  user: string;
  date: string;
  time: string;
  module: string;
  action: string;
  description: string;
};
type ReportPeriod = 'Día' | 'Semana' | 'Mes' | 'Año' | 'Temporada';
type AdminReportTab = 'Ocupación' | 'Ingresos' | 'Reservas' | 'Cancelaciones';
type DashboardPeriod = 'Hoy' | '7 días' | '30 días' | '90 días';
type UsersSection = 'Gestión de usuarios' | 'Roles y permisos';
type RoomsSection = 'Gestión de habitaciones' | 'Tipos de habitación';
type InventorySection = 'Gestión de inventario' | 'Movimientos de inventario';
type RatesSection = 'Tarifas por temporada';
type ServicesSection = 'Amenidades' | 'Catálogo de Room Service';
type ReportGroup = 'Resumen operativo' | 'Reportes financieros';

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

const roleAccessKey = (groupName: string, item: string) => `${groupName}::${item}`;

const ALL_PERMISSIONS = ROLE_ACCESS_GROUPS.flatMap((group) =>
  group.items.map((item) => roleAccessKey(group.name, item)),
);
const ADMIN_ACCESS_GROUP_NAME = 'ADMINISTRACIÓN';
const ADMIN_ACCESS_PERMISSION_KEYS =
  ROLE_ACCESS_GROUPS.find((group) => group.name === ADMIN_ACCESS_GROUP_NAME)?.items.map((item) =>
    roleAccessKey(ADMIN_ACCESS_GROUP_NAME, item),
  ) ?? [];

const withFixedAdminPermissions = (permissions: Record<string, boolean>) => ({
  ...permissions,
  ...Object.fromEntries(ADMIN_ACCESS_PERMISSION_KEYS.map((key) => [key, true])),
});

const reportTabsByGroup: Record<ReportGroup, AdminReportTab[]> = {
  'Resumen operativo': ['Ocupación', 'Reservas', 'Cancelaciones'],
  'Reportes financieros': ['Ingresos'],
};
/*
  {
    id: 1,
    condition: 'Ocupación',
    operator: '>',
    threshold: 80,
    adjustment: 'Aumentar',
    value: 15,
    status: 'Activa',
  },
  {
    id: 2,
    condition: 'Ocupación',
    operator: '>',
    threshold: 90,
    adjustment: 'Aumentar',
    value: 25,
    status: 'Activa',
  },
  {
    id: 3,
    condition: 'Reservas con menos de',
    operator: '<',
    threshold: 3,
    adjustment: 'Disminuir',
    value: 10,
    status: 'Activa',
  },
  {
    id: 4,
    condition: 'Estancia extendida (4+ noches)',
    operator: '>=',
    threshold: 4,
    adjustment: 'Disminuir',
    value: 12,
    status: 'Inactiva',
  },
];
*/

const parseDbId = (id: string, fallback: number) => {
  const value = Number(id.replace(/\D/g, ''));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

// Sin redondear: un precio de Q25.50 se edita como 25.5 y no se guarda como Q26.00.
const centsToAmount = (cents: number) => cents / 100;

const amountToCents = (amount: number) => Math.round(amount * 100);

const money = (amount: number) => formatCurrency(amountToCents(amount), 'GTQ');

const activeOfficialBookingStatuses = new Set(['confirmed', 'checked_in', 'checked_out']);

const countActiveOfficialBookings = (report: OperationalReport) =>
  Object.entries(report.bookingsByStatus).reduce(
    (sum, [status, count]) => (activeOfficialBookingStatuses.has(status) ? sum + count : sum),
    0,
  );

const formatDbTime = (value: Date) =>
  value.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false });

const userNameById = (users: User[], userId?: string) => {
  const user = users.find((item) => item.id === userId);
  return user ? `${user.firstName} ${user.lastName}` : 'Sistema';
};

const roomTypeNameById = (roomTypes: RoomType[], roomTypeId?: string) =>
  roomTypes.find((type) => type.id === roomTypeId)?.name ?? 'Estándar';

/**
 * `role.code` no pasa por el mismo mapeo que `user.role`: el mapper de
 * `user` convierte 'room_service' (DTO) a 'roomService' (Model), pero el
 * mapper de `role` deja `code` tal cual llega del DTO. D-003
 * (docs/DECISIONES.md) dice que corresponden por valor — en la práctica
 * hay que normalizar antes de comparar. Mismo criterio que ya usa el
 * mapper de user, no una regla nueva.
 */
const normalizeRoleCode = (code: string) => (code === 'room_service' ? 'roomService' : code);

const roleDisplayName = (role?: Role) => {
  if (!role) return '';
  const labels: Record<string, string> = {
    admin: 'Administración',
    guest: 'Huésped',
    reception: 'Recepción',
    housekeeping: 'Limpieza',
    concierge: 'Conserjería',
    roomService: 'Room Service',
  };
  return labels[normalizeRoleCode(role.code)] ?? role.name;
};

const roomStatusLabel = (
  status: Room['status'],
  housekeepingStatus: Room['housekeepingStatus'],
) => {
  if (status === 'occupied') return 'Ocupada';
  if (status === 'maintenance' || status === 'outOfService') return 'Mantenimiento';
  if (housekeepingStatus === 'dirty' || housekeepingStatus === 'cleaning') return 'Limpieza';
  return 'Disponible';
};

const toRoomStatusDto = (status: string): RoomStatusDto => {
  if (status === 'Ocupada') return 'occupied';
  if (status === 'Mantenimiento') return 'maintenance';
  return 'available';
};

const INVENTORY_CATEGORY_LABELS: Record<InventoryItemCategory, string> = {
  roomService: 'Room Service',
  housekeeping: 'Housekeeping',
  maintenance: 'Mantenimiento',
  office: 'Oficina',
};
const INVENTORY_CATEGORY_OPTIONS: InventoryItemCategory[] = [
  'roomService',
  'housekeeping',
  'maintenance',
];

const INVENTORY_UNIT_LABELS: Record<InventoryUnit, string> = {
  unit: 'Unidad',
  box: 'Caja',
  bottle: 'Botella',
  kg: 'Kilogramo',
  liter: 'Litro',
  roll: 'Rollo',
};

const INVENTORY_REASON_LABELS: Record<InventoryMovementReason, string> = {
  purchase: 'Compra',
  restock: 'Reposición',
  consumption: 'Consumo',
  sale: 'Venta',
  shrinkage: 'Merma',
};

const INVENTORY_CATEGORY_BY_LABEL = Object.fromEntries(
  Object.entries(INVENTORY_CATEGORY_LABELS).map(([key, value]) => [value, key]),
) as Record<string, InventoryItemCategory>;

const INVENTORY_REASON_BY_LABEL = Object.fromEntries(
  Object.entries(INVENTORY_REASON_LABELS).map(([key, value]) => [value, key]),
) as Record<string, InventoryMovementReasonDto>;

const toInventoryCategoryDto = (category: InventoryItemCategory): InventoryItemCategoryDto =>
  category === 'roomService' ? 'room_service' : category;

/** Contraseña inicial de un empleado: mínimo del backend (`CreateUserRequest`, @Size(min = 8)). */
const USER_PASSWORD_MIN_LENGTH = 8;
/** Límites del backend para roles (`CreateRoleRequest`). */
const ROLE_NAME_MAX_LENGTH = 120;
const ROLE_CODE_MAX_LENGTH = 80;
/** Concepto de un movimiento de caja (`CreateCashMovementRequest`, @Size(max = 255)). */
const CASH_CONCEPT_MAX_LENGTH = 255;
/** Descuento de una promoción (`UpsertPromotionRequest`, @Min(1) @Max(100)). */
const PROMO_PERCENT_MIN = 1;
const PROMO_PERCENT_MAX = 100;
/**
 * Reglas de formato de los formularios de habitaciones y promociones (antes como
 * `pattern`/`max` nativos del formulario; aquí con el error junto al campo).
 */
const ROOM_NUMBER_PATTERN = /^[A-Za-z0-9-]+$/;
const ROOM_CAPACITY_MAX = 20;
const ROOM_TYPE_NAME_PATTERN = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9'’ -]{1,79}$/;
const PROMO_NAME_PATTERN = /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9'’ -]{1,99}$/;
const PROMO_CODE_MIN_LENGTH = 2;
const patternError = (value: string, pattern: RegExp, message: string) =>
  pattern.test(value.trim()) ? null : message;

const adminUserFromDomain = (user: User, roles: Role[], index: number): AdminUser => {
  // Por el código real: un rol personalizado ya no aparece como Recepción (B3).
  const roleKey = user.roleCode ?? user.role;
  const role = roles.find((item: Role) => normalizeRoleCode(item.code) === roleKey);
  return {
    id: parseDbId(user.id, index + 1),
    dbId: user.id,
    name: `${user.firstName} ${user.lastName}`,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: roleDisplayName(role) || roleKey,
    status: user.status === 'active' ? 'Activo' : 'Inactivo',
    lastAccess: toDtoCalendarDate(user.updatedAt),
  };
};

const adminUserFromAdminRoles = (user: User, roles: AdminRole[], index: number): AdminUser => {
  const roleKey = user.roleCode ?? user.role;
  const role = roles.find((item) => item.code === roleKey);
  return {
    id: parseDbId(user.id, index + 1),
    dbId: user.id,
    name: `${user.firstName} ${user.lastName}`,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: role?.name ?? roleKey,
    roleDbId: role?.dbId,
    status: user.status === 'active' ? 'Activo' : 'Inactivo',
    lastAccess: toDtoCalendarDate(user.updatedAt),
  };
};

const adminRoleFromDomain = (role: Role, users: User[], index: number): AdminRole => {
  const roleCode = normalizeRoleCode(role.code);
  return {
    id: parseDbId(role.id, index + 1),
    dbId: role.id,
    code: roleCode,
    name: roleDisplayName(role),
    description: `Rol ${role.code}`,
    userCount: users.filter((user) => (user.roleCode ?? user.role) === roleCode).length,
    permissions: uiPermissionsFromBackend(role),
    permissionKeys: [...role.permissionIds],
  };
};

const roleIdFromDisplay = (roles: AdminRole[], roleName: string) => {
  const role = roles.find((item) => item.name === roleName);
  if (!role) throw new Error('Selecciona un rol valido.');
  return role.dbId;
};

const adminAmenityFromDomain = (amenity: DomainAmenity, index: number): Amenity => ({
  id: parseDbId(amenity.id, index + 1),
  dbId: amenity.id,
  name: amenity.name,
  description: amenity.description ?? '',
  category: amenity.category,
  schedule: formatAmenitySchedule(amenity),
  available: amenity.active,
  status: amenity.active ? 'Activo' : 'Inactivo',
  icon: ['Waves', 'Utensils', 'Dumbbell', 'Sparkles', 'Star', 'Wifi'][index % 6],
  images: amenity.images,
});

const PRODUCT_CATEGORY_LABELS: Record<Product['category'], string> = {
  foodAndBeverage: 'Alimentos y bebidas',
  minibar: 'Minibar',
  shop: 'Tienda',
  other: 'Otros',
};

const PRODUCT_CATEGORY_DTO: Record<Product['category'], ProductDto['category']> = {
  foodAndBeverage: 'food_and_beverage',
  minibar: 'minibar',
  shop: 'shop',
  other: 'other',
};

const adminProductFromDomain = (product: Product, index: number): RoomServiceItem => ({
  id: parseDbId(product.id, index + 1),
  dbId: product.id,
  name: product.name,
  description: product.description ?? '',
  category: PRODUCT_CATEGORY_LABELS[product.category] ?? product.category,
  categoryCode: product.category,
  price: centsToAmount(product.priceCents),
  available: product.active,
  status: product.active ? 'Activo' : 'Inactivo',
  images: product.images,
});

const productSkuFromName = (name: string) => {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
  return `RS-${slug || Date.now()}`;
};

const serviceErrorMessage = (error: unknown) => {
  return getUserFacingErrorMessage(error, 'No fue posible completar la operación.');
};

/**
 * Los módulos/acciones de auditoría reales (AuditModule/AuditAction) no
 * coinciden con el vocabulario que el prototipo Bolt inventó ('Tarifas',
 * 'Room Service', 'Edición'...) — son categorías distintas. Se traducen
 * los valores reales, no se inventan nuevos.
 */
const AUDIT_MODULE_LABELS: Record<KnownAuditModule, string> = {
  guestAccounts: 'Cuentas de huésped',
  cash: 'Caja',
  inventory: 'Inventario',
  catalog: 'Catálogo',
  users: 'Usuarios',
  bookings: 'Reservas',
};

const AUDIT_ACTION_LABELS: Record<KnownAuditAction, string> = {
  create: 'Creación',
  update: 'Actualización',
  delete: 'Eliminación',
  void: 'Anulación',
  open: 'Apertura',
  close: 'Cierre',
};

const dashboardPeriodOptions: DashboardPeriod[] = ['Hoy', '7 días', '30 días', '90 días'];
const reportPeriodOptions: ReportPeriod[] = ['Día', 'Semana', 'Mes', 'Año', 'Temporada'];
/** Módulos y acciones que registra el backend (AuditTrail) además del vocabulario base. */
const AUDIT_MODULE_EXTRA_LABELS: Record<string, string> = {
  folio: 'Folio',
  payments: 'Pagos',
  deposits: 'Depósitos',
  roles: 'Roles',
  demo_seed: 'Datos de demostración',
};
const AUDIT_ACTION_EXTRA_LABELS: Record<string, string> = {
  created: 'Creación',
  cancel: 'Cancelación',
  close_exceptional: 'Cierre excepcional',
  charge_create: 'Cargo',
  charge_void: 'Anulación de cargo',
  payment_create: 'Pago',
  deposit_create: 'Depósito',
  deposit_apply: 'Aplicación de depósito',
  deposit_refund: 'Devolución de depósito',
  user_password_change: 'Cambio de contraseña',
  user_role_change: 'Cambio de rol',
  user_status_change: 'Cambio de estado',
  role_create: 'Creación de rol',
  role_update: 'Actualización de rol',
  role_permissions_replace: 'Cambio de permisos',
};

const auditModuleLabel = (module: AuditModule) =>
  module in AUDIT_MODULE_LABELS
    ? AUDIT_MODULE_LABELS[module as KnownAuditModule]
    : (AUDIT_MODULE_EXTRA_LABELS[module] ?? module);

const auditActionLabel = (action: AuditAction) =>
  action in AUDIT_ACTION_LABELS
    ? AUDIT_ACTION_LABELS[action as KnownAuditAction]
    : (AUDIT_ACTION_EXTRA_LABELS[action] ?? action);

/*
const dashboardSeries: Record<
  DashboardPeriod,
  Record<
    'Ocupación' | 'Ingresos' | 'Reservas',
    { data: number[]; labels: string[]; value: string; change: string }
  >
> = {
  Hoy: {
    Ocupación: {
      data: [42, 48, 55, 61, 68, 74, 79],
      labels: ['06:00', '09:00', '12:00', '15:00', '18:00'],
      value: '79.0%',
      change: '+3.2% vs. ayer',
    },
    Ingresos: {
      data: [18, 24, 31, 44, 52, 61, 74],
      labels: ['06:00', '09:00', '12:00', '15:00', '18:00'],
      value: 'demo',
      change: '+5.1% vs. ayer',
    },
    Reservas: {
      data: [2, 4, 5, 8, 9, 12, 14],
      labels: ['06:00', '09:00', '12:00', '15:00', '18:00'],
      value: '14',
      change: '+2 hoy',
    },
  },
  '7 días': {
    Ocupación: {
      data: [71, 76, 74, 80, 83, 78, 86],
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      value: '78.3%',
      change: '+4.6% vs. semana anterior',
    },
    Ingresos: {
      data: [82, 94, 88, 105, 122, 118, 130],
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      value: 'demo',
      change: '+9.8% vs. semana anterior',
    },
    Reservas: {
      data: [18, 22, 19, 26, 31, 28, 34],
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      value: '178',
      change: '+12 reservas',
    },
  },
  '30 días': {
    Ocupación: {
      data: [62, 68, 65, 72, 70, 78, 75, 82, 79, 85, 88, 84, 90, 87, 92],
      labels: ['01 ago', '05 ago', '10 ago', '15 ago', '20 ago', '25 ago', '30 ago'],
      value: '84.6%',
      change: '+8.2% vs. mes anterior',
    },
    Ingresos: {
      data: [98, 112, 105, 128, 135, 142, 128, 152, 148, 166, 172, 164, 181, 176, 190],
      labels: ['01 ago', '05 ago', '10 ago', '15 ago', '20 ago', '25 ago', '30 ago'],
      value: 'demo',
      change: '+14.5% vs. mes anterior',
    },
    Reservas: {
      data: [28, 35, 32, 40, 38, 45, 42, 48, 46, 52, 55, 50, 58, 56, 61],
      labels: ['01 ago', '05 ago', '10 ago', '15 ago', '20 ago', '25 ago', '30 ago'],
      value: '642',
      change: '+8.9% vs. mes anterior',
    },
  },
  '90 días': {
    Ocupación: {
      data: [58, 64, 69, 73, 76, 81, 84, 86, 89],
      labels: ['Jun', 'Jul', 'Ago', 'Sep'],
      value: '81.2%',
      change: '+10.4% vs. trimestre anterior',
    },
    Ingresos: {
      data: [260, 282, 304, 336, 352, 371, 390, 415, 438],
      labels: ['Jun', 'Jul', 'Ago', 'Sep'],
      value: 'demo',
      change: '+18.1% vs. trimestre anterior',
    },
    Reservas: {
      data: [118, 130, 142, 158, 171, 184, 192, 204, 218],
      labels: ['Jun', 'Jul', 'Ago', 'Sep'],
      value: '1,517',
      change: '+15.3% vs. trimestre anterior',
    },
  },
};
const reportPeriodData: Record<
  ReportPeriod,
  {
    labels: string[];
    occupancy: number[];
    income: number[];
    reservations: number[];
    cancellations: number[];
    occupancyValue: string;
    incomeValue: string;
    reservationsValue: string;
    cancellationValue: string;
    trend: string;
    change: string;
  }
> = {
  Día: {
    labels: ['06', '09', '12', '15', '18', '21'],
    occupancy: [42, 51, 58, 65, 72, 79],
    income: [18, 24, 31, 44, 52, 61],
    reservations: [2, 4, 5, 8, 9, 12],
    cancellations: [1, 0, 1, 2, 1, 0],
    occupancyValue: '79.0%',
    incomeValue: 'demo',
    reservationsValue: '14',
    cancellationValue: '5',
    trend: 'En aumento',
    change: '+3.2%',
  },
  Semana: {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    occupancy: [71, 76, 74, 80, 83, 78, 86],
    income: [82, 94, 88, 105, 122, 118, 130],
    reservations: [18, 22, 19, 26, 31, 28, 34],
    cancellations: [3, 4, 2, 5, 3, 2, 4],
    occupancyValue: '78.3%',
    incomeValue: 'demo',
    reservationsValue: '178',
    cancellationValue: '23',
    trend: 'Estable',
    change: '+4.6%',
  },
  Mes: {
    labels: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'],
    occupancy: [62, 68, 65, 72, 70, 78, 75, 82, 79, 85, 88, 84, 90, 87, 92],
    income: [98, 112, 105, 128, 135, 142, 128],
    reservations: [38, 45, 32, 27, 41, 48, 52],
    cancellations: [15, 12, 10, 14, 8, 11, 9],
    occupancyValue: '84.6%',
    incomeValue: 'demo',
    reservationsValue: '241',
    cancellationValue: '12',
    trend: 'Ascendente',
    change: '+8.2%',
  },
  Año: {
    labels: ['Ene', 'Mar', 'May', 'Jul', 'Sep', 'Nov'],
    occupancy: [65, 70, 74, 78, 82, 88],
    income: [240, 268, 292, 315, 344, 372],
    reservations: [420, 452, 488, 510, 548, 590],
    cancellations: [38, 34, 31, 28, 26, 24],
    occupancyValue: '81.8%',
    incomeValue: 'demo',
    reservationsValue: '5,840',
    cancellationValue: '8.1%',
    trend: 'Crecimiento',
    change: '+11.6%',
  },
  Temporada: {
    labels: ['Baja', 'Media', 'Alta', 'Festiva'],
    occupancy: [64, 78, 91, 96],
    income: [228, 321, 482, 536],
    reservations: [280, 420, 580, 640],
    cancellations: [11, 8, 6, 5],
    occupancyValue: '88.4%',
    incomeValue: 'demo',
    reservationsValue: '640',
    cancellationValue: '5.0%',
    trend: 'Alta demanda',
    change: '+16.9%',
  },
};

*/
const amenityIconMap: Record<string, LucideIcon> = {
  Waves,
  Utensils,
  Dumbbell,
  Sparkles,
  Star,
  Wifi,
};
const roomStatusClass = (status: string) =>
  status === 'Disponible'
    ? 'success'
    : status === 'Ocupada'
      ? 'warning'
      : status === 'Limpieza'
        ? 'info'
        : 'terracotta';
const statusPillClass = (status: string) =>
  status === 'Activo' || status === 'Activa'
    ? 'success'
    : status === 'Inactivo' || status === 'Inactiva'
      ? 'terracotta'
      : 'info';

function getReportPeriodRange(period: ReportPeriod, anchor = new Date()) {
  const start = new Date(anchor);
  const end = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (period === 'Día') {
    return { start, end };
  }

  if (period === 'Semana') {
    start.setDate(start.getDate() - 6);
    return { start, end };
  }

  if (period === 'Mes') {
    start.setDate(1);
    return { start, end };
  }

  if (period === 'Año') {
    start.setMonth(0, 1);
    return { start, end };
  }

  const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
  start.setMonth(quarterStartMonth, 1);
  return { start, end };
}

function isDateInReportPeriod(date: Date, period: ReportPeriod) {
  const { start, end } = getReportPeriodRange(period);
  return date >= start && date <= end;
}

function AdminModal({
  title,
  eyebrow,
  onClose,
  children,
  onSubmit,
  submitLabel,
  width = 480,
  submitting = false,
  error,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  width?: number;
  /** Deshabilita los botones mientras se guarda. */
  submitting?: boolean;
  /** Error del último intento de guardar; el modal sigue abierto para corregirlo. */
  error?: string | null;
}) {
  const close = submitting ? () => undefined : onClose;
  const modalRef = useRef<HTMLDivElement>(null);
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        ref={modalRef}
        className="modal adm-modal"
        style={{ width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={close} disabled={submitting} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
        {error ? (
          <p className="adm-modal-error" role="alert">
            {error}
          </p>
        ) : null}
        {onSubmit && (
          <div className="modal-foot">
            <button
              type="button"
              className="button secondary"
              onClick={close}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => {
                // Validación nativa de los campos del modal (required, min/max…) antes
                // de la validación propia de cada formulario.
                const fields = modalRef.current?.querySelectorAll<
                  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
                >('input, select, textarea');
                for (const field of fields ?? []) {
                  if (!field.checkValidity()) {
                    field.reportValidity();
                    return;
                  }
                }
                onSubmit?.();
              }}
              disabled={submitting}
              aria-busy={submitting || undefined}
            >
              {submitting ? 'Guardando…' : submitLabel || 'Guardar'} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminToolbar({
  search,
  setSearch,
  filterLabel,
  filterValue,
  setFilter,
  filterOptions,
  onAction,
}: {
  search: string;
  setSearch: (v: string) => void;
  filterLabel?: string;
  filterValue?: string;
  setFilter?: (v: string) => void;
  filterOptions?: string[];
  onAction?: (msg: string) => void;
}) {
  return (
    <div className="toolbar">
      <div className="search-box">
        <Search size={17} />
        <input
          aria-label="Buscar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
        />
      </div>
      {filterLabel && filterOptions && setFilter && (
        <div className="filter-dropdown">
          <button className="filter-button">
            <span>{filterValue}</span>
            <ChevronDown size={15} />
          </button>
          <div className="filter-menu">
            {filterOptions.map((opt) => (
              <button
                key={opt}
                className={filterValue === opt ? 'active' : ''}
                onClick={() => setFilter(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
      {onAction && (
        <button
          className="icon-btn"
          aria-label="Más filtros"
          onClick={() => onAction('Más filtros abiertos')}
        >
          <Settings size={18} />
        </button>
      )}
    </div>
  );
}

function AdminTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  const labeledRows = Children.map(children, (row) => {
    if (!isValidElement<{ children?: ReactNode }>(row) || row.type !== 'tr') return row;

    const cells = Children.map(row.props.children, (cell, index) => {
      if (!isValidElement(cell) || cell.type !== 'td') return cell;
      return cloneElement(cell, { 'data-label': headers[index] } as typeof cell.props);
    });

    return cloneElement(row as ReactElement<{ children?: ReactNode }>, { children: cells });
  });

  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{labeledRows}</tbody>
      </table>
    </div>
  );
}

function StatusSwitch({
  checked,
  label,
  onChange,
  disabled = false,
  disabledReason,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      className={`adm-status-switch ${checked ? 'on' : ''}`}
      aria-label={label}
      aria-pressed={checked}
      title={disabled && disabledReason ? disabledReason : label}
      disabled={disabled}
      onClick={onChange}
    >
      <span />
    </button>
  );
}

function EditIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="button small secondary adm-icon-action"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Pencil size={14} />
    </button>
  );
}

function MiniChart({
  data,
  labels,
  color = '#b88d50',
}: {
  data: number[];
  labels: string[];
  color?: string;
}) {
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 720},${210 - (v / max) * 180}`)
    .join(' ');
  const fillPoints = `${points} 720,210 0,210`;
  const chartLabels =
    labels.length <= 5
      ? labels
      : labels.filter(
          (_, index) =>
            index === 0 ||
            index === Math.floor((labels.length - 1) / 2) ||
            index === labels.length - 1,
        );
  return (
    <div className="chart-area">
      <div className="chart">
        <div className="chart-y">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>
        <div className="chart-lines">
          <i />
          <i />
          <i />
          <i />
          <i />
          <svg viewBox="0 0 720 210" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`fill-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity=".32" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={fillPoints} fill={`url(#fill-${color.replace('#', '')})`} />
            <polyline points={points} fill="none" stroke={color} strokeWidth="3" />
          </svg>
        </div>
        <div className="chart-x">
          {chartLabels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="adm-bar-chart">
      {data.map((v, i) => (
        <div className="adm-bar-col" key={i}>
          <div className="adm-bar" style={{ height: `${(v / max) * 100}%` }}>
            <span className="adm-bar-val">{money(v)}</span>
          </div>
          <span className="adm-bar-label">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

type AdminData = {
  users: AdminUser[];
  roles: AdminRole[];
  rooms: AdminRoom[];
  roomTypes: AdminRoomType[];
  roomFeatures: RoomFeature[];
  seasonRates: SeasonRate[];
  promos: Promo[];
  amenities: Amenity[];
  roomServiceItems: RoomServiceItem[];
  inventory: InventoryProduct[];
  movements: InventoryMovement[];
  cashMovements: CashMovement[];
  bookings: Booking[];
  cashSessions: CashSession[];
  audit: AuditEntry[];
  recentActivity: AuditEntry[];
};

type ScreenState =
  { status: 'loading' } | { status: 'error'; message: string } | ({ status: 'ready' } & AdminData);

type OperationalReportState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: OperationalReport };

function getErrorMessage(cause: unknown): string {
  return getUserFacingErrorMessage(cause, 'No fue posible cargar el panel de administración.');
}

function buildAuditEntries(logs: AuditLog[], users: User[]): AuditEntry[] {
  return logs.map((entry, index) => ({
    id: parseDbId(entry.id, index + 1),
    user: userNameById(users, entry.userId),
    date: toDtoCalendarDate(entry.occurredAt),
    time: formatDbTime(entry.occurredAt),
    module: auditModuleLabel(entry.module),
    action: auditActionLabel(entry.action),
    description: auditDescription(entry.entityType, entry.entityId, entry.details),
  }));
}

export function AdminContent({
  nav,
  onAction,
  onNavigate,
  onRolePermissionsChange,
  currentUserEmail,
}: {
  nav: string;
  onAction: (message: string) => void;
  onNavigate?: (nav: string) => void;
  onRolePermissionsChange?: (roleCode: string, permissions: Record<string, boolean>) => void;
  /** Correo de la sesión: la propia cuenta no se puede desactivar. */
  currentUserEmail?: string;
}) {
  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setScreen({ status: 'loading' });
      try {
        const [
          users,
          roles,
          rooms,
          roomTypes,
          roomFeatures,
          rates,
          amenitiesData,
          products,
          inventoryItems,
          inventoryMovements,
          bookings,
          cashSessions,
          cashMovementsData,
          auditLogs,
          promotions,
        ] = await Promise.all([
          personnelService.getUsers(),
          personnelService.getRoles(),
          roomService.getRooms(),
          roomService.getRoomTypes(),
          roomService.getRoomFeatures(),
          roomService.getRates(),
          catalogService.getAdminAmenities(),
          catalogService.getAdminProducts(),
          inventoryService.getItems(),
          inventoryService.getMovements(),
          bookingService.getBookings(),
          cashService.getSessions(),
          cashService.getMovements(),
          auditService.getLogs(),
          promotionService.getPromotions(),
        ]);

        const adminUsers: AdminUser[] = users.map((user, index) =>
          adminUserFromDomain(user, roles, index),
        );

        const adminRoles: AdminRole[] = roles.map((role, index) =>
          adminRoleFromDomain(role, users, index),
        );

        const adminRooms: AdminRoom[] = rooms.map((room, index) => {
          const roomType = roomTypes.find((type) => type.id === room.roomTypeId);
          const rate = rates.find((item) => item.roomTypeId === room.roomTypeId);
          const features = (roomType?.roomFeatureIds ?? [])
            .map((featureId) => roomFeatures.find((feature) => feature.id === featureId)?.name)
            .filter((name): name is string => Boolean(name));
          return {
            id: index + 1,
            dbId: room.id,
            roomTypeId: room.roomTypeId,
            number: room.roomNumber,
            floor: `Piso ${room.floor}`,
            type: roomTypeNameById(roomTypes, room.roomTypeId),
            capacity: roomType?.capacity ?? 2,
            rate: rate ? centsToAmount(rate.priceCents) : 0,
            status: room.active
              ? roomStatusLabel(room.status, room.housekeepingStatus)
              : 'Archivada',
            active: room.active,
            features,
          };
        });

        const baseRates = new Map(
          roomTypes.map((roomType) => [roomType.id, findBaseRate(rates, roomType.id)]),
        );
        const adminRoomTypes: AdminRoomType[] = roomTypes.map((roomType, index) => ({
          id: parseDbId(roomType.id, index + 1),
          dbId: roomType.id,
          name: roomType.name,
          capacity: roomType.capacity,
          description: roomType.description ?? '',
          roomFeatureIds: [...roomType.roomFeatureIds],
          features: roomType.roomFeatureIds
            .map((featureId) => roomFeatures.find((feature) => feature.id === featureId)?.name)
            .filter((name): name is string => Boolean(name)),
          basePrice: centsToAmount(baseRates.get(roomType.id)?.priceCents ?? 0),
          status: roomType.active ? 'Activo' : 'Inactivo',
          images: roomType.images,
        }));

        const seasonRates: SeasonRate[] = getSeasonalRates(rates).map((rate, index) => ({
          id: parseDbId(rate.id, index + 1),
          dbId: rate.id,
          roomType: roomTypeNameById(roomTypes, rate.roomTypeId),
          seasonName: rate.name,
          startDate: toDtoCalendarDate(rate.validFrom),
          endDate: toDtoCalendarDate(rate.validTo),
          baseRate: centsToAmount(baseRates.get(rate.roomTypeId)?.priceCents ?? 0),
          seasonalRate: centsToAmount(rate.priceCents),
          minimumNights: rate.minimumNights,
          status: rate.active ? 'Activa' : 'Inactiva',
        }));

        const promos: Promo[] = promotions.map((promo, index) => ({
          id: parseDbId(promo.id, index + 1),
          dbId: promo.id,
          name: promo.name,
          code: promo.code,
          percentage: promo.discountPercent,
          startDate: toDtoCalendarDate(promo.validFrom),
          endDate: toDtoCalendarDate(promo.validTo),
          conditions: promo.description,
          status: promo.active ? 'Activa' : 'Inactiva',
        }));

        const amenities: Amenity[] = amenitiesData.map(adminAmenityFromDomain);

        const roomServiceItems: RoomServiceItem[] = products.map(adminProductFromDomain);

        const inventory: InventoryProduct[] = inventoryItems.map((item, index) => {
          const product = products.find((productItem) => productItem.id === item.productId);
          return {
            id: parseDbId(item.id, index + 1),
            dbId: item.id,
            sku: item.sku,
            categoryCode: item.category,
            unit: item.unit,
            name: item.name,
            category: INVENTORY_CATEGORY_LABELS[item.category],
            stock: item.currentQuantity,
            minStock: item.minimumQuantity,
            price: product ? centsToAmount(product.priceCents) : 0,
            status: item.active ? 'Activo' : 'Inactivo',
            images: item.images ?? [],
          };
        });

        const movements: InventoryMovement[] = inventoryMovements.map((movement, index) => ({
          id: parseDbId(movement.id, index + 1),
          dbId: movement.id,
          date: toDtoCalendarDate(movement.occurredAt),
          product:
            inventoryItems.find((item) => item.id === movement.inventoryItemId)?.name ??
            movement.inventoryItemId,
          type: movement.type === 'in' ? 'Entrada' : 'Salida',
          quantity: movement.quantity,
          reason: INVENTORY_REASON_LABELS[movement.reason],
          responsible: userNameById(users, movement.responsibleUserId),
        }));

        const cashMovements: CashMovement[] = cashMovementsData.map((movement, index) => ({
          id: parseDbId(movement.id, index + 1),
          dbId: movement.id,
          date: toDtoCalendarDate(movement.occurredAt),
          concept: movement.concept,
          type: movement.type === 'income' ? 'Ingreso' : 'Egreso',
          amount: centsToAmount(movement.amountCents),
          responsible: userNameById(users, movement.responsibleUserId),
        }));

        const audit = buildAuditEntries(auditLogs, users);
        const recentActivity = buildAuditEntries(
          [...auditLogs]
            .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
            .slice(0, 4),
          users,
        );

        if (active) {
          setScreen({
            status: 'ready',
            users: adminUsers,
            roles: adminRoles,
            rooms: adminRooms,
            roomTypes: adminRoomTypes,
            roomFeatures,
            seasonRates,
            promos,
            amenities,
            roomServiceItems,
            inventory,
            movements,
            cashMovements,
            bookings,
            cashSessions,
            audit,
            recentActivity,
          });
        }
      } catch (cause) {
        if (active) setScreen({ status: 'error', message: getErrorMessage(cause) });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (nav === 'Catálogo de Conserjería') {
    return <ConciergeCatalogPanel onAction={onAction} />;
  }

  if (nav === 'Catálogo de Limpieza') {
    return (
      <div className="adm-catalog-stack">
        <HousekeepingCatalogPanel onAction={onAction} />
        <HousekeepingChecklistTemplatePanel onAction={onAction} />
      </div>
    );
  }

  if (screen.status === 'loading') {
    return <LoadingState label="Cargando el panel de administración..." />;
  }

  if (screen.status === 'error') {
    return (
      <ErrorState
        title="No pudimos cargar el panel de administración"
        description={screen.message}
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  return (
    <AdminContentReady
      key={reloadKey}
      nav={nav}
      onAction={onAction}
      onNavigate={onNavigate}
      onRefresh={() => setReloadKey((current) => current + 1)}
      onRolePermissionsChange={onRolePermissionsChange}
      currentUserEmail={currentUserEmail}
      initialAdminUsers={screen.users}
      initialAdminRoles={screen.roles}
      initialAdminRooms={screen.rooms}
      initialAdminRoomTypes={screen.roomTypes}
      initialRoomFeatures={screen.roomFeatures}
      initialSeasonRates={screen.seasonRates}
      initialPromos={screen.promos}
      initialAmenities={screen.amenities}
      initialRoomServiceItems={screen.roomServiceItems}
      initialInventory={screen.inventory}
      initialMovements={screen.movements}
      initialCashMovements={screen.cashMovements}
      initialBookings={screen.bookings}
      initialCashSessions={screen.cashSessions}
      initialAudit={screen.audit}
      recentActivity={screen.recentActivity}
    />
  );
}

function AdminContentReady({
  nav,
  onAction,
  onNavigate,
  onRefresh,
  onRolePermissionsChange,
  currentUserEmail,
  initialAdminUsers,
  initialAdminRoles,
  initialAdminRooms,
  initialAdminRoomTypes,
  initialRoomFeatures,
  initialSeasonRates,
  initialPromos,
  initialAmenities,
  initialRoomServiceItems,
  initialInventory,
  initialMovements,
  initialCashMovements,
  initialBookings,
  initialCashSessions,
  initialAudit,
  recentActivity,
}: {
  nav: string;
  onAction: (message: string) => void;
  onNavigate?: (nav: string) => void;
  onRefresh: () => void;
  onRolePermissionsChange?: (roleCode: string, permissions: Record<string, boolean>) => void;
  currentUserEmail?: string;
  initialAdminUsers: AdminUser[];
  initialAdminRoles: AdminRole[];
  initialAdminRooms: AdminRoom[];
  initialAdminRoomTypes: AdminRoomType[];
  initialRoomFeatures: RoomFeature[];
  initialSeasonRates: SeasonRate[];
  initialPromos: Promo[];
  initialAmenities: Amenity[];
  initialRoomServiceItems: RoomServiceItem[];
  initialInventory: InventoryProduct[];
  initialMovements: InventoryMovement[];
  initialCashMovements: CashMovement[];
  initialBookings: Booking[];
  initialCashSessions: CashSession[];
  initialAudit: AuditEntry[];
  recentActivity: AuditEntry[];
}) {
  const [users, setUsers] = useState(initialAdminUsers);
  const [roles, setRoles] = useState(initialAdminRoles);
  const [rooms, setRooms] = useState(initialAdminRooms);
  const [roomTypes, setRoomTypes] = useState(initialAdminRoomTypes);
  const [roomFeatures, setRoomFeatures] = useState(initialRoomFeatures);
  const [seasonRates, setSeasonRates] = useState(initialSeasonRates);
  const [promos, setPromos] = useState(initialPromos);
  const [amenities, setAmenities] = useState(initialAmenities);
  const [rsItems, setRsItems] = useState(initialRoomServiceItems);
  const [deletingRsId, setDeletingRsId] = useState<string | null>(null);
  const [pendingDeleteRsItem, setPendingDeleteRsItem] = useState<RoomServiceItem | null>(null);
  const [pendingDeactivateUser, setPendingDeactivateUser] = useState<AdminUser | null>(null);
  const [changingUserStatusId, setChangingUserStatusId] = useState<string | null>(null);

  const changeUserStatus = async (target: AdminUser, status: 'active' | 'inactive') => {
    setChangingUserStatusId(target.dbId);
    try {
      const updated = await personnelService.updateUser(target.dbId, {
        roleId: target.roleDbId ?? roleIdFromDisplay(roles, target.role),
        status,
      });
      setUsers((current) =>
        current.map((item, index) =>
          item.dbId === target.dbId ? adminUserFromAdminRoles(updated, roles, index) : item,
        ),
      );
      onAction(status === 'inactive' ? 'Usuario desactivado' : 'Usuario activado');
    } catch (error) {
      onAction(serviceErrorMessage(error));
    } finally {
      setChangingUserStatusId(null);
    }
  };
  const [inventory, setInventory] = useState(initialInventory);
  const [movements, setMovements] = useState(initialMovements);
  const [cashMovements, setCashMovements] = useState(initialCashMovements);
  const [bookings] = useState(initialBookings);
  const [cashSessions, setCashSessions] = useState(initialCashSessions);
  const [audit] = useState(initialAudit);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todos');

  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editRole, setEditRole] = useState<AdminRole | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editRoom, setEditRoom] = useState<AdminRoom | null>(null);
  const [showRoomTypeModal, setShowRoomTypeModal] = useState(false);
  const [showRoomFeatureCatalog, setShowRoomFeatureCatalog] = useState(false);
  const [editRoomType, setEditRoomType] = useState<AdminRoomType | null>(null);
  const [showSeasonRateModal, setShowSeasonRateModal] = useState(false);
  const [editSeasonRate, setEditSeasonRate] = useState<SeasonRate | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<
    | { kind: 'room'; id: string; label: string; active: boolean }
    | { kind: 'roomType'; id: string; label: string; active: boolean }
    | { kind: 'rate'; id: string; label: string; active: boolean }
    | null
  >(null);
  const [archiving, setArchiving] = useState(false);
  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const active = !archiveTarget.active;
      if (archiveTarget.kind === 'room') {
        const updated = await roomService.updateRoom(archiveTarget.id, { active });
        setRooms((current) =>
          current.map((item) =>
            item.dbId === updated.id
              ? {
                  ...item,
                  active: updated.active,
                  status: updated.active
                    ? roomStatusLabel(updated.status, updated.housekeepingStatus)
                    : 'Archivada',
                }
              : item,
          ),
        );
      } else if (archiveTarget.kind === 'roomType') {
        const updated = await roomService.updateRoomType(archiveTarget.id, { active });
        setRoomTypes((current) =>
          current.map((item) =>
            item.dbId === updated.id
              ? { ...item, status: updated.active ? 'Activo' : 'Inactivo' }
              : item,
          ),
        );
      } else {
        const updated = await roomService.updateRate(archiveTarget.id, { active });
        setSeasonRates((current) =>
          current.map((item) =>
            item.dbId === updated.id
              ? { ...item, status: updated.active ? 'Activa' : 'Inactiva' }
              : item,
          ),
        );
      }
      onAction(`${archiveTarget.label} ${active ? 'restaurada' : 'archivada'} correctamente`);
      setArchiveTarget(null);
    } catch (cause) {
      notifyError(cause);
    } finally {
      setArchiving(false);
    }
  };
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editPromo, setEditPromo] = useState<Promo | null>(null);
  const [showAmenityModal, setShowAmenityModal] = useState(false);
  const [editAmenity, setEditAmenity] = useState<Amenity | null>(null);
  const [showRsItemModal, setShowRsItemModal] = useState(false);
  const [editRsItem, setEditRsItem] = useState<RoomServiceItem | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState<InventoryProduct | null>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashSessionModal, setCashSessionModal] = useState<'open' | 'close' | null>(null);
  const [openCashSessions, setOpenCashSessions] = useState<CashSession[]>([]);
  const [openCashSessionsError, setOpenCashSessionsError] = useState<string | null>(null);
  const [exceptionalClose, setExceptionalClose] = useState<CashSession | null>(null);
  const loadOpenCashSessions = useCallback(async () => {
    try {
      setOpenCashSessions(await cashService.getOpenSessions());
      setOpenCashSessionsError(null);
    } catch (cause) {
      setOpenCashSessions([]);
      setOpenCashSessionsError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);
  useEffect(() => {
    if (nav === 'Caja') void loadOpenCashSessions();
  }, [nav, loadOpenCashSessions]);
  const [cashOpen, setCashOpen] = useState(() =>
    initialCashSessions.some((session) => session.status === 'open'),
  );
  const [reportFilter, setReportFilter] = useState<ReportPeriod>('Mes');
  const [reportTab, setReportTab] = useState<AdminReportTab>('Ocupación');
  const [operationalReport, setOperationalReport] = useState<OperationalReportState>({
    status: 'idle',
  });
  const [dashboardTab, setDashboardTab] = useState<'Ocupación' | 'Ingresos' | 'Reservas'>(
    'Ocupación',
  );
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>('30 días');
  const usersSection: UsersSection =
    nav === 'Roles y permisos' ? 'Roles y permisos' : 'Gestión de usuarios';
  const roomsSection: RoomsSection =
    nav === 'Tipos de habitación' ? 'Tipos de habitación' : 'Gestión de habitaciones';
  const inventorySection: InventorySection =
    nav === 'Movimientos de inventario' ? 'Movimientos de inventario' : 'Gestión de inventario';
  const ratesSection: RatesSection = 'Tarifas por temporada';
  const servicesSection: ServicesSection =
    nav === 'Catálogo de Room Service' ? 'Catálogo de Room Service' : 'Amenidades';
  const reportGroup: ReportGroup =
    nav === 'Reportes financieros' ? 'Reportes financieros' : 'Resumen operativo';
  const visibleReportTabs = reportTabsByGroup[reportGroup];
  const activeReportTab = visibleReportTabs.includes(reportTab) ? reportTab : visibleReportTabs[0];

  const loadOperationalReport = useCallback(async (period: ReportPeriod) => {
    const { start, end } = getReportPeriodRange(period);
    setOperationalReport({ status: 'loading' });
    try {
      const data = await reportingService.getOperationalReport({
        from: toDtoCalendarDate(start),
        to: toDtoCalendarDate(end),
      });
      setOperationalReport({ status: 'ready', data });
    } catch (cause) {
      setOperationalReport({ status: 'error', message: getErrorMessage(cause) });
    }
  }, []);

  useEffect(() => {
    if (nav === 'Reportes' || nav === 'Resumen operativo' || nav === 'Reportes financieros') {
      void loadOperationalReport(reportFilter);
    }
  }, [loadOperationalReport, nav, reportFilter]);

  const resetSearch = () => {
    setSearch('');
    setFilter('Todos');
  };

  useEffect(() => {
    setSearch('');
    setFilter('Todos');
  }, [nav]);

  const notifyError = (cause: unknown) => {
    onAction(getErrorMessage(cause));
  };

  const downloadCsv = (
    fileName: string,
    data: Record<string, unknown>[],
    headers: { key: string; label: string }[],
    emptyMessage: string,
  ) => {
    if (!exportToCSV(fileName, data, headers)) onAction(emptyMessage);
    else onAction(`Archivo ${fileName}.csv descargado`);
  };

  const exportAdminReport = () => {
    const period = reportFilter;
    const periodCashMovements = cashMovements.filter((movement) =>
      isDateInReportPeriod(new Date(`${movement.date}T12:00:00`), period),
    );
    const periodBookings = bookings.filter((booking) =>
      isDateInReportPeriod(booking.checkIn, period),
    );
    const periodCancelledBookings = bookings.filter(
      (booking) =>
        booking.status === 'cancelled' && isDateInReportPeriod(booking.updatedAt, period),
    );
    let data: Record<string, unknown>[] = [];
    let headers: { key: string; label: string }[] = [];

    if (activeReportTab === 'Ocupación') {
      data = rooms.map((room) => ({
        periodo: period,
        habitacion: room.number,
        estado: room.status,
      }));
      headers = [
        { key: 'periodo', label: 'Periodo' },
        { key: 'habitacion', label: 'Habitación' },
        { key: 'estado', label: 'Estado' },
      ];
    } else if (activeReportTab === 'Ingresos') {
      const officialReport = operationalReport.status === 'ready' ? operationalReport.data : null;
      const reportedRevenue = officialReport?.revenueCents ?? 0;
      data =
        reportedRevenue > 0 && officialReport
          ? [
              {
                periodo: period,
                fecha: `${officialReport.from} / ${officialReport.to}`,
                concepto: 'Ingresos totales del reporte financiero',
                monto: centsToAmount(reportedRevenue),
                responsable: 'Reporte financiero',
              },
            ]
          : periodCashMovements
              .filter((movement) => movement.type === 'Ingreso')
              .map((movement) => ({
                periodo: period,
                fecha: movement.date,
                concepto: movement.concept,
                monto: movement.amount,
                responsable: movement.responsible,
              }));
      headers = [
        { key: 'periodo', label: 'Periodo' },
        { key: 'fecha', label: 'Fecha' },
        { key: 'concepto', label: 'Concepto' },
        { key: 'monto', label: 'Monto' },
        { key: 'responsable', label: 'Responsable' },
      ];
    } else if (activeReportTab === 'Reservas') {
      data = periodBookings.map((booking) => ({
        periodo: period,
        codigo: booking.confirmationCode,
        estado: booking.status,
        entrada: toDtoCalendarDate(booking.checkIn),
        salida: toDtoCalendarDate(booking.checkOut),
        monto: centsToAmount(booking.totalAmountCents),
      }));
      headers = [
        { key: 'periodo', label: 'Periodo' },
        { key: 'codigo', label: 'Código' },
        { key: 'estado', label: 'Estado' },
        { key: 'entrada', label: 'Entrada' },
        { key: 'salida', label: 'Salida' },
        { key: 'monto', label: 'Monto' },
      ];
    } else if (activeReportTab === 'Cancelaciones') {
      data = periodCancelledBookings.map((booking) => ({
        periodo: period,
        codigo: booking.confirmationCode,
        fecha: toDtoCalendarDate(booking.updatedAt),
        motivo: booking.notes ?? '',
      }));
      headers = [
        { key: 'periodo', label: 'Periodo' },
        { key: 'codigo', label: 'Código' },
        { key: 'fecha', label: 'Fecha' },
        { key: 'motivo', label: 'Motivo' },
      ];
    }

    downloadCsv(
      `reportes-${activeReportTab.toLowerCase()}-${exportDateSuffix()}`,
      data,
      headers,
      `No hay datos de ${activeReportTab.toLowerCase()} para exportar`,
    );
  };

  const exportCashReport = (
    visibleCashMovements = cashMovements,
    visibleCashSessions = cashSessions,
  ) => {
    const rows: Record<string, unknown>[] = [
      ...visibleCashMovements.map((movement) => ({
        registro: 'Movimiento',
        fecha: movement.date,
        concepto: movement.concept,
        tipo: movement.type,
        monto: movement.amount,
        responsable: movement.responsible,
      })),
      ...visibleCashSessions.map((session) => ({
        registro: 'Corte',
        fecha: toDtoCalendarDate(session.closedAt ?? session.openedAt),
        concepto: session.status === 'closed' ? 'Cierre de caja' : 'Apertura de caja',
        tipo: session.status,
        monto: centsToAmount(session.countedBalanceCents ?? session.openingBalanceCents),
        responsable: session.closedByUserId ?? session.openedByUserId ?? '',
      })),
    ];
    downloadCsv(
      `caja-${exportDateSuffix()}`,
      rows,
      [
        { key: 'registro', label: 'Registro' },
        { key: 'fecha', label: 'Fecha' },
        { key: 'concepto', label: 'Concepto' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'monto', label: 'Monto' },
        { key: 'responsable', label: 'Responsable' },
      ],
      'No hay movimientos ni cierres de caja para exportar',
    );
  };

  const exportAuditReport = () => {
    const filtered = audit.filter((entry) => {
      const matchesSearch = `${entry.user} ${entry.module} ${entry.action} ${entry.description}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesFilter =
        filter === 'Todos' || entry.module === filter || entry.action === filter;
      return matchesSearch && matchesFilter;
    });
    downloadCsv(
      `auditoria-${exportDateSuffix()}`,
      filtered,
      [
        { key: 'user', label: 'Usuario' },
        { key: 'date', label: 'Fecha' },
        { key: 'time', label: 'Hora' },
        { key: 'module', label: 'Módulo' },
        { key: 'action', label: 'Acción' },
        { key: 'description', label: 'Descripción' },
      ],
      'No hay registros de auditoría para exportar',
    );
  };

  // ─── DASHBOARD ───
  if (nav === 'Dashboard') {
    const lowStock = inventory.filter((p) => p.stock <= p.minStock);
    const occupiedRooms = rooms.filter((room) => room.status === 'Ocupada').length;
    const availableRooms = rooms.filter((room) => room.status === 'Disponible').length;
    const cleaningRooms = rooms.filter((room) => room.status === 'Limpieza').length;
    const maintenanceRooms = rooms.filter((room) => room.status === 'Mantenimiento').length;
    const occupancyPercent =
      rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 1000) / 10 : 0;
    const latestCashSession =
      [...cashSessions].sort(
        (left, right) => right.openedAt.getTime() - left.openedAt.getTime(),
      )[0] ?? null;
    const localTotalIncome = cashMovements
      .filter((movement) => movement.type === 'Ingreso')
      .reduce((sum, movement) => sum + movement.amount, 0);
    const localTotalExpenses = cashMovements
      .filter((movement) => movement.type === 'Egreso')
      .reduce((sum, movement) => sum + movement.amount, 0);
    const totalIncome =
      latestCashSession?.totalIncomeCents !== undefined
        ? centsToAmount(latestCashSession.totalIncomeCents)
        : localTotalIncome;
    const totalExpenses =
      latestCashSession?.totalExpenseCents !== undefined
        ? centsToAmount(latestCashSession.totalExpenseCents)
        : localTotalExpenses;
    const openingBalance = latestCashSession
      ? centsToAmount(latestCashSession.openingBalanceCents)
      : 0;
    const currentBalance =
      latestCashSession?.expectedBalanceCents !== undefined
        ? centsToAmount(latestCashSession.expectedBalanceCents)
        : openingBalance + totalIncome - totalExpenses;
    const dashboardChart = {
      data:
        dashboardTab === 'Ocupación'
          ? rooms.length > 0
            ? rooms.map((_, index) =>
                Math.round(((index + 1) / Math.max(rooms.length, 1)) * occupancyPercent),
              )
            : [0]
          : dashboardTab === 'Ingresos'
            ? cashMovements.length > 0
              ? cashMovements.map((_, index) =>
                  Math.round(((index + 1) / Math.max(cashMovements.length, 1)) * totalIncome),
                )
              : [0]
            : bookings.length > 0
              ? bookings.map((_, index) => index + 1)
              : [0],
      labels:
        dashboardTab === 'Ocupación'
          ? rooms.length > 0
            ? rooms.map((room) => room.number)
            : ['Sin datos']
          : dashboardTab === 'Ingresos'
            ? cashMovements.length > 0
              ? cashMovements.map((movement) => movement.date)
              : ['Sin datos']
            : bookings.length > 0
              ? bookings.map((booking) => booking.confirmationCode)
              : ['Sin datos'],
      value:
        dashboardTab === 'Ocupación'
          ? `${occupancyPercent}%`
          : dashboardTab === 'Ingresos'
            ? money(totalIncome)
            : String(bookings.length),
      change: 'Calculado con datos cargados',
    };
    const dashboardLegend =
      dashboardTab === 'Ocupación'
        ? 'Ocupación promedio'
        : dashboardTab === 'Ingresos'
          ? 'Ingresos acumulados'
          : 'Reservas confirmadas';
    return (
      <>
        <div className="dashboard-grid">
          <div className="panel main-panel">
            <div className="panel-heading">
              <div>
                <h3>Rendimiento del hotel</h3>
                <p>Ocupación y rendimiento durante este periodo</p>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  if (onNavigate) onNavigate('Resumen operativo');
                  else onAction('Reportes seleccionado');
                }}
              >
                Ver todo <ArrowRight size={15} />
              </button>
            </div>
            <div className="chart-tabs">
              {(['Ocupación', 'Ingresos', 'Reservas'] as const).map((tab) => (
                <button
                  key={tab}
                  className={dashboardTab === tab ? 'active' : ''}
                  onClick={() => setDashboardTab(tab)}
                >
                  {tab}
                </button>
              ))}
              <div className="filter-dropdown">
                <button className="filter-button">
                  <span>{dashboardPeriod}</span>
                  <ChevronDown size={14} />
                </button>
                <div className="filter-menu">
                  {dashboardPeriodOptions.map((period) => (
                    <button
                      key={period}
                      className={dashboardPeriod === period ? 'active' : ''}
                      onClick={() => setDashboardPeriod(period)}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <MiniChart
              data={dashboardChart.data}
              labels={dashboardChart.labels}
              color={dashboardTab === 'Reservas' ? '#5f7f9d' : undefined}
            />
            <div className="chart-footer">
              <span>
                <i className="legend-dot" /> {dashboardLegend}
              </span>
              <strong>{dashboardChart.value}</strong>
              <span className="positive">{dashboardChart.change}</span>
            </div>
          </div>
          <div className="panel side-panel">
            <div className="panel-heading">
              <div>
                <h3>Alertas de stock</h3>
                <p>Productos con inventario bajo</p>
              </div>
              <span className={`status-pill ${lowStock.length > 0 ? 'warning' : 'success'}`}>
                {lowStock.length} alertas
              </span>
            </div>
            {lowStock.length === 0 ? (
              <div className="hk-empty">
                <Check size={22} />
                <p>Todas las existencias están correctas</p>
              </div>
            ) : (
              <div className="adm-alert-list">
                {lowStock.map((p) => (
                  <div className="adm-alert-row" key={p.id}>
                    <span className="status-pill warning">
                      <TriangleAlert size={12} /> Stock bajo
                    </span>
                    <div>
                      <strong>{p.name}</strong>
                      <span>
                        {p.category} · {p.stock} unidades (mín: {p.minStock})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="hk-summary-divider" />
            <div className="panel-heading">
              <div>
                <h3>Estado de caja</h3>
                <p>Resumen de hoy</p>
              </div>
            </div>
            <div className="adm-cash-summary">
              <div>
                <span>Saldo inicial</span>
                <strong>{money(openingBalance)}</strong>
              </div>
              <div>
                <span>Ingresos</span>
                <strong className="success-text">{money(totalIncome)}</strong>
              </div>
              <div>
                <span>Egresos</span>
                <strong className="terracotta-text">{money(totalExpenses)}</strong>
              </div>
              <div>
                <span>Saldo actual</span>
                <strong>{money(currentBalance)}</strong>
              </div>
            </div>
          </div>
        </div>
        <div className="bottom-grid">
          <div className="panel occupancy-panel">
            <div className="panel-heading">
              <div>
                <h3>Estado de habitaciones</h3>
                <p>Vista rápida del inventario en tiempo real</p>
              </div>
              <button
                className="button small secondary"
                onClick={() => {
                  if (onNavigate) onNavigate('Gestión de habitaciones');
                  else onAction('Habitaciones seleccionado');
                }}
              >
                Gestionar <ArrowRight size={14} />
              </button>
            </div>
            <div className="room-stats">
              <div className="room-stat">
                <span className="room-dot occupied" />
                <div>
                  <strong>{String(occupiedRooms).padStart(2, '0')}</strong>
                  <small>Ocupadas</small>
                </div>
              </div>
              <div className="room-stat">
                <span className="room-dot available" />
                <div>
                  <strong>{String(availableRooms).padStart(2, '0')}</strong>
                  <small>Disponibles</small>
                </div>
              </div>
              <div className="room-stat">
                <span className="room-dot cleaning" />
                <div>
                  <strong>{String(cleaningRooms).padStart(2, '0')}</strong>
                  <small>Limpieza</small>
                </div>
              </div>
              <div className="room-stat">
                <span className="room-dot maintenance" />
                <div>
                  <strong>{String(maintenanceRooms).padStart(2, '0')}</strong>
                  <small>Mantenimiento</small>
                </div>
              </div>
            </div>
            <div className="progress-line">
              <span>Ocupación general</span>
              <strong>{occupancyPercent}%</strong>
              <div>
                <i style={{ width: `${occupancyPercent}%` }} />
              </div>
            </div>
          </div>
          <div className="panel quick-panel">
            <div className="panel-heading">
              <div>
                <h3>Actividad reciente</h3>
                <p>Últimos movimientos del hotel</p>
              </div>
              <button className="icon-btn" onClick={onRefresh} aria-label="Actualizar actividad">
                <Activity size={17} />
              </button>
            </div>
            {recentActivity.length === 0 ? (
              <div className="hk-empty">
                <Activity size={20} />
                <p>Sin actividad registrada todavía</p>
              </div>
            ) : (
              <div className="activity-list">
                {recentActivity.map((entry) => (
                  <div className="activity-item" key={entry.id}>
                    <span
                      className={`activity-dot ${entry.action === 'Anulación' || entry.action === 'Eliminación' || entry.action === 'Cierre' ? 'terracotta' : 'success'}`}
                    />
                    <div>
                      <p>
                        {entry.module} · {entry.action} · {entry.description}
                      </p>
                      <small>
                        {entry.date} {entry.time}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ─── USUARIOS Y ROLES ───
  if (nav === 'Usuarios y roles' || nav === 'Gestión de usuarios' || nav === 'Roles y permisos') {
    const roleFilterOptions = ['Todos', 'Activo', 'Inactivo', ...roles.map((role) => role.name)];
    const filtered = users.filter((u) => {
      const ms = `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase());
      const mf =
        filter === 'Todos' ||
        u.role === filter ||
        (filter === 'Activo' && u.status === 'Activo') ||
        (filter === 'Inactivo' && u.status === 'Inactivo');
      return ms && mf;
    });
    return (
      <>
        <ConfirmDialog
          open={pendingDeactivateUser !== null}
          title="Desactivar usuario"
          description={`¿Seguro que quieres desactivar a ${pendingDeactivateUser?.name ?? ''} (${pendingDeactivateUser?.email ?? ''})? No podrá iniciar sesión hasta que lo vuelvas a activar.`}
          confirmLabel="Desactivar"
          pendingLabel="Desactivando..."
          pending={
            pendingDeactivateUser !== null && changingUserStatusId === pendingDeactivateUser.dbId
          }
          onClose={() => setPendingDeactivateUser(null)}
          onConfirm={async () => {
            if (!pendingDeactivateUser) return;
            await changeUserStatus(pendingDeactivateUser, 'inactive');
            setPendingDeactivateUser(null);
          }}
        />
        {usersSection === 'Gestión de usuarios' && (
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Gestión de usuarios</h3>
                <p>Administra los usuarios del sistema y sus permisos</p>
              </div>
              <button
                className="button primary"
                onClick={() => {
                  setEditUser(null);
                  setShowUserModal(true);
                }}
              >
                <Plus size={17} /> Nuevo usuario
              </button>
            </div>
            <AdminToolbar
              search={search}
              setSearch={setSearch}
              filterLabel="Filtrar"
              filterValue={filter}
              setFilter={setFilter}
              filterOptions={roleFilterOptions}
            />
            {filtered.length === 0 ? (
              <div className="hk-empty">
                <UsersIcon size={22} />
                <p>No hay usuarios registrados</p>
              </div>
            ) : (
              <AdminTable
                headers={['Nombre', 'Correo', 'Rol', 'Estado', 'Último acceso', 'Acciones']}
              >
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                    </td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>
                      <span className={`status-pill ${statusPillClass(u.status)}`}>{u.status}</span>
                    </td>
                    <td>{u.lastAccess}</td>
                    <td className="adm-actions">
                      <EditIconButton
                        label="Editar usuario"
                        onClick={() => {
                          setEditUser(u);
                          setShowUserModal(true);
                        }}
                      />
                      <StatusSwitch
                        checked={u.status === 'Activo'}
                        label={u.status === 'Activo' ? 'Desactivar usuario' : 'Activar usuario'}
                        disabled={
                          changingUserStatusId === u.dbId ||
                          (u.status === 'Activo' &&
                            Boolean(currentUserEmail) &&
                            u.email.toLowerCase() === currentUserEmail?.toLowerCase())
                        }
                        disabledReason="No puedes desactivar tu propia cuenta"
                        onChange={() => {
                          if (u.status === 'Activo') {
                            setPendingDeactivateUser(u);
                            return;
                          }
                          void changeUserStatus(u, 'active');
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </div>
        )}
        {usersSection === 'Roles y permisos' && (
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Roles y permisos</h3>
                <p>Configura los permisos de cada rol</p>
              </div>
              <button
                className="button primary"
                onClick={() => {
                  setEditRole(null);
                  setShowRoleModal(true);
                }}
              >
                <Plus size={17} /> Nuevo rol
              </button>
            </div>
            <div className="adm-role-grid">
              {roles.map((r) => (
                <div className="adm-role-card" key={r.id}>
                  <div className="adm-role-head">
                    <div>
                      <strong>{r.name}</strong>
                      <span>{r.description}</span>
                    </div>
                    <span className="status-pill info">{r.userCount} usuarios</span>
                  </div>
                  <div className="adm-role-permission-groups">
                    {ROLE_ACCESS_GROUPS.map((group) => {
                      const activeItems = group.items.filter(
                        (p) => r.permissions[roleAccessKey(group.name, p)],
                      );
                      if (activeItems.length === 0) return null;
                      return (
                        <div className="adm-role-permission-group" key={group.name}>
                          <h4>{group.name}</h4>
                          <div className="adm-perm-list">
                            {activeItems.map((p) => (
                              <div className="adm-perm-item" key={roleAccessKey(group.name, p)}>
                                <span className="adm-perm-check on">
                                  <Check size={12} />
                                </span>
                                <span>{p}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="adm-role-actions">
                    <EditIconButton
                      label="Editar rol"
                      onClick={() => {
                        setEditRole(r);
                        setShowRoleModal(true);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {showUserModal && (
          <UserModal
            user={editUser}
            roles={roles}
            onClose={() => setShowUserModal(false)}
            onSave={async (u) => {
              try {
                // Campos separados: ya no se adivina la división por la primera palabra.
                const { firstName, lastName } = u;
                const payload = {
                  firstName,
                  lastName,
                  email: u.email,
                  roleId: roleIdFromDisplay(roles, u.role),
                  status: u.status === 'Activo' ? 'active' : 'inactive',
                  ...(u.password?.trim() ? { password: u.password } : {}),
                } as const;
                let saved = editUser
                  ? await personnelService.updateUser(editUser.dbId, payload)
                  : await personnelService.createUser({
                      firstName,
                      lastName,
                      email: u.email,
                      password: u.password ?? '',
                      roleId: payload.roleId,
                    });
                if (!editUser && payload.status === 'inactive') {
                  saved = await personnelService.updateUser(saved.id, payload);
                }
                setUsers((current) =>
                  editUser
                    ? current.map((item, index) =>
                        item.dbId === editUser.dbId
                          ? adminUserFromAdminRoles(saved, roles, index)
                          : item,
                      )
                    : [...current, adminUserFromAdminRoles(saved, roles, current.length)],
                );
                onAction(
                  editUser ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente',
                );
                setShowUserModal(false);
                setEditUser(null);
              } catch (error) {
                onAction(serviceErrorMessage(error));
              }
            }}
          />
        )}
        {showRoleModal && (
          <RoleModal
            role={editRole}
            onClose={() => setShowRoleModal(false)}
            onSave={async (r) => {
              try {
                const isEditingProtectedAdminRole =
                  editRole !== null && normalizeRoleCode(editRole.code) === 'admin';
                const nextPermissionKeys = rolePermissionKeysFromUi(
                  r.code,
                  r.permissions,
                  editRole?.permissionKeys ?? [],
                );
                let saved = editRole
                  ? await personnelService.updateRole(editRole.dbId, { name: r.name })
                  : await personnelService.createRole({
                      code: r.code,
                      name: r.name,
                      active: true,
                      permissions: nextPermissionKeys,
                    });

                if (editRole) {
                  saved = await personnelService.updateRolePermissions(
                    editRole.dbId,
                    nextPermissionKeys,
                  );
                }

                const savedRoleBase = adminRoleFromDomain(saved, [], roles.length);
                const savedRole = {
                  ...savedRoleBase,
                  permissions: isEditingProtectedAdminRole
                    ? withFixedAdminPermissions(r.permissions)
                    : savedRoleBase.permissions,
                  permissionKeys: savedRoleBase.permissionKeys,
                  userCount: editRole?.userCount ?? 0,
                };
                setRoles((current) =>
                  editRole
                    ? current.map((item) => (item.dbId === editRole.dbId ? savedRole : item))
                    : [...current, savedRole],
                );
                onRolePermissionsChange?.(savedRole.code, savedRole.permissions);
                onAction(editRole ? 'Rol actualizado correctamente' : 'Rol creado correctamente');
                setShowRoleModal(false);
                setEditRole(null);
              } catch (error) {
                onAction(serviceErrorMessage(error));
              }
            }}
          />
        )}
      </>
    );
  }

  // ─── HABITACIONES ───
  if (
    nav === 'Habitaciones' ||
    nav === 'Gestión de habitaciones' ||
    nav === 'Tipos de habitación'
  ) {
    const filtered = rooms.filter((r) => {
      const ms = `${r.number} ${r.floor} ${r.type} ${r.status}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const normalize = (value: string) =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('es');
      const selectedFilter = normalize(filter);
      const mf =
        filter === 'Todos' ||
        normalize(r.status) === selectedFilter ||
        normalize(r.type).includes(selectedFilter);
      return ms && mf;
    });
    return (
      <>
        {roomsSection === 'Gestión de habitaciones' && (
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Gestión de habitaciones</h3>
                <p>Administra las habitaciones del hotel</p>
              </div>
              <button
                className="button primary"
                onClick={() => {
                  setEditRoom(null);
                  setShowRoomModal(true);
                }}
              >
                <Plus size={17} /> Nueva habitación
              </button>
            </div>
            <AdminToolbar
              search={search}
              setSearch={setSearch}
              filterLabel="Filtrar"
              filterValue={filter}
              setFilter={setFilter}
              filterOptions={[
                'Todos',
                'Disponible',
                'Ocupada',
                'Limpieza',
                'Mantenimiento',
                'Estándar',
                'Deluxe',
                'Suite',
              ]}
            />
            {filtered.length === 0 ? (
              <div className="hk-empty">
                <BedDouble size={22} />
                <p>No hay habitaciones registradas</p>
              </div>
            ) : (
              <AdminTable
                headers={['Número', 'Piso', 'Tipo', 'Capacidad', 'Tarifa', 'Estado', 'Acciones']}
              >
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.number}</strong>
                    </td>
                    <td>{r.floor}</td>
                    <td>{r.type}</td>
                    <td>{r.capacity} huéspedes</td>
                    <td>{money(r.rate)}</td>
                    <td>
                      <span className={`status-pill ${roomStatusClass(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="adm-actions">
                      <EditIconButton
                        label="Editar habitación"
                        onClick={() => {
                          setEditRoom(r);
                          setShowRoomModal(true);
                        }}
                      />
                      <StatusSwitch
                        checked={r.status !== 'Mantenimiento' && r.active}
                        label={r.active ? 'Desactivar habitación' : 'Habitación archivada'}
                        disabled={!r.active}
                        onChange={async () => {
                          const updated = await roomService.updateRoom(r.dbId, {
                            status: r.status === 'Mantenimiento' ? 'available' : 'maintenance',
                          });
                          setRooms((cur) =>
                            cur.map((x) =>
                              x.id === r.id
                                ? {
                                    ...x,
                                    status: roomStatusLabel(
                                      updated.status,
                                      updated.housekeepingStatus,
                                    ),
                                  }
                                : x,
                            ),
                          );
                          onAction(
                            `Habitación ${r.number} ${r.status === 'Mantenimiento' ? 'activada' : 'desactivada'}`,
                          );
                        }}
                      />
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label={
                          r.active
                            ? `Archivar habitación ${r.number}`
                            : `Restaurar habitación ${r.number}`
                        }
                        title={r.active ? 'Archivar habitación' : 'Restaurar habitación'}
                        onClick={() =>
                          setArchiveTarget({
                            kind: 'room',
                            id: r.dbId,
                            label: `habitación ${r.number}`,
                            active: r.active,
                          })
                        }
                      >
                        <Archive size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </div>
        )}
        {roomsSection === 'Tipos de habitación' && (
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Tipos de habitación</h3>
                <p>Configura los tipos y sus características</p>
              </div>
              <div className="adm-heading-actions">
                <button
                  className="button secondary"
                  onClick={() => setShowRoomFeatureCatalog(true)}
                >
                  <Sparkles size={17} /> Características
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    setEditRoomType(null);
                    setShowRoomTypeModal(true);
                  }}
                >
                  <Plus size={17} /> Nuevo tipo
                </button>
              </div>
            </div>
            {roomTypes.length === 0 ? (
              <div className="hk-empty">
                <Building2 size={22} />
                <p>No hay tipos de habitación registrados</p>
              </div>
            ) : (
              <AdminTable
                headers={[
                  'Tipo',
                  'Capacidad',
                  'Características',
                  'Precio base',
                  'Estado',
                  'Acciones',
                ]}
              >
                {roomTypes.map((rt) => (
                  <tr key={rt.id}>
                    <td>
                      <div className="adm-catalog-name">
                        <div className="adm-catalog-thumb">
                          <CatalogImage
                            image={findPrimaryImage(rt.images)}
                            variant="thumb"
                            alt={`Foto principal de ${rt.name}`}
                            staffFallback
                          />
                        </div>
                        <div className="adm-table-main">
                          <strong>{rt.name}</strong>
                          <span>{rt.description}</span>
                        </div>
                      </div>
                    </td>
                    <td>{rt.capacity} huéspedes</td>
                    <td>
                      <div className="adm-inline-tags">
                        {rt.features.length > 0 ? (
                          rt.features.map((f) => (
                            <span key={f} className="adm-feature-tag">
                              {f}
                            </span>
                          ))
                        ) : (
                          <span className="muted">Sin características</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong>{money(rt.basePrice)}</strong>
                    </td>
                    <td>
                      <span className={`status-pill ${statusPillClass(rt.status)}`}>
                        {rt.status}
                      </span>
                    </td>
                    <td className="adm-actions">
                      <EditIconButton
                        label="Editar tipo de habitación"
                        onClick={() => {
                          setEditRoomType(rt);
                          setShowRoomTypeModal(true);
                        }}
                      />
                      <StatusSwitch
                        checked={rt.status === 'Activo'}
                        label={rt.status === 'Activo' ? 'Desactivar tipo' : 'Activar tipo'}
                        onChange={async () => {
                          const updated = await roomService.updateRoomType(rt.dbId, {
                            active: rt.status !== 'Activo',
                          });
                          setRoomTypes((cur) =>
                            cur.map((x) =>
                              x.id === rt.id
                                ? { ...x, status: updated.active ? 'Activo' : 'Inactivo' }
                                : x,
                            ),
                          );
                          onAction(
                            `Tipo ${rt.name} ${rt.status === 'Activo' ? 'desactivado' : 'activado'}`,
                          );
                        }}
                      />
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label={`${rt.status === 'Activo' ? 'Archivar' : 'Restaurar'} tipo ${rt.name}`}
                        title={rt.status === 'Activo' ? 'Archivar tipo' : 'Restaurar tipo'}
                        onClick={() =>
                          setArchiveTarget({
                            kind: 'roomType',
                            id: rt.dbId,
                            label: `tipo de habitación ${rt.name}`,
                            active: rt.status === 'Activo',
                          })
                        }
                      >
                        <Archive size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </div>
        )}
        {showRoomModal && (
          <RoomModal
            room={editRoom}
            roomTypes={roomTypes}
            onClose={() => setShowRoomModal(false)}
            onSave={async (r) => {
              // El modal exige al menos un dígito en el piso: "Piso 0" se guarda como 0, no como 1.
              const floor = Number(String(r.floor).replace(/\D/g, ''));
              const data = {
                room_number: r.number,
                room_type_id: r.roomTypeId,
                floor,
                status: toRoomStatusDto(r.status),
              };
              if (editRoom) {
                const updated = await roomService.updateRoom(editRoom.dbId, data);
                setRooms((cur) =>
                  cur.map((x) =>
                    x.id === editRoom.id
                      ? {
                          ...x,
                          ...r,
                          dbId: updated.id,
                          roomTypeId: updated.roomTypeId,
                          floor: `Piso ${updated.floor}`,
                          status: roomStatusLabel(updated.status, updated.housekeepingStatus),
                        }
                      : x,
                  ),
                );
                onAction('Habitación actualizada correctamente');
              } else {
                const created = await roomService.createRoom(data);
                setRooms((cur) => [
                  ...cur,
                  {
                    ...r,
                    id: parseDbId(created.id, Date.now()),
                    dbId: created.id,
                    roomTypeId: created.roomTypeId,
                    floor: `Piso ${created.floor}`,
                    status: roomStatusLabel(created.status, created.housekeepingStatus),
                  },
                ]);
                onAction('Habitación creada correctamente');
              }
              setShowRoomModal(false);
            }}
          />
        )}
        <ConfirmDialog
          open={archiveTarget?.kind === 'room'}
          title={archiveTarget?.active ? 'Archivar habitación' : 'Restaurar habitación'}
          description={`¿Seguro que quieres ${archiveTarget?.active ? 'archivar' : 'restaurar'} ${archiveTarget?.label ?? 'esta habitación'}? ${archiveTarget?.active ? 'Dejará de ofrecerse para nuevas reservas; su historial se conservará.' : 'Volverá a estar disponible según su estado operativo.'}`}
          confirmLabel={archiveTarget?.active ? 'Archivar' : 'Restaurar'}
          pendingLabel={archiveTarget?.active ? 'Archivando...' : 'Restaurando...'}
          pending={archiving}
          onClose={() => setArchiveTarget(null)}
          onConfirm={confirmArchive}
        />
        {showRoomTypeModal && (
          <RoomTypeModal
            roomType={editRoomType}
            roomFeatures={roomFeatures}
            onClose={() => setShowRoomTypeModal(false)}
            onSave={async (rt, images) => {
              if (editRoomType) {
                const updated = await roomService.updateRoomType(editRoomType.dbId, {
                  name: rt.name,
                  description: rt.description,
                  capacity: rt.capacity,
                  // Sin bed_configuration: el panel no edita camas y el backend conserva
                  // la guardada (antes se sobrescribía con la lista de características).
                  room_feature_ids: rt.roomFeatureIds,
                  active: rt.status === 'Activo',
                  images,
                });
                setRoomTypes((cur) =>
                  cur.map((x) =>
                    x.id === editRoomType.id
                      ? {
                          ...rt,
                          id: editRoomType.id,
                          dbId: updated.id,
                          status: updated.active ? 'Activo' : 'Inactivo',
                          images: updated.images,
                        }
                      : x,
                  ),
                );
                onAction('Tipo de habitación actualizado correctamente');
              } else {
                const created = await roomService.createRoomType({
                  code: rt.name.toUpperCase().replace(/\s+/g, '_').slice(0, 16),
                  name: rt.name,
                  description: rt.description,
                  capacity: rt.capacity,
                  bed_configuration: rt.name,
                  room_feature_ids: rt.roomFeatureIds,
                  active: rt.status === 'Activo',
                  images,
                });
                try {
                  await roomService.createRate({
                    room_type_id: created.id,
                    name: 'Tarifa base',
                    valid_from: toDtoCalendarDate(new Date()),
                    valid_to: '9999-12-31',
                    price_cents: amountToCents(rt.basePrice),
                    // El backend exige minimumNights (> 0); 1 = sin mínimo, igual que al leer tarifas.
                    minimum_nights: 1,
                    active: true,
                  });
                } catch (cause) {
                  setShowRoomTypeModal(false);
                  notifyError(cause);
                  onRefresh();
                  return;
                }
                setRoomTypes((cur) => [
                  ...cur,
                  {
                    ...rt,
                    id: parseDbId(created.id, Date.now()),
                    dbId: created.id,
                    status: created.active ? 'Activo' : 'Inactivo',
                    images: created.images,
                  },
                ]);
                onAction('Tipo de habitación creado correctamente');
              }
              setShowRoomTypeModal(false);
            }}
          />
        )}
        <ConfirmDialog
          open={archiveTarget?.kind === 'roomType'}
          title={
            archiveTarget?.active ? 'Archivar tipo de habitación' : 'Restaurar tipo de habitación'
          }
          description={`¿Seguro que quieres ${archiveTarget?.active ? 'archivar' : 'restaurar'} ${archiveTarget?.label ?? 'este tipo de habitación'}? ${archiveTarget?.active ? 'Se conservarán las habitaciones y reservas existentes, pero no podrá seleccionarse para nuevas reservas.' : 'Volverá a estar disponible para nuevas reservas.'}`}
          confirmLabel={archiveTarget?.active ? 'Archivar' : 'Restaurar'}
          pendingLabel={archiveTarget?.active ? 'Archivando...' : 'Restaurando...'}
          pending={archiving}
          onClose={() => setArchiveTarget(null)}
          onConfirm={confirmArchive}
        />
        {showRoomFeatureCatalog && (
          <RoomFeatureCatalogModal
            features={roomFeatures}
            onClose={() => setShowRoomFeatureCatalog(false)}
            onCreate={async (data) => {
              const created = await roomService.createRoomFeature(data);
              setRoomFeatures((current) =>
                [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
              );
              onAction('Característica creada correctamente');
            }}
            onUpdate={async (featureId, data) => {
              const updated = await roomService.updateRoomFeature(featureId, data);
              setRoomFeatures((current) =>
                current
                  .map((feature) => (feature.id === featureId ? updated : feature))
                  .sort((a, b) => a.name.localeCompare(b.name)),
              );
              setRoomTypes((current) =>
                current.map((type) => ({
                  ...type,
                  features: type.roomFeatureIds
                    .map((id) =>
                      id === featureId
                        ? updated.name
                        : roomFeatures.find((item) => item.id === id)?.name,
                    )
                    .filter((name): name is string => Boolean(name)),
                })),
              );
              onAction('Característica actualizada correctamente');
            }}
            onDelete={async (featureId) => {
              await roomService.deleteRoomFeature(featureId);
              setRoomFeatures((current) => current.filter((feature) => feature.id !== featureId));
              onAction('Característica eliminada correctamente');
            }}
          />
        )}
      </>
    );
  }

  // ─── TARIFAS ───
  if (nav === 'Tarifas' || nav === 'Tarifas por temporada') {
    return (
      <>
        {ratesSection === 'Tarifas por temporada' && (
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Tarifas por temporada</h3>
                <p>Configura tarifas especiales según la temporada</p>
              </div>
              <button
                className="button primary"
                onClick={() => {
                  setEditSeasonRate(null);
                  setShowSeasonRateModal(true);
                }}
              >
                <Plus size={17} /> Nueva tarifa de temporada
              </button>
            </div>
            {seasonRates.length === 0 ? (
              <div className="hk-empty">
                <CalendarDays size={22} />
                <p>No hay tarifas de temporada registradas</p>
              </div>
            ) : (
              <AdminTable
                headers={[
                  'Tipo de habitación',
                  'Temporada',
                  'Fechas',
                  'Tarifa base',
                  'Tarifa especial',
                  'Estado',
                  'Acciones',
                ]}
              >
                {seasonRates.map((sr) => (
                  <tr key={sr.id}>
                    <td>
                      <strong>{sr.roomType}</strong>
                    </td>
                    <td>{sr.seasonName}</td>
                    <td>
                      {sr.startDate} → {sr.endDate}
                    </td>
                    <td>{money(sr.baseRate)}</td>
                    <td>
                      <strong className="success-text">{money(sr.seasonalRate)}</strong>
                    </td>
                    <td>
                      <span className={`status-pill ${statusPillClass(sr.status)}`}>
                        {sr.status}
                      </span>
                    </td>
                    <td className="adm-actions">
                      <EditIconButton
                        label={`Editar tarifa ${sr.seasonName}`}
                        onClick={() => {
                          setEditSeasonRate(sr);
                          setShowSeasonRateModal(true);
                        }}
                      />
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label={`${sr.status === 'Activa' ? 'Archivar' : 'Restaurar'} tarifa ${sr.seasonName}`}
                        title={sr.status === 'Activa' ? 'Archivar tarifa' : 'Restaurar tarifa'}
                        onClick={() =>
                          setArchiveTarget({
                            kind: 'rate',
                            id: sr.dbId,
                            label: `tarifa ${sr.seasonName}`,
                            active: sr.status === 'Activa',
                          })
                        }
                      >
                        <Archive size={16} />
                      </button>
                      <StatusSwitch
                        checked={sr.status === 'Activa'}
                        label={sr.status === 'Activa' ? 'Desactivar tarifa' : 'Activar tarifa'}
                        onChange={async () => {
                          const updated = await roomService.updateRate(sr.dbId, {
                            active: sr.status !== 'Activa',
                          });
                          setSeasonRates((cur) =>
                            cur.map((x) =>
                              x.id === sr.id
                                ? { ...x, status: updated.active ? 'Activa' : 'Inactiva' }
                                : x,
                            ),
                          );
                          onAction(`Tarifa ${sr.status === 'Activa' ? 'desactivada' : 'activada'}`);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </div>
        )}
        {showSeasonRateModal && (
          <SeasonRateModal
            rate={editSeasonRate}
            roomTypes={roomTypes}
            onClose={() => {
              setShowSeasonRateModal(false);
              setEditSeasonRate(null);
            }}
            onSave={async (sr) => {
              const roomType = roomTypes.find((type) => type.name === sr.roomType);
              if (!roomType) {
                notifyError(new Error('Selecciona un tipo de habitacion valido.'));
                return;
              }
              const rateData = {
                room_type_id: roomType.dbId,
                name: sr.seasonName,
                valid_from: sr.startDate,
                valid_to: sr.endDate,
                price_cents: amountToCents(sr.seasonalRate),
                minimum_nights: sr.minimumNights,
                active: editSeasonRate ? editSeasonRate.status === 'Activa' : true,
              };
              const saved = editSeasonRate
                ? await roomService.updateRate(editSeasonRate.dbId, rateData)
                : await roomService.createRate(rateData);
              const next: SeasonRate = {
                ...sr,
                id: editSeasonRate?.id ?? parseDbId(saved.id, Date.now()),
                dbId: saved.id,
                baseRate: roomType.basePrice,
                seasonalRate: centsToAmount(saved.priceCents),
                status: saved.active ? 'Activa' : 'Inactiva',
              };
              setSeasonRates((cur) =>
                editSeasonRate
                  ? cur.map((item) => (item.id === editSeasonRate.id ? next : item))
                  : [...cur, next],
              );
              onAction(
                editSeasonRate
                  ? 'Tarifa de temporada actualizada'
                  : 'Tarifa de temporada creada correctamente',
              );
              setEditSeasonRate(null);
              setShowSeasonRateModal(false);
            }}
          />
        )}
        <ConfirmDialog
          open={archiveTarget?.kind === 'rate'}
          title={
            archiveTarget?.active ? 'Archivar tarifa de temporada' : 'Restaurar tarifa de temporada'
          }
          description={`¿Seguro que quieres ${archiveTarget?.active ? 'archivar' : 'restaurar'} ${archiveTarget?.label ?? 'esta tarifa'}? ${archiveTarget?.active ? 'Dejará de aplicarse a futuras reservas y el historial se conservará.' : 'Volverá a aplicarse durante su vigencia.'}`}
          confirmLabel={archiveTarget?.active ? 'Archivar' : 'Restaurar'}
          pendingLabel={archiveTarget?.active ? 'Archivando...' : 'Restaurando...'}
          pending={archiving}
          onClose={() => setArchiveTarget(null)}
          onConfirm={confirmArchive}
        />
      </>
    );
  }

  // ─── PROMOCIONES ───
  if (nav === 'Promociones') {
    const filtered = promos.filter((p) =>
      `${p.name} ${p.code}`.toLowerCase().includes(search.toLowerCase()),
    );
    return (
      <>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Gestión de promociones</h3>
              <p>Administra los códigos de descuento del hotel</p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setEditPromo(null);
                setShowPromoModal(true);
              }}
            >
              <Plus size={17} /> Nueva promoción
            </button>
          </div>
          <AdminToolbar search={search} setSearch={setSearch} />
          {filtered.length === 0 ? (
            <div className="hk-empty">
              <Percent size={22} />
              <p>No hay promociones registradas</p>
            </div>
          ) : (
            <AdminTable
              headers={['Promoción', 'Código', 'Descuento', 'Vigencia', 'Estado', 'Acciones']}
            >
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="adm-table-main">
                      <strong>{p.name}</strong>
                      <span>{p.conditions}</span>
                    </div>
                  </td>
                  <td>
                    <code>{p.code}</code>
                  </td>
                  <td>
                    <strong>{p.percentage}%</strong>
                  </td>
                  <td>
                    {p.startDate} → {p.endDate}
                  </td>
                  <td>
                    <span className={`status-pill ${statusPillClass(p.status)}`}>{p.status}</span>
                  </td>
                  <td className="adm-actions">
                    <EditIconButton
                      label="Editar promoción"
                      onClick={() => {
                        setEditPromo(p);
                        setShowPromoModal(true);
                      }}
                    />
                    <StatusSwitch
                      checked={p.status === 'Activa'}
                      label={p.status === 'Activa' ? 'Desactivar promoción' : 'Activar promoción'}
                      onChange={async () => {
                        try {
                          const updated = await promotionService.updatePromotion(p.dbId, {
                            active: p.status !== 'Activa',
                          });
                          setPromos((cur) =>
                            cur.map((x) =>
                              x.id === p.id
                                ? { ...x, status: updated.active ? 'Activa' : 'Inactiva' }
                                : x,
                            ),
                          );
                          onAction('Promocion actualizada correctamente');
                        } catch (cause) {
                          notifyError(cause);
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}
        </div>
        {showPromoModal && (
          <PromoModal
            promo={editPromo}
            onClose={() => setShowPromoModal(false)}
            onSave={async (p) => {
              try {
                const saved = editPromo
                  ? await promotionService.updatePromotion(editPromo.dbId, {
                      code: p.code,
                      name: p.name,
                      description: p.conditions,
                      discount_percent: p.percentage,
                      valid_from: p.startDate,
                      valid_to: p.endDate,
                      active: p.status === 'Activa',
                    })
                  : await promotionService.createPromotion({
                      code: p.code,
                      name: p.name,
                      description: p.conditions,
                      discount_percent: p.percentage,
                      valid_from: p.startDate,
                      valid_to: p.endDate,
                      active: p.status === 'Activa',
                    });
                const next: Promo = {
                  ...p,
                  id: editPromo?.id ?? parseDbId(saved.id, Date.now()),
                  dbId: saved.id,
                  code: saved.code,
                  name: saved.name,
                  percentage: saved.discountPercent,
                  startDate: toDtoCalendarDate(saved.validFrom),
                  endDate: toDtoCalendarDate(saved.validTo),
                  conditions: saved.description,
                  status: saved.active ? 'Activa' : 'Inactiva',
                };
                setPromos((cur) =>
                  editPromo ? cur.map((x) => (x.id === editPromo.id ? next : x)) : [...cur, next],
                );
                onAction(
                  editPromo
                    ? 'Promocion actualizada correctamente'
                    : 'Promocion creada correctamente',
                );
                setShowPromoModal(false);
              } catch (cause) {
                notifyError(cause);
              }
            }}
          />
        )}
      </>
    );
  }

  // ─── SERVICIOS (AMENIDADES + ROOM SERVICE) ───
  if (nav === 'Servicios' || nav === 'Amenidades' || nav === 'Catálogo de Room Service') {
    const filteredRs = rsItems.filter((i) =>
      `${i.name} ${i.category} ${i.description}`.toLowerCase().includes(search.toLowerCase()),
    );
    return (
      <>
        {servicesSection === 'Amenidades' && (
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Amenidades</h3>
                <p>Administra las amenidades del hotel y sus horarios</p>
              </div>
              <button
                className="button primary"
                onClick={() => {
                  setEditAmenity(null);
                  setShowAmenityModal(true);
                }}
              >
                <Plus size={17} /> Nueva amenidad
              </button>
            </div>
            {amenities.length === 0 ? (
              <div className="hk-empty">
                <Star size={22} />
                <p>No hay amenidades registradas</p>
              </div>
            ) : (
              <AdminTable headers={['Amenidad', 'Horario', 'Disponibilidad', 'Estado', 'Acciones']}>
                {amenities.map((a) => {
                  const Icon = amenityIconMap[a.icon] ?? Sparkles;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="adm-table-identity">
                          {a.images.length > 0 ? (
                            <div className="adm-catalog-thumb">
                              <CatalogImage
                                image={findPrimaryImage(a.images)}
                                variant="thumb"
                                alt={`Foto de ${a.name}`}
                                staffFallback
                              />
                            </div>
                          ) : (
                            <span className="adm-table-icon">
                              <Icon size={17} />
                            </span>
                          )}
                          <div className="adm-table-main">
                            <strong>{a.name}</strong>
                            <span>{a.dbId}</span>
                          </div>
                        </div>
                      </td>
                      <td>{a.schedule || 'Disponible'}</td>
                      <td>
                        <span className={`status-pill ${a.available ? 'success' : 'warning'}`}>
                          {a.available ? 'Disponible' : 'No disponible'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${statusPillClass(a.status)}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="adm-actions">
                        <EditIconButton
                          label="Editar amenidad"
                          onClick={() => {
                            setEditAmenity(a);
                            setShowAmenityModal(true);
                          }}
                        />
                        <StatusSwitch
                          checked={a.status === 'Activo'}
                          label={a.status === 'Activo' ? 'Desactivar amenidad' : 'Activar amenidad'}
                          onChange={async () => {
                            try {
                              const updated = await catalogService.updateAmenity(a.dbId, {
                                active: a.status !== 'Activo',
                              });
                              setAmenities((current) =>
                                current.map((item, index) =>
                                  item.dbId === a.dbId
                                    ? adminAmenityFromDomain(updated, index)
                                    : item,
                                ),
                              );
                              onAction('Amenidad actualizada correctamente');
                            } catch (error) {
                              onAction(serviceErrorMessage(error));
                            }
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </AdminTable>
            )}
          </div>
        )}
        {servicesSection === 'Catálogo de Room Service' && (
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Catálogo de Room Service</h3>
                <p>Administra los productos del menú de servicio a habitación</p>
              </div>
              <button
                className="button primary"
                onClick={() => {
                  setEditRsItem(null);
                  setShowRsItemModal(true);
                }}
              >
                <Plus size={17} /> Nuevo producto
              </button>
            </div>
            <AdminToolbar search={search} setSearch={setSearch} />
            {filteredRs.length === 0 ? (
              <div className="hk-empty">
                <Utensils size={22} />
                <p>No hay productos de Room Service registrados</p>
              </div>
            ) : (
              <AdminTable
                headers={[
                  'Producto',
                  'Categoría',
                  'Precio',
                  'Disponibilidad',
                  'Estado',
                  'Acciones',
                ]}
              >
                {filteredRs.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="adm-catalog-name">
                        <div className="adm-catalog-thumb">
                          <CatalogImage
                            image={findPrimaryImage(item.images)}
                            variant="thumb"
                            alt={`Foto de ${item.name}`}
                            staffFallback
                          />
                        </div>
                        <div className="adm-table-main">
                          <strong>{item.name}</strong>
                          <span>{item.dbId}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <strong>{money(item.price)}</strong>
                    </td>
                    <td>
                      <span className={`status-pill ${item.available ? 'success' : 'warning'}`}>
                        {item.available ? 'Disponible' : 'No disponible'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${statusPillClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="adm-actions">
                      <EditIconButton
                        label="Editar producto de room service"
                        onClick={() => {
                          setEditRsItem(item);
                          setShowRsItemModal(true);
                        }}
                      />
                      <StatusSwitch
                        checked={item.status === 'Activo'}
                        label={
                          item.status === 'Activo' ? 'Desactivar producto' : 'Activar producto'
                        }
                        onChange={() => {
                          void (async () => {
                            try {
                              const updated = await catalogService.updateAdminProduct(item.dbId, {
                                active: item.status !== 'Activo',
                              });
                              setRsItems((current) =>
                                current.map((entry, index) =>
                                  entry.dbId === item.dbId
                                    ? adminProductFromDomain(updated, index)
                                    : entry,
                                ),
                              );
                              onAction('Producto actualizado correctamente');
                            } catch (error) {
                              onAction(serviceErrorMessage(error));
                            }
                          })();
                        }}
                      />
                      <button
                        className="icon-btn danger"
                        type="button"
                        aria-label={`Eliminar ${item.name} del catálogo`}
                        title="Eliminar del catálogo"
                        disabled={deletingRsId === item.dbId}
                        onClick={() => setPendingDeleteRsItem(item)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </div>
        )}
        {showAmenityModal && (
          <AmenityModal
            amenity={editAmenity}
            onClose={() => setShowAmenityModal(false)}
            onSave={async (a, images) => {
              // Sin try/catch: si el backend rechaza, el modal muestra el error y sigue abierto.
              const schedule = parseAmenityScheduleInput(a.schedule);
              if (!schedule.ok) throw new Error(schedule.error);
              const payload = {
                name: a.name,
                description: a.description,
                category: a.category,
                location: undefined,
                opensAt: schedule.opensAt,
                closesAt: schedule.closesAt,
                active: a.status === 'Activo',
                images,
              };
              const saved = editAmenity
                ? await catalogService.updateAmenity(editAmenity.dbId, payload)
                : await catalogService.createAmenity(payload);
              setAmenities((current) =>
                editAmenity
                  ? current.map((item, index) =>
                      item.dbId === editAmenity.dbId
                        ? { ...adminAmenityFromDomain(saved, index), icon: a.icon }
                        : item,
                    )
                  : [
                      ...current,
                      { ...adminAmenityFromDomain(saved, current.length), icon: a.icon },
                    ],
              );
              onAction(
                editAmenity
                  ? 'Amenidad actualizada correctamente'
                  : 'Amenidad creada correctamente',
              );
              setShowAmenityModal(false);
              setEditAmenity(null);
            }}
          />
        )}
        <ConfirmDialog
          open={pendingDeleteRsItem !== null}
          title="Eliminar producto de Room Service"
          description={`¿Seguro que quieres eliminar “${pendingDeleteRsItem?.name ?? ''}” del catálogo? Se conservará en el historial de pedidos.`}
          pending={pendingDeleteRsItem !== null && deletingRsId === pendingDeleteRsItem.dbId}
          onClose={() => setPendingDeleteRsItem(null)}
          onConfirm={async () => {
            if (!pendingDeleteRsItem) return;
            setDeletingRsId(pendingDeleteRsItem.dbId);
            try {
              await catalogService.deleteAdminProduct(pendingDeleteRsItem.dbId);
              setRsItems((current) =>
                current.filter((entry) => entry.dbId !== pendingDeleteRsItem.dbId),
              );
              setPendingDeleteRsItem(null);
              onAction('Producto eliminado del catálogo; se conserva en el historial.');
            } catch (error) {
              onAction(serviceErrorMessage(error));
            } finally {
              setDeletingRsId(null);
            }
          }}
        />
        {showRsItemModal && (
          <RsItemModal
            item={editRsItem}
            onClose={() => setShowRsItemModal(false)}
            onSave={async (item, images) => {
              // Sin try/catch: si el backend rechaza, el modal muestra el error y sigue abierto.
              const payload = {
                sku: editRsItem?.dbId ? undefined : productSkuFromName(item.name),
                name: item.name,
                description: item.description,
                // La categoría seleccionada se mantiene tanto al crear como al editar.
                category: PRODUCT_CATEGORY_DTO[item.categoryCode],
                priceCents: amountToCents(item.price),
                currency: 'GTQ' as const,
                active: item.status === 'Activo',
                images,
              };
              const saved = editRsItem
                ? await catalogService.updateAdminProduct(editRsItem.dbId, payload)
                : await catalogService.createAdminProduct({
                    ...payload,
                    sku: payload.sku ?? productSkuFromName(item.name),
                    category: PRODUCT_CATEGORY_DTO[item.categoryCode],
                  });
              setRsItems((current) =>
                editRsItem
                  ? current.map((entry, index) =>
                      entry.dbId === editRsItem.dbId ? adminProductFromDomain(saved, index) : entry,
                    )
                  : [...current, adminProductFromDomain(saved, current.length)],
              );
              onAction(
                editRsItem ? 'Producto actualizado correctamente' : 'Producto creado correctamente',
              );
              setShowRsItemModal(false);
              setEditRsItem(null);
            }}
          />
        )}
      </>
    );
  }

  // ─── REPORTES ───
  if (nav === 'Reportes' || nav === 'Resumen operativo' || nav === 'Reportes financieros') {
    const periodCashMovements = cashMovements.filter((movement) =>
      isDateInReportPeriod(new Date(`${movement.date}T12:00:00`), reportFilter),
    );
    const periodBookings = bookings.filter((booking) =>
      isDateInReportPeriod(booking.checkIn, reportFilter),
    );
    const periodCancelledBookings = bookings.filter(
      (booking) =>
        booking.status === 'cancelled' && isDateInReportPeriod(booking.updatedAt, reportFilter),
    );
    const occupiedRooms = rooms.filter((room) => room.status === 'Ocupada').length;
    const occupancyPercent =
      rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 1000) / 10 : 0;
    const officialReport = operationalReport.status === 'ready' ? operationalReport.data : null;
    const activeReservations =
      officialReport !== null
        ? countActiveOfficialBookings(officialReport)
        : periodBookings.filter((booking) =>
            ['confirmed', 'checkedIn', 'checkedOut'].includes(booking.status),
          ).length;
    const cancelledReservations = officialReport?.cancellations ?? periodCancelledBookings.length;
    const totalReservations = officialReport?.bookings ?? periodBookings.length;
    const cancellationRate =
      totalReservations > 0
        ? Math.round((cancelledReservations / totalReservations) * 1000) / 10
        : 0;
    const cashIncome = periodCashMovements
      .filter((movement) => movement.type === 'Ingreso')
      .reduce((sum, movement) => sum + movement.amount, 0);
    const usesOfficialRevenue = (officialReport?.revenueCents ?? 0) > 0;
    const totalIncome = usesOfficialRevenue
      ? centsToAmount(officialReport!.revenueCents)
      : cashIncome;
    const incomeRows = periodCashMovements.filter((movement) => movement.type === 'Ingreso');
    const reservationRows =
      officialReport !== null
        ? Object.entries(officialReport.bookingsByStatus).map(([status, count]) => ({
            label: status,
            reservations: count,
            checkIns: status === 'checked_in' ? count : 0,
            checkOuts: status === 'checked_out' ? count : 0,
            income: 0,
          }))
        : periodBookings.map((booking) => ({
            label: booking.confirmationCode,
            reservations: 1,
            checkIns: booking.status === 'checkedIn' || booking.status === 'checkedOut' ? 1 : 0,
            checkOuts: booking.status === 'checkedOut' ? 1 : 0,
            income: centsToAmount(booking.totalAmountCents),
          }));
    const EmptyReport = ({ message }: { message: string }) => (
      <div className="hk-empty">
        <FileText size={20} />
        <p>{message}</p>
      </div>
    );
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>{reportGroup}</h3>
            <p>Analiza el rendimiento y la operación del hotel</p>
          </div>
          <button className="button secondary" onClick={exportAdminReport}>
            <Download size={16} /> Exportar
          </button>
        </div>
        {visibleReportTabs.length > 1 && (
          <div className="adm-compact-selector">
            <span>Tipo de reporte</span>
            <div>
              {visibleReportTabs.map((t) => (
                <button
                  key={t}
                  className={activeReportTab === t ? 'active' : ''}
                  onClick={() => setReportTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="adm-report-filters">
          {reportPeriodOptions.map((f) => (
            <button
              key={f}
              className={`adm-filter-chip ${reportFilter === f ? 'active' : ''}`}
              onClick={() => setReportFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        {operationalReport.status === 'loading' ? (
          <LoadingState label="Cargando reporte operativo..." />
        ) : operationalReport.status === 'error' ? (
          <ErrorState
            title="No pudimos cargar el reporte"
            description={operationalReport.message}
            onRetry={() => loadOperationalReport(reportFilter)}
          />
        ) : officialReport !== null &&
          officialReport.bookings === 0 &&
          officialReport.revenueCents === 0 &&
          incomeRows.length === 0 ? (
          <EmptyReport message="No hay datos oficiales para este periodo" />
        ) : (
          <div className="adm-report-content">
            {activeReportTab === 'Ocupación' && (
              <>
                <div className="adm-report-stats">
                  <div className="metric-card">
                    <div className="metric-icon sage">
                      <BedDouble size={19} />
                    </div>
                    <div>
                      <p>{officialReport ? 'Noches ocupadas' : 'Ocupación promedio'}</p>
                      <h2>
                        {officialReport ? officialReport.occupancyNights : `${occupancyPercent}%`}
                      </h2>
                      <span className="positive">
                        {officialReport ? 'Datos del periodo' : 'Datos actuales'}
                      </span>
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-icon gold">
                      <TrendingUp size={19} />
                    </div>
                    <div>
                      <p>Tendencia</p>
                      <h2>
                        {officialReport
                          ? 'No disponible'
                          : occupiedRooms > 0
                            ? 'Con ocupacion'
                            : 'Sin ocupacion'}
                      </h2>
                      <span className="positive">
                        {officialReport ? 'Tendencia no disponible' : reportFilter}
                      </span>
                    </div>
                  </div>
                </div>
                {officialReport ? (
                  <MiniChart
                    data={[officialReport.occupancyNights, officialReport.roomServiceOrders]}
                    labels={['Noches', 'Room service']}
                  />
                ) : (
                  <MiniChart
                    data={rooms.length > 0 ? rooms.map((_, index) => index + 1) : [0]}
                    labels={rooms.length > 0 ? rooms.map((room) => room.number) : ['Sin datos']}
                  />
                )}
              </>
            )}
            {activeReportTab === 'Ingresos' && (
              <>
                <div className="adm-report-stats">
                  <div className="metric-card">
                    <div className="metric-icon gold">
                      <Wallet size={19} />
                    </div>
                    <div>
                      <p>Ingresos del periodo</p>
                      <h2>{money(totalIncome)}</h2>
                      <span className="positive">
                        {usesOfficialRevenue ? 'Datos del periodo' : 'Caja registrada'}
                      </span>
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-icon sage">
                      <DollarSign size={19} />
                    </div>
                    <div>
                      <p>Promedio por corte</p>
                      <h2>
                        {usesOfficialRevenue
                          ? 'No disponible'
                          : incomeRows.length > 0
                            ? money(totalIncome / incomeRows.length)
                            : money(0)}
                      </h2>
                      <span className="positive">
                        {usesOfficialRevenue ? 'Sin cortes disponibles' : reportFilter}
                      </span>
                    </div>
                  </div>
                </div>
                <BarChart
                  data={usesOfficialRevenue ? [totalIncome] : incomeRows.map((row) => row.amount)}
                  labels={
                    usesOfficialRevenue && officialReport
                      ? [`${officialReport.from} / ${officialReport.to}`]
                      : incomeRows.length > 0
                        ? incomeRows.map((row) => row.date)
                        : ['Sin datos']
                  }
                />
              </>
            )}
            {activeReportTab === 'Reservas' && (
              <AdminTable headers={['Periodo', 'Reservas', 'Check-ins', 'Check-outs', 'Ingresos']}>
                {reservationRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.reservations}</td>
                    <td>{row.checkIns}</td>
                    <td>{row.checkOuts}</td>
                    <td>{money(row.income)}</td>
                  </tr>
                ))}
              </AdminTable>
            )}
            {activeReportTab === 'Cancelaciones' && (
              <>
                <div className="adm-report-stats">
                  <div className="metric-card">
                    <div className="metric-icon terracotta">
                      <Ban size={19} />
                    </div>
                    <div>
                      <p>Cancelaciones</p>
                      <h2>{cancelledReservations}</h2>
                      <span>{officialReport ? 'Datos del periodo' : 'Datos actuales'}</span>
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-icon info">
                      <Percent size={19} />
                    </div>
                    <div>
                      <p>Tasa de cancelación</p>
                      <h2>{cancellationRate}%</h2>
                      <span className="positive">{activeReservations} reservas vigentes</span>
                    </div>
                  </div>
                </div>
                <MiniChart
                  data={[cancelledReservations, activeReservations]}
                  labels={['Canceladas', 'Vigentes']}
                  color="#a9483c"
                />
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── INVENTARIO ───
  if (
    nav === 'Inventario' ||
    nav === 'Gestión de inventario' ||
    nav === 'Movimientos de inventario'
  ) {
    const filtered = inventory.filter((p) =>
      `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()),
    );
    const lowStock = inventory.filter((p) => p.stock <= p.minStock);
    return (
      <>
        {inventorySection === 'Gestión de inventario' && (
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Gestión de inventario</h3>
                <p>Administra los productos y existencias del hotel</p>
              </div>
              <div className="adm-heading-actions">
                <button className="button secondary" onClick={() => setShowMovementModal(true)}>
                  <ArrowRight size={16} /> Registrar movimiento
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    setEditProduct(null);
                    setShowProductModal(true);
                  }}
                >
                  <Plus size={17} /> Nuevo producto
                </button>
              </div>
            </div>
            {lowStock.length > 0 && (
              <div className="adm-inv-alerts">
                <TriangleAlert size={18} />
                <span>{lowStock.length} producto(s) con stock bajo el mínimo</span>
              </div>
            )}
            <AdminToolbar search={search} setSearch={setSearch} />
            {filtered.length === 0 ? (
              <div className="hk-empty">
                <Package size={22} />
                <p>No hay productos en el inventario</p>
              </div>
            ) : (
              <AdminTable
                headers={[
                  'Producto',
                  'Categoría',
                  'Stock',
                  'Stock mínimo',
                  'Precio',
                  'Estado',
                  'Acciones',
                ]}
              >
                {filtered.map((p) => (
                  <tr key={p.id} className={p.stock <= p.minStock ? 'adm-row-alert' : ''}>
                    <td>
                      <div className="adm-inventory-product">
                        <CatalogImage
                          image={findPrimaryImage(p.images)}
                          alt={p.name}
                          className="adm-inventory-image"
                        />
                        <strong>{p.name}</strong>
                      </div>
                    </td>
                    <td>{p.category}</td>
                    <td className={p.stock <= p.minStock ? 'terracotta-text' : ''}>
                      <strong>{p.stock}</strong>
                    </td>
                    <td>{p.minStock}</td>
                    <td>{p.price > 0 ? money(p.price) : '—'}</td>
                    <td>
                      <span className={`status-pill ${statusPillClass(p.status)}`}>{p.status}</span>
                    </td>
                    <td className="adm-actions">
                      <EditIconButton
                        label="Editar producto"
                        onClick={() => {
                          setEditProduct(p);
                          setShowProductModal(true);
                        }}
                      />
                      <StatusSwitch
                        checked={p.status === 'Activo'}
                        label={p.status === 'Activo' ? 'Desactivar producto' : 'Activar producto'}
                        onChange={async () => {
                          try {
                            const updated = await inventoryService.updateItem(p.dbId, {
                              active: p.status !== 'Activo',
                            });
                            setInventory((cur) =>
                              cur.map((x) =>
                                x.id === p.id
                                  ? { ...x, status: updated.active ? 'Activo' : 'Inactivo' }
                                  : x,
                              ),
                            );
                            onAction('Producto de inventario actualizado correctamente');
                          } catch (cause) {
                            notifyError(cause);
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </div>
        )}
        {inventorySection === 'Movimientos de inventario' && (
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Movimientos de inventario</h3>
                <p>Historial de entradas y salidas</p>
              </div>
            </div>
            {movements.length === 0 ? (
              <div className="hk-empty">
                <ArrowRight size={22} />
                <p>Sin movimientos registrados</p>
              </div>
            ) : (
              <AdminTable
                headers={['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo', 'Responsable']}
              >
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.date}</td>
                    <td>
                      <strong>{m.product}</strong>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${m.type === 'Entrada' ? 'success' : 'warning'}`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td>
                      {m.type === 'Entrada' ? '+' : '-'}
                      {m.quantity}
                    </td>
                    <td>{m.reason}</td>
                    <td>{m.responsible}</td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </div>
        )}
        {showProductModal && (
          <ProductModal
            product={editProduct}
            onClose={() => setShowProductModal(false)}
            onSave={async (p, images) => {
              try {
                if (!editProduct) {
                  if (!p.sku.trim() || !p.name.trim()) {
                    throw new Error('Completa el SKU y el nombre del insumo.');
                  }
                  if (!Number.isInteger(p.minStock) || p.minStock < 0) {
                    throw new Error('El stock mínimo debe ser un entero igual o mayor a cero.');
                  }
                  const created = await inventoryService.createItem({
                    sku: p.sku,
                    name: p.name,
                    category: toInventoryCategoryDto(p.categoryCode),
                    unit: p.unit,
                    minimumQuantity: p.minStock,
                    active: p.status === 'Activo',
                    images,
                  });
                  const newItem: InventoryProduct = {
                    id: parseDbId(created.id, inventory.length + 1),
                    dbId: created.id,
                    sku: created.sku,
                    categoryCode: created.category,
                    unit: created.unit,
                    name: created.name,
                    category: INVENTORY_CATEGORY_LABELS[created.category],
                    stock: created.currentQuantity,
                    minStock: created.minimumQuantity,
                    price: 0,
                    status: created.active ? 'Activo' : 'Inactivo',
                    images: created.images ?? [],
                  };
                  setInventory((cur) => [...cur, newItem]);
                  onAction('Insumo creado correctamente con existencias en cero');
                  setShowProductModal(false);
                  return;
                }
                const categoryCode =
                  INVENTORY_CATEGORY_BY_LABEL[p.category] ?? editProduct.categoryCode;
                const updated = await inventoryService.updateItem(editProduct.dbId, {
                  name: p.name,
                  category: toInventoryCategoryDto(categoryCode),
                  current_quantity: p.stock,
                  minimum_quantity: p.minStock,
                  active: p.status === 'Activo',
                  images,
                });
                setInventory((cur) =>
                  cur.map((x) =>
                    x.id === editProduct.id
                      ? {
                          ...p,
                          id: editProduct.id,
                          dbId: updated.id,
                          sku: updated.sku,
                          categoryCode,
                          unit: updated.unit,
                          category: INVENTORY_CATEGORY_LABELS[categoryCode],
                          stock: updated.currentQuantity,
                          minStock: updated.minimumQuantity,
                          status: updated.active ? 'Activo' : 'Inactivo',
                          images: updated.images ?? [],
                        }
                      : x,
                  ),
                );
                onAction('Producto actualizado correctamente');
                setShowProductModal(false);
              } catch (cause) {
                notifyError(cause);
              }
            }}
          />
        )}
        {showMovementModal && (
          <MovementModal
            products={inventory}
            onClose={() => setShowMovementModal(false)}
            onSave={async (m) => {
              try {
                const item = inventory.find((entry) => entry.id === m.productId);
                if (!item) throw new Error('Selecciona un producto de inventario valido.');
                const saved = await inventoryService.createMovement({
                  inventoryItemId: item.dbId,
                  type: m.type === 'Entrada' ? 'in' : 'out',
                  reason: INVENTORY_REASON_BY_LABEL[m.reason] ?? 'restock',
                  quantity: m.quantity,
                  notes: m.reason,
                });
                setMovements((cur) => [
                  {
                    id: parseDbId(saved.id, Date.now()),
                    dbId: saved.id,
                    date: toDtoCalendarDate(saved.occurredAt),
                    product: item.name,
                    type: saved.type === 'in' ? 'Entrada' : 'Salida',
                    quantity: saved.quantity,
                    reason: INVENTORY_REASON_LABELS[saved.reason],
                    responsible: m.responsible,
                  },
                  ...cur,
                ]);
                const updatedItem = await inventoryService.getItemById(item.dbId);
                if (updatedItem) {
                  setInventory((cur) =>
                    cur.map((entry) =>
                      entry.id === item.id
                        ? {
                            ...entry,
                            stock: updatedItem.currentQuantity,
                            minStock: updatedItem.minimumQuantity,
                            status: updatedItem.active ? 'Activo' : 'Inactivo',
                          }
                        : entry,
                    ),
                  );
                }
                onAction(`${m.type} de ${m.quantity} unidades registrada`);
                setShowMovementModal(false);
              } catch (cause) {
                notifyError(cause);
              }
            }}
          />
        )}
      </>
    );
  }

  // ─── CAJA ───
  if (nav === 'Caja') {
    const visibleCashMovements = cashMovements;
    const visibleCashSessions = cashSessions;
    const latestCashSession =
      [...visibleCashSessions].sort(
        (left, right) => right.openedAt.getTime() - left.openedAt.getTime(),
      )[0] ?? null;
    const localIngresos = visibleCashMovements
      .filter((m) => m.type === 'Ingreso')
      .reduce((s, m) => s + m.amount, 0);
    const localEgresos = visibleCashMovements
      .filter((m) => m.type === 'Egreso')
      .reduce((s, m) => s + m.amount, 0);
    const totalIngresos =
      latestCashSession?.totalIncomeCents !== undefined
        ? centsToAmount(latestCashSession.totalIncomeCents)
        : localIngresos;
    const totalEgresos =
      latestCashSession?.totalExpenseCents !== undefined
        ? centsToAmount(latestCashSession.totalExpenseCents)
        : localEgresos;
    const saldoInicial = latestCashSession
      ? centsToAmount(latestCashSession.openingBalanceCents)
      : 0;
    const saldoActual =
      latestCashSession?.expectedBalanceCents !== undefined
        ? centsToAmount(latestCashSession.expectedBalanceCents)
        : saldoInicial + totalIngresos - totalEgresos;
    return (
      <>
        <div className="adm-cash-grid">
          <div className="metric-card">
            <div className="metric-icon sage">
              <Wallet size={19} />
            </div>
            <div>
              <p>Saldo inicial</p>
              <h2>{money(saldoInicial)}</h2>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon gold">
              <TrendingUp size={19} />
            </div>
            <div>
              <p>Ingresos</p>
              <h2>{money(totalIngresos)}</h2>
              <span className="positive">
                +
                {(totalIngresos > 0
                  ? (totalIngresos / (saldoInicial + totalIngresos)) * 100
                  : 0
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon terracotta">
              <ArrowRight size={19} />
            </div>
            <div>
              <p>Egresos</p>
              <h2>{money(totalEgresos)}</h2>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon info">
              <DollarSign size={19} />
            </div>
            <div>
              <p>Saldo actual</p>
              <h2>{money(saldoActual)}</h2>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Movimientos de caja</h3>
              <p>Historial de ingresos y egresos</p>
            </div>
            <div className="adm-heading-actions">
              {cashOpen ? (
                <button className="button secondary" onClick={() => setCashSessionModal('close')}>
                  <Ban size={16} /> Cerrar caja
                </button>
              ) : (
                <button className="button primary" onClick={() => setCashSessionModal('open')}>
                  <Plus size={16} /> Abrir caja
                </button>
              )}
              <button
                className="button secondary"
                onClick={() => exportCashReport(visibleCashMovements, visibleCashSessions)}
              >
                <FileText size={16} /> Reporte
              </button>
              <button className="button primary" onClick={() => setShowCashModal(true)}>
                <Plus size={17} /> Nuevo movimiento
              </button>
            </div>
          </div>
          {visibleCashMovements.length === 0 ? (
            <div className="hk-empty">
              <Wallet size={22} />
              <p>Sin movimientos de caja registrados</p>
            </div>
          ) : (
            <AdminTable headers={['Fecha', 'Concepto', 'Tipo', 'Monto', 'Responsable']}>
              {visibleCashMovements.map((m) => (
                <tr key={m.id}>
                  <td>{m.date}</td>
                  <td>
                    <strong>{m.concept}</strong>
                  </td>
                  <td>
                    <span className={`status-pill ${m.type === 'Ingreso' ? 'success' : 'warning'}`}>
                      {m.type}
                    </span>
                  </td>
                  <td className={m.type === 'Ingreso' ? 'success-text' : 'terracotta-text'}>
                    <strong>
                      {m.type === 'Ingreso' ? '+' : '-'}
                      {money(m.amount)}
                    </strong>
                  </td>
                  <td>{m.responsible}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </div>
        {(() => {
          const ownId = latestCashSession?.status === 'open' ? latestCashSession.id : undefined;
          const others = openCashSessions.filter((session) => session.id !== ownId);
          const ownerOf = (session: CashSession) =>
            users.find((user) => user.dbId === session.openedByUserId)?.name ??
            'Usuario sin nombre';
          if (!openCashSessionsError && others.length === 0) return null;
          return (
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Cajas abiertas de otros usuarios</h3>
                  <p>Cierre excepcional con conteo físico y motivo; queda auditado</p>
                </div>
              </div>
              {openCashSessionsError ? (
                <p className="login-helper" role="alert">
                  {openCashSessionsError}
                </p>
              ) : (
                <AdminTable headers={['Responsable', 'Apertura', 'Saldo esperado', 'Acción']}>
                  {others.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <strong>{ownerOf(session)}</strong>
                      </td>
                      <td>{formatDateGT(session.openedAt)}</td>
                      <td>
                        {session.expectedBalanceCents !== undefined
                          ? formatCurrency(session.expectedBalanceCents, 'GTQ')
                          : '—'}
                      </td>
                      <td>
                        <button
                          className="button small secondary"
                          onClick={() => setExceptionalClose(session)}
                          aria-label={`Cierre excepcional de ${ownerOf(session)}`}
                        >
                          <Ban size={14} /> Cierre excepcional
                        </button>
                      </td>
                    </tr>
                  ))}
                </AdminTable>
              )}
            </div>
          );
        })()}
        {exceptionalClose && (
          <CashSessionModal
            mode="close"
            expectedCents={exceptionalClose.expectedBalanceCents}
            ownerLabel={
              users.find((user) => user.dbId === exceptionalClose.openedByUserId)?.name ??
              'Usuario sin nombre'
            }
            onClose={() => setExceptionalClose(null)}
            onSave={async (amountCents, notes, reason) => {
              // El backend verifica que sea Administración y guarda actor y motivo.
              const closed = await cashService.closeSession({
                sessionId: exceptionalClose.id,
                countedBalanceCents: amountCents,
                notes,
                reason,
              });
              setExceptionalClose(null);
              await loadOpenCashSessions();
              const difference = closed.differenceCents ?? 0;
              onAction(
                difference === 0
                  ? 'Cierre excepcional registrado sin diferencias'
                  : `Cierre excepcional con ${difference < 0 ? 'faltante' : 'sobrante'} de ${formatCurrency(Math.abs(difference), 'GTQ')}`,
              );
            }}
          />
        )}
        {cashSessionModal && (
          <CashSessionModal
            mode={cashSessionModal}
            expectedCents={latestCashSession?.expectedBalanceCents}
            onClose={() => setCashSessionModal(null)}
            onSave={async (amountCents, notes) => {
              if (cashSessionModal === 'open') {
                const opened = await cashService.openSession({
                  openingBalanceCents: amountCents,
                  notes,
                });
                setCashSessions((cur) => [...cur, opened]);
                setCashMovements([]);
                setCashOpen(true);
                onAction('Caja abierta correctamente');
              } else {
                // Lo contado físicamente: el backend calcula esperado y diferencia.
                const closed = await cashService.closeSession({
                  countedBalanceCents: amountCents,
                  notes,
                });
                const sessions = await cashService.getSessions();
                setCashSessions(sessions);
                setCashMovements([]);
                setCashOpen(false);
                const difference = closed.differenceCents ?? 0;
                onAction(
                  difference === 0
                    ? 'Caja cerrada sin diferencias'
                    : `Caja cerrada con ${difference < 0 ? 'faltante' : 'sobrante'} de ${formatCurrency(Math.abs(difference), 'GTQ')}`,
                );
              }
              setCashSessionModal(null);
            }}
          />
        )}
        {showCashModal && (
          <CashModal
            onClose={() => setShowCashModal(false)}
            onSave={async (m) => {
              try {
                const saved = await cashService.createMovement({
                  type: m.type === 'Ingreso' ? 'income' : 'expense',
                  concept: m.concept,
                  amountCents: amountToCents(m.amount),
                });
                setCashMovements((cur) => [
                  {
                    ...m,
                    id: parseDbId(saved.id, Date.now()),
                    dbId: saved.id,
                    date: toDtoCalendarDate(saved.occurredAt),
                    amount: centsToAmount(saved.amountCents),
                  },
                  ...cur,
                ]);
                const refreshed = await cashService.getSessions();
                setCashSessions(refreshed);
                onAction('Movimiento de caja registrado correctamente');
                setShowCashModal(false);
              } catch (cause) {
                notifyError(cause);
              }
            }}
          />
        )}
      </>
    );
  }

  // ─── AUDITORÍA ───
  if (nav === 'Auditoría') {
    const filtered = audit.filter((a) => {
      const ms = `${a.user} ${a.module} ${a.action} ${a.description}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const mf = filter === 'Todos' || a.module === filter || a.action === filter;
      return ms && mf;
    });
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Historial de auditoría</h3>
            <p>Registro de todas las acciones del sistema</p>
          </div>
          <button className="button secondary" onClick={exportAuditReport}>
            <Download size={16} /> Exportar
          </button>
        </div>
        <AdminToolbar
          search={search}
          setSearch={setSearch}
          filterLabel="Filtrar"
          filterValue={filter}
          setFilter={setFilter}
          filterOptions={['Todos', ...Object.values(AUDIT_MODULE_LABELS)]}
        />
        {filtered.length === 0 ? (
          <div className="hk-empty">
            <FileText size={22} />
            <p>Sin registros de auditoría</p>
          </div>
        ) : (
          <AdminTable headers={['Usuario', 'Fecha', 'Hora', 'Módulo', 'Acción', 'Descripción']}>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.user}</strong>
                </td>
                <td>{a.date}</td>
                <td>{a.time}</td>
                <td>
                  <span className="status-pill info">{a.module}</span>
                </td>
                <td>
                  <span
                    className={`status-pill ${a.action === 'Anulación' || a.action === 'Eliminación' || a.action === 'Cierre' ? 'warning' : 'success'}`}
                  >
                    {a.action}
                  </span>
                </td>
                <td>{a.description}</td>
              </tr>
            ))}
          </AdminTable>
        )}
      </div>
    );
  }

  resetSearch();
  return (
    <div className="panel">
      <div className="hk-empty">
        <FileText size={22} />
        <p>Selecciona una opción del menú</p>
      </div>
    </div>
  );
}

// ─── MODALES ───

export function UserModal({
  user,
  roles,
  onClose,
  onSave,
}: {
  user: AdminUser | null;
  roles: AdminRole[];
  onClose: () => void;
  onSave: (u: AdminUser) => void | Promise<void>;
}) {
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role ?? roles[0]?.name ?? '');
  const [status, setStatus] = useState<'Activo' | 'Inactivo'>(user?.status ?? 'Activo');
  type Field = 'firstName' | 'lastName' | 'email' | 'password' | 'role';
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const save = useAdminSubmit();
  const clearError = (field: Field) => setErrors((current) => ({ ...current, [field]: undefined }));

  const submit = () => {
    const normalizedFirstName = normalizePersonNamePart(firstName);
    const normalizedLastName = normalizePersonNamePart(lastName);
    const normalizedEmail = email.trim();
    // Un usuario existente con datos antiguos puede guardarse si no se tocan.
    const firstNameChanged =
      !user || normalizedFirstName !== normalizePersonNamePart(user.firstName);
    const lastNameChanged = !user || normalizedLastName !== normalizePersonNamePart(user.lastName);
    const emailChanged = !user || normalizedEmail !== user.email.trim();
    const nextErrors = compactErrors({
      firstName: firstNameChanged ? validatePersonNamePart(normalizedFirstName, 'nombre') : null,
      lastName: lastNameChanged ? validatePersonNamePart(normalizedLastName, 'apellido') : null,
      email: emailChanged
        ? normalizedEmail
          ? validateEmail(normalizedEmail)
          : 'Ingresa el correo electrónico.'
        : null,
      // Al editar, la contraseña es opcional: vacía conserva la actual.
      password: !password
        ? user
          ? null
          : 'Ingresa una contraseña temporal.'
        : password.length < USER_PASSWORD_MIN_LENGTH
          ? `Mínimo ${USER_PASSWORD_MIN_LENGTH} caracteres.`
          : null,
      role: roles.some((r) => r.name === role) ? null : 'Selecciona un rol.',
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void save.submit(() =>
      onSave({
        id: user?.id ?? 0,
        dbId: user?.dbId ?? '',
        name: `${normalizedFirstName} ${normalizedLastName}`,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        password: password ? password : undefined,
        role,
        status,
        lastAccess: user?.lastAccess ?? 'Sin acceso',
      }),
    );
  };

  return (
    <AdminModal
      title={user ? 'Editar usuario' : 'Nuevo usuario'}
      eyebrow="GESTIÓN DE USUARIOS"
      onClose={onClose}
      onSubmit={submit}
      submitting={save.submitting}
      error={save.error}
      submitLabel={user ? 'Guardar cambios' : 'Crear usuario'}
    >
      <div className="rc-form-grid">
        <label className="hk-form-label">
          Nombre *
          <input
            className={inputClass(errors.firstName)}
            value={firstName}
            autoComplete="given-name"
            onChange={(e) => {
              setFirstName(e.target.value);
              clearError('firstName');
            }}
            aria-required="true"
            {...fieldErrorProps('user-firstName-error', errors.firstName)}
          />
          <FieldError id="user-firstName-error" error={errors.firstName} />
        </label>
        <label className="hk-form-label">
          Apellido *
          <input
            className={inputClass(errors.lastName)}
            value={lastName}
            autoComplete="family-name"
            onChange={(e) => {
              setLastName(e.target.value);
              clearError('lastName');
            }}
            aria-required="true"
            {...fieldErrorProps('user-lastName-error', errors.lastName)}
          />
          <FieldError id="user-lastName-error" error={errors.lastName} />
        </label>
      </div>
      <label className="hk-form-label">
        Correo electrónico *
        <input
          className={inputClass(errors.email)}
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={EMAIL_MAX_LENGTH}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError('email');
          }}
          placeholder="correo@aurorahotel.com"
          aria-required="true"
          {...fieldErrorProps('user-email-error', errors.email)}
        />
        <FieldError id="user-email-error" error={errors.email} />
      </label>
      <label className="hk-form-label">
        Rol *
        <select
          className={inputClass(errors.role)}
          value={role}
          disabled={roles.length === 0}
          onChange={(e) => {
            setRole(e.target.value);
            clearError('role');
          }}
          aria-required="true"
          {...fieldErrorProps('user-role-error', errors.role)}
        >
          {roles.length === 0 && <option value="">No hay roles disponibles</option>}
          {roles.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
        <FieldError id="user-role-error" error={errors.role} />
      </label>
      <label className="hk-form-label">
        {user ? 'Nueva contraseña (opcional)' : 'Contraseña temporal *'}
        <input
          className={inputClass(errors.password)}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError('password');
          }}
          placeholder={
            user
              ? 'Dejar en blanco para conservarla'
              : `Mínimo ${USER_PASSWORD_MIN_LENGTH} caracteres`
          }
          aria-required={user ? undefined : 'true'}
          {...fieldErrorProps('user-password-error', errors.password)}
        />
        <FieldError id="user-password-error" error={errors.password} />
      </label>
      <label className="hk-form-label">
        Estado
        <select
          className="hk-form-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'Activo' | 'Inactivo')}
        >
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
        </select>
      </label>
    </AdminModal>
  );
}

export function RoleModal({
  role,
  onClose,
  onSave,
}: {
  role: AdminRole | null;
  onClose: () => void;
  onSave: (r: AdminRole) => void | Promise<void>;
}) {
  const isProtectedAdminRole = normalizeRoleCode(role?.code ?? '') === 'admin';
  const editableGroups = editableRoleGroups(role?.code);
  const [permissionsError, setPermissionsError] = useState<string | undefined>();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    isProtectedAdminRole
      ? withFixedAdminPermissions(
          role?.permissions ?? Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, false])),
        )
      : (role?.permissions ?? Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, false]))),
  );
  const setGroupPermissions = (group: (typeof ROLE_ACCESS_GROUPS)[number], selected: boolean) => {
    if (isProtectedAdminRole && group.name === ADMIN_ACCESS_GROUP_NAME) return;
    if (!editableGroups.includes(group.name)) return;
    setPermissionsError(undefined);
    setPermissions((current) => ({
      ...current,
      ...Object.fromEntries(group.items.map((p) => [roleAccessKey(group.name, p), selected])),
    }));
  };
  const [nameError, setNameError] = useState<string | undefined>();
  const save = useAdminSubmit();
  const submit = () => {
    const trimmedName = name.replace(/\s+/g, ' ').trim();
    const code = role?.code ?? trimmedName.toLowerCase().replace(/\s+/g, '_');
    const error =
      validateRequiredText(trimmedName, 'Ingresa el nombre del rol.', ROLE_NAME_MAX_LENGTH) ??
      // El código de un rol nuevo sale del nombre y el backend admite hasta 80 caracteres.
      (!role && code.length > ROLE_CODE_MAX_LENGTH
        ? `Máximo ${ROLE_CODE_MAX_LENGTH} caracteres para un rol nuevo.`
        : null);
    setNameError(error ?? undefined);
    if (error) return;
    const selectionError = customRoleSelectionError(role?.code, permissions);
    setPermissionsError(selectionError ?? undefined);
    if (selectionError) return;
    const finalPermissions = isProtectedAdminRole
      ? withFixedAdminPermissions(permissions)
      : permissions;
    void save.submit(() =>
      onSave({
        id: role?.id ?? 0,
        dbId: role?.dbId ?? '',
        code,
        name: trimmedName,
        description: description.trim(),
        permissions: finalPermissions,
        permissionKeys: rolePermissionKeysFromUi(code, finalPermissions),
        userCount: role?.userCount ?? 0,
      }),
    );
  };
  return (
    <AdminModal
      title={role ? 'Editar rol' : 'Nuevo rol'}
      eyebrow="ROLES Y PERMISOS"
      onClose={onClose}
      onSubmit={submit}
      submitting={save.submitting}
      error={save.error}
      submitLabel={role ? 'Guardar cambios' : 'Crear rol'}
      width={520}
    >
      <label className="hk-form-label">
        Nombre del rol *
        <input
          className={inputClass(nameError)}
          value={name}
          maxLength={ROLE_NAME_MAX_LENGTH}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(undefined);
          }}
          placeholder="Ej. Gerente"
          aria-required="true"
          {...fieldErrorProps('role-name-error', nameError)}
        />
        <FieldError id="role-name-error" error={nameError} />
      </label>
      <label className="hk-form-label">
        Descripción
        <input
          className="hk-form-select"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción del rol"
        />
      </label>
      <label className="hk-form-label">
        Permisos
        <div className="adm-perm-editor">
          {ROLE_ACCESS_GROUPS.map((group) => (
            <div className="adm-perm-editor-group" key={group.name}>
              <div className="adm-perm-editor-heading">
                <h4>{group.name}</h4>
                <div className="adm-perm-bulk-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={
                      (isProtectedAdminRole && group.name === ADMIN_ACCESS_GROUP_NAME) ||
                      !editableGroups.includes(group.name)
                    }
                    onClick={() => setGroupPermissions(group, true)}
                  >
                    Seleccionar todo
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={
                      (isProtectedAdminRole && group.name === ADMIN_ACCESS_GROUP_NAME) ||
                      !editableGroups.includes(group.name)
                    }
                    onClick={() => setGroupPermissions(group, false)}
                  >
                    Deseleccionar todo
                  </button>
                </div>
              </div>
              {group.items.map((p) => {
                const key = roleAccessKey(group.name, p);
                const isLockedAdminPermission =
                  isProtectedAdminRole && group.name === ADMIN_ACCESS_GROUP_NAME;
                const isOutsideRoleArea = !editableGroups.includes(group.name);
                const checked = isLockedAdminPermission ? true : permissions[key];
                return (
                  <button
                    type="button"
                    key={key}
                    className={`adm-perm-toggle ${checked ? 'on' : ''}`}
                    disabled={isLockedAdminPermission || isOutsideRoleArea}
                    aria-pressed={Boolean(checked)}
                    title={
                      isLockedAdminPermission
                        ? 'El grupo Administración permanece habilitado para este rol.'
                        : isOutsideRoleArea
                          ? 'Esta área no está disponible para este rol.'
                          : undefined
                    }
                    onClick={() => {
                      setPermissionsError(undefined);
                      setPermissions((cur) => ({ ...cur, [key]: !cur[key] }));
                    }}
                  >
                    <span className="adm-perm-check">{checked && <Check size={12} />}</span>
                    <span>{p}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <FieldError id="role-permissions-error" error={permissionsError} />
      </label>
    </AdminModal>
  );
}

export function RoomModal({
  room,
  roomTypes,
  onClose,
  onSave,
}: {
  room: AdminRoom | null;
  roomTypes: AdminRoomType[];
  onClose: () => void;
  onSave: (r: AdminRoom) => void | Promise<void>;
}) {
  const [number, setNumber] = useState(room?.number ?? '');
  const [floor, setFloor] = useState(room?.floor ?? 'Piso 1');
  const [type, setType] = useState(room?.type ?? roomTypes[0]?.name ?? '');
  const [capacity, setCapacity] = useState(String(room?.capacity ?? 2));
  const [rate, setRate] = useState(amountToMoneyInput(room?.rate ?? 1850));
  const [status, setStatus] = useState(room?.status ?? 'Disponible');
  const [errors, setErrors] = useState<
    FieldErrors<'number' | 'floor' | 'type' | 'capacity' | 'rate'>
  >({});
  const save = useAdminSubmit();
  const selectedRoomType = roomTypes.find((rt) => rt.name === type);
  const clearError = (field: 'number' | 'floor' | 'type' | 'capacity' | 'rate') =>
    setErrors((current) => ({ ...current, [field]: undefined }));
  const submit = () => {
    const nextErrors = compactErrors({
      number:
        validateRequiredText(number, 'Ingresa el número de habitación.') ??
        patternError(number, ROOM_NUMBER_PATTERN, 'Usa solo letras, números y guiones.'),
      // El backend guarda el piso como número: "Piso 2" o "2" (antes, sin número pasaba a 1).
      floor: /\d/.test(floor) ? null : 'Ingresa el piso (ej. 2 o Piso 2).',
      type: selectedRoomType ? null : 'Selecciona un tipo de habitación.',
      capacity: validateWholeNumber(capacity, {
        min: 1,
        max: ROOM_CAPACITY_MAX,
        requiredMessage: 'Ingresa la capacidad.',
        minMessage: 'Mínimo 1 huésped.',
        maxMessage: `Máximo ${ROOM_CAPACITY_MAX} huéspedes.`,
      }),
      rate: validateMoneyAmount(rate, { allowZero: true, requiredMessage: 'Ingresa la tarifa.' }),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void save.submit(() =>
      onSave({
        id: room?.id ?? 0,
        dbId: room?.dbId ?? '',
        roomTypeId: selectedRoomType?.dbId ?? room?.roomTypeId ?? '',
        number: number.trim(),
        floor: floor.trim(),
        type,
        capacity: Number(capacity),
        rate: (moneyInputToCents(rate) ?? 0) / 100,
        status,
        active: room?.active ?? true,
        features: selectedRoomType?.features ?? room?.features ?? [],
      }),
    );
  };
  return (
    <AdminModal
      title={room ? 'Editar habitación' : 'Nueva habitación'}
      eyebrow="GESTIÓN DE HABITACIONES"
      onClose={onClose}
      onSubmit={submit}
      submitting={save.submitting}
      error={save.error}
      submitLabel={room ? 'Guardar cambios' : 'Crear habitación'}
    >
      <div className="rc-form-grid">
        <label className="hk-form-label">
          Número *
          <input
            className={inputClass(errors.number)}
            maxLength={20}
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
              clearError('number');
            }}
            placeholder="Ej. 101"
            aria-required="true"
            {...fieldErrorProps('room-number-error', errors.number)}
          />
          <FieldError id="room-number-error" error={errors.number} />
        </label>
        <label className="hk-form-label">
          Piso *
          <input
            className={inputClass(errors.floor)}
            maxLength={30}
            value={floor}
            onChange={(e) => {
              setFloor(e.target.value);
              clearError('floor');
            }}
            placeholder="Ej. Piso 1"
            aria-required="true"
            {...fieldErrorProps('room-floor-error', errors.floor)}
          />
          <FieldError id="room-floor-error" error={errors.floor} />
        </label>
        <label className="hk-form-label">
          Tipo *
          <select
            className={inputClass(errors.type)}
            value={type}
            disabled={roomTypes.length === 0}
            onChange={(e) => {
              setType(e.target.value);
              clearError('type');
            }}
            aria-required="true"
            {...fieldErrorProps('room-type-error', errors.type)}
          >
            {roomTypes.length === 0 && <option value="">No hay tipos de habitación</option>}
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.name}>
                {rt.name}
              </option>
            ))}
          </select>
          <FieldError id="room-type-error" error={errors.type} />
        </label>
        <label className="hk-form-label">
          Capacidad
          <input
            className={inputClass(errors.capacity)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={capacity}
            onChange={(e) => {
              if (!isWholeNumberInput(e.target.value)) return;
              setCapacity(e.target.value);
              clearError('capacity');
            }}
            {...fieldErrorProps('room-capacity-error', errors.capacity)}
          />
          <FieldError id="room-capacity-error" error={errors.capacity} />
        </label>
        <label className="hk-form-label">
          Tarifa
          <input
            className={inputClass(errors.rate)}
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => {
              const next = e.target.value.trim();
              if (!isMoneyInput(next)) return;
              setRate(next);
              clearError('rate');
            }}
            {...fieldErrorProps('room-rate-error', errors.rate)}
          />
          <FieldError id="room-rate-error" error={errors.rate} />
        </label>
        <label className="hk-form-label">
          Estado
          <select
            className="hk-form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>Disponible</option>
            <option>Ocupada</option>
            <option>Limpieza</option>
            <option>Mantenimiento</option>
          </select>
        </label>
      </div>
      <p className="adm-room-feature-note">
        Las características se configuran en Tipos de habitación y se comparten entre las
        habitaciones de ese tipo.
      </p>
    </AdminModal>
  );
}

function RoomFeatureCatalogModal({
  features,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  features: RoomFeature[];
  onClose: () => void;
  onCreate: (data: { name: string; description?: string }) => Promise<void>;
  onUpdate: (id: string, data: { name: string; description?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<RoomFeature | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pendingDelete, setPendingDelete] = useState<RoomFeature | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setError('');
  };

  const startEdit = (feature: RoomFeature) => {
    setEditing(feature);
    setName(feature.name);
    setDescription(feature.description ?? '');
    setError('');
  };

  const save = async () => {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      setError('Escribe el nombre de la característica.');
      return;
    }
    if (
      features.some(
        (feature) =>
          feature.id !== editing?.id &&
          feature.name.localeCompare(cleanName, undefined, { sensitivity: 'accent' }) === 0,
      )
    ) {
      setError('Ya existe una característica con ese nombre.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = { name: cleanName, description: description.trim() || undefined };
      if (editing) await onUpdate(editing.id, data);
      else await onCreate(data);
      resetForm();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setError('');
    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
      if (editing?.id === pendingDelete.id) resetForm();
    } catch (cause) {
      const message = getErrorMessage(cause);
      setError(
        /assigned|room types/i.test(message)
          ? 'No se puede eliminar porque está asignada a uno o más tipos de habitación.'
          : message,
      );
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminModal
        title="Características de habitación"
        eyebrow="CATÁLOGO DE HABITACIONES"
        width={600}
        onClose={onClose}
      >
        <p className="muted">
          Administra las características que puedes asignar a cada tipo de habitación.
        </p>
        <div className="room-feature-catalog-list">
          {features.length === 0 ? (
            <p className="muted">Todavía no hay características registradas.</p>
          ) : (
            features.map((feature) => (
              <div className="room-feature-catalog-row" key={feature.id}>
                <div>
                  <strong>{feature.name}</strong>
                  <span>{feature.description || 'Sin descripción'}</span>
                </div>
                <div className="adm-heading-actions">
                  <EditIconButton
                    label={`Editar ${feature.name}`}
                    onClick={() => startEdit(feature)}
                  />
                  <button
                    className="button small secondary adm-icon-action"
                    type="button"
                    aria-label={`Eliminar ${feature.name}`}
                    title={`Eliminar ${feature.name}`}
                    onClick={() => setPendingDelete(feature)}
                    disabled={busy}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="room-feature-catalog-form">
          <h3>{editing ? 'Editar característica' : 'Nueva característica'}</h3>
          <label className="hk-form-label">
            Nombre
            <input
              className="hk-form-select"
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Balcón privado"
            />
          </label>
          <label className="hk-form-label">
            Descripción <span className="muted">(opcional)</span>
            <textarea
              className="hk-form-textarea"
              maxLength={300}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe brevemente la característica"
            />
          </label>
          {error && (
            <p className="adm-modal-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-foot">
            {editing && (
              <button
                className="button secondary"
                type="button"
                onClick={resetForm}
                disabled={busy}
              >
                Cancelar edición
              </button>
            )}
            <button
              className="button primary"
              type="button"
              onClick={() => void save()}
              disabled={busy}
            >
              {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar característica'}
            </button>
          </div>
        </div>
      </AdminModal>
      {pendingDelete && (
        <div
          className="modal-backdrop room-feature-confirm-backdrop"
          onMouseDown={() => !busy && setPendingDelete(null)}
        >
          <div
            className="modal adm-modal room-feature-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="room-feature-delete-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">CONFIRMAR ELIMINACIÓN</p>
                <h2 id="room-feature-delete-title">¿Eliminar característica?</h2>
              </div>
              <button
                className="icon-btn"
                type="button"
                aria-label="Cerrar"
                onClick={() => setPendingDelete(null)}
                disabled={busy}
              >
                <X size={18} />
              </button>
            </div>
            <p>
              Se eliminará “{pendingDelete.name}”. No se puede eliminar si está asignada a un tipo
              de habitación.
            </p>
            <div className="modal-foot">
              <button
                className="button secondary"
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                className="button danger"
                type="button"
                onClick={() => void confirmDelete()}
                disabled={busy}
              >
                {busy ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function RoomTypeModal({
  roomType,
  roomFeatures,
  onClose,
  onSave,
}: {
  roomType: AdminRoomType | null;
  roomFeatures: RoomFeature[];
  onClose: () => void;
  onSave: (rt: AdminRoomType, images: MediaImageAssignmentDto[]) => Promise<void>;
}) {
  const [name, setName] = useState(roomType?.name ?? '');
  const [capacity, setCapacity] = useState(String(roomType?.capacity ?? 2));
  const [description, setDescription] = useState(roomType?.description ?? '');
  const [basePrice, setBasePrice] = useState(amountToMoneyInput(roomType?.basePrice ?? 1850));
  const [status, setStatus] = useState<'Activo' | 'Inactivo'>(roomType?.status ?? 'Activo');
  const [roomFeatureIds, setRoomFeatureIds] = useState(roomType?.roomFeatureIds ?? []);
  const [gallery, setGallery] = useState<GalleryItem[]>(() =>
    galleryFromImages(roomType?.images ?? []),
  );
  const [errors, setErrors] = useState<FieldErrors<'name' | 'capacity' | 'basePrice'>>({});
  const save = useModalSave(gallery, onClose);
  const clearError = (field: 'name' | 'capacity' | 'basePrice') =>
    setErrors((current) => ({ ...current, [field]: undefined }));
  const submit = () => {
    const nextErrors = compactErrors({
      name:
        validateRequiredText(name, 'Ingresa el nombre del tipo.') ??
        patternError(
          name,
          ROOM_TYPE_NAME_PATTERN,
          'Empieza con una letra; usa letras, números, espacios, apóstrofos o guiones (2 a 80).',
        ),
      // Backend: capacidad > 0 (`CreateRoomTypeRequest`, @Positive).
      capacity: validateWholeNumber(capacity, {
        min: 1,
        max: ROOM_CAPACITY_MAX,
        requiredMessage: 'Ingresa la capacidad.',
        minMessage: 'Mínimo 1 huésped.',
        maxMessage: `Máximo ${ROOM_CAPACITY_MAX} huéspedes.`,
      }),
      // Backend: precio de la tarifa ≥ 0 (`CreateRateRequest`, @PositiveOrZero).
      basePrice: validateMoneyAmount(basePrice, {
        allowZero: true,
        requiredMessage: 'Ingresa el precio base.',
      }),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void save.submit(() =>
      onSave(
        {
          id: roomType?.id ?? 0,
          dbId: roomType?.dbId ?? '',
          name: name.trim(),
          capacity: Number(capacity),
          description: description.trim(),
          // Características del catálogo elegidas en el selector (no las camas).
          roomFeatureIds,
          features: roomFeatures
            .filter((feature) => roomFeatureIds.includes(feature.id))
            .map((feature) => feature.name),
          basePrice: (moneyInputToCents(basePrice) ?? 0) / 100,
          status,
          images: roomType?.images ?? [],
        },
        toImageAssignments(gallery),
      ),
    );
  };
  return (
    <AdminModal
      title={roomType ? 'Editar tipo de habitación' : 'Nuevo tipo de habitación'}
      eyebrow="TIPOS DE HABITACIÓN"
      width={640}
      onClose={save.cancel}
      submitting={save.submitting}
      error={save.error}
      onSubmit={submit}
      submitLabel={roomType ? 'Guardar cambios' : 'Crear tipo'}
    >
      <div className="rc-form-grid">
        <label className="hk-form-label">
          Nombre *
          <input
            className={inputClass(errors.name)}
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError('name');
            }}
            placeholder="Ej. Deluxe"
            aria-required="true"
            {...fieldErrorProps('room-type-name-error', errors.name)}
          />
          <FieldError id="room-type-name-error" error={errors.name} />
        </label>
        <label className="hk-form-label">
          Capacidad *
          <input
            className={inputClass(errors.capacity)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={capacity}
            onChange={(e) => {
              if (!isWholeNumberInput(e.target.value)) return;
              setCapacity(e.target.value);
              clearError('capacity');
            }}
            aria-required="true"
            {...fieldErrorProps('room-type-capacity-error', errors.capacity)}
          />
          <FieldError id="room-type-capacity-error" error={errors.capacity} />
        </label>
      </div>
      <label className="hk-form-label">
        Descripción
        <textarea
          className="hk-form-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción del tipo de habitación"
        />
      </label>
      <fieldset className="adm-room-feature-picker">
        <legend>Características</legend>
        {roomFeatures.length === 0 ? (
          <p className="muted">Agrega características desde el catálogo.</p>
        ) : (
          <div>
            {roomFeatures.map((feature) => (
              <label key={feature.id}>
                <input
                  type="checkbox"
                  checked={roomFeatureIds.includes(feature.id)}
                  onChange={(event) =>
                    setRoomFeatureIds((current) =>
                      event.target.checked
                        ? [...current, feature.id]
                        : current.filter((id) => id !== feature.id),
                    )
                  }
                />
                <span>{feature.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="rc-form-grid">
        <label className="hk-form-label">
          Precio base *
          <input
            className={inputClass(errors.basePrice)}
            type="text"
            inputMode="decimal"
            value={basePrice}
            onChange={(e) => {
              const next = e.target.value.trim();
              if (!isMoneyInput(next)) return;
              setBasePrice(next);
              clearError('basePrice');
            }}
            aria-required="true"
            {...fieldErrorProps('room-type-price-error', errors.basePrice)}
          />
          <FieldError id="room-type-price-error" error={errors.basePrice} />
        </label>
        <label className="hk-form-label">
          Estado
          <select
            className="hk-form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'Activo' | 'Inactivo')}
          >
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </label>
      </div>
      <div className="adm-modal-section">
        <ImageGalleryField
          label="Fotos del tipo de habitación"
          target="roomType"
          items={gallery}
          onChange={setGallery}
          recordName={name || 'el tipo de habitación'}
          disabled={save.submitting}
        />
      </div>
    </AdminModal>
  );
}

/**
 * Guardado de un modal de catálogo con imágenes: no guarda mientras una
 * imagen sube o falló, muestra el error del backend sin cerrar el modal y, si
 * se cancela, borra las imágenes subidas que nunca se guardaron.
 */
function useModalSave(gallery: GalleryItem[], onClose: () => void) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El aviso de "no se puede guardar" deja de valer en cuanto cambia la galería.
  useEffect(() => {
    setError(null);
  }, [gallery]);

  async function submit(save: () => Promise<void>) {
    if (submitting) return;
    const blocker = getGallerySaveBlocker(gallery);
    if (blocker) {
      setError(blocker);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await save();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible guardar los cambios.');
    } finally {
      // Si el guardado captura su propio error (aviso) y el modal sigue abierto,
      // los botones vuelven a habilitarse en lugar de quedar en "Guardando…".
      setSubmitting(false);
    }
  }

  function cancel() {
    if (submitting) return;
    void discardPendingUploads(gallery);
    onClose();
  }

  return { submit, cancel, submitting, error };
}

/**
 * Guardado de un modal sin imágenes: un solo envío a la vez y, si el guardado
 * falla, el error se muestra dentro del modal (que sigue abierto).
 */
function useAdminSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(save: () => void | Promise<void>) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await save();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible guardar los cambios.');
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, submitting, error };
}

/** Mensaje de error junto al campo, asociado por `id` a su `aria-describedby`. */
function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <span id={id} className="hk-form-error">
      {error}
    </span>
  ) : null;
}

type FieldErrors<Key extends string> = Partial<Record<Key, string>>;

/** Quita los errores vacíos para saber si el formulario puede enviarse. */
function compactErrors<Key extends string>(
  errors: Record<Key, string | null | undefined>,
): FieldErrors<Key> {
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => Boolean(message)),
  ) as FieldErrors<Key>;
}

const inputClass = (error?: string) => `hk-form-select${error ? ' error' : ''}`;

export function SeasonRateModal({
  roomTypes,
  rate,
  onClose,
  onSave,
}: {
  roomTypes: AdminRoomType[];
  rate: SeasonRate | null;
  onClose: () => void;
  onSave: (sr: SeasonRate) => void | Promise<void>;
}) {
  type Field =
    'roomType' | 'seasonName' | 'startDate' | 'endDate' | 'seasonalRate' | 'minimumNights';
  const [roomType, setRoomType] = useState(rate?.roomType ?? roomTypes[0]?.name ?? '');
  const [seasonName, setSeasonName] = useState(rate?.seasonName ?? '');
  const [startDate, setStartDate] = useState(rate?.startDate ?? '');
  const [endDate, setEndDate] = useState(rate?.endDate ?? '');
  const [seasonalRate, setSeasonalRate] = useState(rate ? String(rate.seasonalRate) : '');
  const [minimumNights, setMinimumNights] = useState(String(rate?.minimumNights ?? 1));
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const save = useAdminSubmit();
  const clearError = (...fields: Field[]) =>
    setErrors((current) => ({
      ...current,
      ...Object.fromEntries(fields.map((field) => [field, undefined])),
    }));
  const selectedRoomType = roomTypes.find((item) => item.name === roomType);
  const submit = () => {
    // Backend: la fecha fin no puede ser anterior a la de inicio (`RateServiceImpl`).
    const range = validateDateRange(startDate, endDate);
    const nextErrors = compactErrors({
      roomType: roomTypes.some((rt) => rt.name === roomType)
        ? null
        : 'Selecciona un tipo de habitación.',
      seasonName: validateRequiredText(seasonName, 'Ingresa el nombre de la temporada.'),
      startDate: range.start,
      endDate: range.end,
      // Backend: precio ≥ 0 (`CreateRateRequest`, @PositiveOrZero).
      seasonalRate: validateMoneyAmount(seasonalRate, {
        allowZero: true,
        requiredMessage: 'Ingresa la tarifa especial.',
      }),
      // Backend: minimumNights entero > 0 (`CreateRateRequest`, @Positive).
      minimumNights: validateWholeNumber(minimumNights, {
        min: 1,
        requiredMessage: 'Ingresa las noches mínimas.',
        minMessage: 'Mínimo 1 noche.',
      }),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void save.submit(() =>
      onSave({
        id: 0,
        dbId: '',
        roomType,
        seasonName: seasonName.trim(),
        startDate,
        endDate,
        baseRate: selectedRoomType?.basePrice ?? 0,
        seasonalRate: (moneyInputToCents(seasonalRate) ?? 0) / 100,
        minimumNights: Number(minimumNights),
        status: 'Activa',
      }),
    );
  };
  const moneyField = (field: 'seasonalRate', value: string, setValue: (value: string) => void) => (
    <input
      className={inputClass(errors[field])}
      type="text"
      inputMode="decimal"
      value={value}
      placeholder="0.00"
      onChange={(e) => {
        const next = e.target.value.trim();
        if (!isMoneyInput(next)) return;
        setValue(next);
        clearError(field);
      }}
      aria-required="true"
      {...fieldErrorProps(`season-${field}-error`, errors[field])}
    />
  );
  return (
    <AdminModal
      title={rate ? 'Editar tarifa de temporada' : 'Nueva tarifa de temporada'}
      eyebrow="TARIFAS POR TEMPORADA"
      onClose={onClose}
      onSubmit={submit}
      submitting={save.submitting}
      error={save.error}
      submitLabel={rate ? 'Guardar cambios' : 'Crear tarifa'}
    >
      <div className="rc-form-grid">
        <label className="hk-form-label">
          Tipo de habitación *
          <select
            className={inputClass(errors.roomType)}
            value={roomType}
            disabled={roomTypes.length === 0}
            onChange={(e) => {
              setRoomType(e.target.value);
              clearError('roomType');
            }}
            aria-required="true"
            {...fieldErrorProps('season-room-type-error', errors.roomType)}
          >
            {roomTypes.length === 0 && <option value="">No hay tipos de habitación</option>}
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.name}>
                {rt.name}
              </option>
            ))}
          </select>
          <FieldError id="season-room-type-error" error={errors.roomType} />
        </label>
        <label className="hk-form-label">
          Temporada *
          <input
            className={inputClass(errors.seasonName)}
            value={seasonName}
            onChange={(e) => {
              setSeasonName(e.target.value);
              clearError('seasonName');
            }}
            placeholder="Ej. Semana Santa"
            aria-required="true"
            {...fieldErrorProps('season-name-error', errors.seasonName)}
          />
          <FieldError id="season-name-error" error={errors.seasonName} />
        </label>
        <label className="hk-form-label">
          Fecha inicio *
          <input
            className={inputClass(errors.startDate)}
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              clearError('startDate', 'endDate');
            }}
            aria-required="true"
            {...fieldErrorProps('season-start-error', errors.startDate)}
          />
          <FieldError id="season-start-error" error={errors.startDate} />
        </label>
        <label className="hk-form-label">
          Fecha fin *
          <input
            className={inputClass(errors.endDate)}
            type="date"
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              clearError('endDate');
            }}
            aria-required="true"
            {...fieldErrorProps('season-end-error', errors.endDate)}
          />
          <FieldError id="season-end-error" error={errors.endDate} />
        </label>
        <label className="hk-form-label">
          Tarifa base actual
          <div className="rc-rate-preview">
            {selectedRoomType ? money(selectedRoomType.basePrice) : 'Sin tarifa base'} por noche
          </div>
        </label>
        <label className="hk-form-label">
          Tarifa especial por noche *{moneyField('seasonalRate', seasonalRate, setSeasonalRate)}
          <FieldError id="season-seasonalRate-error" error={errors.seasonalRate} />
        </label>
        <label className="hk-form-label">
          Noches mínimas *
          <input
            className={inputClass(errors.minimumNights)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            value={minimumNights}
            onChange={(e) => {
              if (!isWholeNumberInput(e.target.value)) return;
              setMinimumNights(e.target.value);
              clearError('minimumNights');
            }}
            aria-required="true"
            {...fieldErrorProps('season-minimumNights-error', errors.minimumNights)}
          />
          <FieldError id="season-minimumNights-error" error={errors.minimumNights} />
        </label>
      </div>
    </AdminModal>
  );
}

export function PromoModal({
  promo,
  onClose,
  onSave,
}: {
  promo: Promo | null;
  onClose: () => void;
  onSave: (p: Promo) => void | Promise<void>;
}) {
  type Field = 'name' | 'code' | 'percentage' | 'startDate' | 'endDate';
  const [name, setName] = useState(promo?.name ?? '');
  const [code, setCode] = useState(promo?.code ?? '');
  const [percentage, setPercentage] = useState(String(promo?.percentage ?? 10));
  const [startDate, setStartDate] = useState(promo?.startDate ?? '');
  const [endDate, setEndDate] = useState(promo?.endDate ?? '');
  const [conditions, setConditions] = useState(promo?.conditions ?? '');
  const [status, setStatus] = useState<'Activa' | 'Inactiva'>(promo?.status ?? 'Activa');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const save = useAdminSubmit();
  const clearError = (...fields: Field[]) =>
    setErrors((current) => ({
      ...current,
      ...Object.fromEntries(fields.map((field) => [field, undefined])),
    }));
  const submit = () => {
    // Backend: inicio obligatorio; fin opcional y no anterior al inicio (`UpsertPromotionRequest`).
    const range = endDate ? validateDateRange(startDate, endDate) : {};
    const nextErrors = compactErrors({
      name:
        validateRequiredText(name, 'Ingresa el nombre de la promoción.') ??
        patternError(
          name,
          PROMO_NAME_PATTERN,
          'Usa letras, números, espacios, apóstrofos o guiones (2 a 100).',
        ),
      code:
        validateRequiredText(code, 'Ingresa el código.') ??
        (code.trim().length < PROMO_CODE_MIN_LENGTH
          ? `Mínimo ${PROMO_CODE_MIN_LENGTH} caracteres.`
          : null),
      percentage: validateWholeNumber(percentage, {
        min: PROMO_PERCENT_MIN,
        max: PROMO_PERCENT_MAX,
        requiredMessage: 'Ingresa el porcentaje.',
        minMessage: `Entre ${PROMO_PERCENT_MIN} y ${PROMO_PERCENT_MAX}.`,
        maxMessage: `Entre ${PROMO_PERCENT_MIN} y ${PROMO_PERCENT_MAX}.`,
      }),
      startDate: !startDate ? 'Ingresa la fecha de inicio.' : range.start,
      endDate: range.end,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void save.submit(() =>
      onSave({
        id: promo?.id ?? 0,
        dbId: promo?.dbId ?? '',
        name: name.trim(),
        code: code.trim(),
        percentage: Number(percentage),
        startDate,
        endDate,
        conditions: conditions.trim(),
        status,
      }),
    );
  };
  return (
    <AdminModal
      title={promo ? 'Editar promoción' : 'Nueva promoción'}
      eyebrow="GESTIÓN DE PROMOCIONES"
      onClose={onClose}
      onSubmit={submit}
      submitting={save.submitting}
      error={save.error}
      submitLabel={promo ? 'Guardar cambios' : 'Crear promoción'}
    >
      <div className="rc-form-grid">
        <label className="hk-form-label">
          Nombre *
          <input
            className={inputClass(errors.name)}
            maxLength={100}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError('name');
            }}
            placeholder="Ej. Estancia extendida"
            aria-required="true"
            {...fieldErrorProps('promo-name-error', errors.name)}
          />
          <FieldError id="promo-name-error" error={errors.name} />
        </label>
        <label className="hk-form-label">
          Código *
          <input
            className={inputClass(errors.code)}
            maxLength={50}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              clearError('code');
            }}
            placeholder="Ej. AURORA15"
            aria-required="true"
            {...fieldErrorProps('promo-code-error', errors.code)}
          />
          <FieldError id="promo-code-error" error={errors.code} />
        </label>
        <label className="hk-form-label">
          Porcentaje (%) *
          <input
            className={inputClass(errors.percentage)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            value={percentage}
            onChange={(e) => {
              if (!isWholeNumberInput(e.target.value)) return;
              setPercentage(e.target.value);
              clearError('percentage');
            }}
            aria-required="true"
            {...fieldErrorProps('promo-percentage-error', errors.percentage)}
          />
          <FieldError id="promo-percentage-error" error={errors.percentage} />
        </label>
        <label className="hk-form-label">
          Estado
          <select
            className="hk-form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'Activa' | 'Inactiva')}
          >
            <option value="Activa">Activa</option>
            <option value="Inactiva">Inactiva</option>
          </select>
        </label>
        <label className="hk-form-label">
          Fecha inicio *
          <input
            className={inputClass(errors.startDate)}
            type="date"
            required
            max={endDate || undefined}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              clearError('startDate', 'endDate');
            }}
            aria-required="true"
            {...fieldErrorProps('promo-start-error', errors.startDate)}
          />
          <FieldError id="promo-start-error" error={errors.startDate} />
        </label>
        <label className="hk-form-label">
          Fecha fin
          <input
            className={inputClass(errors.endDate)}
            type="date"
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              clearError('endDate');
            }}
            {...fieldErrorProps('promo-end-error', errors.endDate)}
          />
          <FieldError id="promo-end-error" error={errors.endDate} />
        </label>
      </div>
      <label className="hk-form-label">
        Condiciones
        <textarea
          className="hk-form-textarea"
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          placeholder="Ej. Estancias de 4 noches o más"
        />
      </label>
    </AdminModal>
  );
}

function AmenityModal({
  amenity,
  onClose,
  onSave,
}: {
  amenity: Amenity | null;
  onClose: () => void;
  onSave: (a: Amenity, images: MediaImageAssignmentDto[]) => Promise<void>;
}) {
  const [name, setName] = useState(amenity?.name ?? '');
  const [description, setDescription] = useState(amenity?.description ?? '');
  const [category, setCategory] = useState<AmenityCategory>(amenity?.category ?? 'hotel');
  const [opensAt, setOpensAt] = useState(() => amenity?.schedule.split(' - ')[0] ?? '');
  const [closesAt, setClosesAt] = useState(() => amenity?.schedule.split(' - ')[1] ?? '');
  const [status, setStatus] = useState<'Activo' | 'Inactivo'>(amenity?.status ?? 'Activo');
  const [icon, setIcon] = useState(amenity?.icon ?? 'Sparkles');
  const [gallery, setGallery] = useState<GalleryItem[]>(() =>
    galleryFromImages(amenity?.images ?? []),
  );
  const [errors, setErrors] = useState<FieldErrors<'name' | 'schedule'>>({});
  const save = useModalSave(gallery, onClose);
  const submit = () => {
    // Dos selectores de hora (abre/cierra); se valida el mismo texto que se guarda.
    const schedule = opensAt || closesAt ? `${opensAt} - ${closesAt}` : '';
    const parsedSchedule = parseAmenityScheduleInput(schedule);
    const nextErrors = compactErrors({
      name:
        validateRequiredText(name, 'Ingresa el nombre de la amenidad.') ?? catalogNameError(name),
      // Mismo análisis que al guardar, pero el error queda junto al campo.
      schedule: parsedSchedule.ok ? null : parsedSchedule.error,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void save.submit(() =>
      onSave(
        {
          id: amenity?.id ?? 0,
          dbId: amenity?.dbId ?? '',
          name: name.trim(),
          description: description.trim(),
          category,
          schedule,
          // La disponibilidad sale del estado: el backend solo guarda `active`.
          available: status === 'Activo',
          status,
          icon,
          images: amenity?.images ?? [],
        },
        toImageAssignments(gallery),
      ),
    );
  };
  const scheduleAria = {
    'aria-invalid': errors.schedule ? true : undefined,
    'aria-describedby': errors.schedule
      ? 'amenity-schedule-error amenity-schedule-help'
      : 'amenity-schedule-help',
  };
  return (
    <AdminModal
      title={amenity ? 'Editar amenidad' : 'Nueva amenidad'}
      eyebrow="GESTIÓN DE AMENIDADES"
      onClose={save.cancel}
      submitting={save.submitting}
      error={save.error}
      onSubmit={submit}
      submitLabel={amenity ? 'Guardar cambios' : 'Crear amenidad'}
    >
      <div className="rc-form-grid">
        <label className="hk-form-label">
          Nombre *
          <input
            className={inputClass(errors.name)}
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((current) => ({ ...current, name: undefined }));
            }}
            placeholder="Ej. Piscina"
            aria-required="true"
            {...fieldErrorProps('amenity-name-error', errors.name)}
          />
          <FieldError id="amenity-name-error" error={errors.name} />
        </label>
        <label className="hk-form-label">
          Categoría
          <select
            className="hk-form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as AmenityCategory)}
          >
            <option value="hotel">Hotel</option>
            <option value="room">Habitación</option>
            <option value="service">Servicio</option>
          </select>
        </label>
        <label className="hk-form-label">
          Abre
          <input
            className={inputClass(errors.schedule)}
            type="time"
            step={60}
            value={opensAt}
            required={Boolean(closesAt)}
            max={closesAt || undefined}
            onChange={(e) => {
              setOpensAt(e.target.value);
              setErrors((current) => ({ ...current, schedule: undefined }));
            }}
            {...scheduleAria}
          />
        </label>
        <label className="hk-form-label">
          Cierra
          <input
            className={inputClass(errors.schedule)}
            type="time"
            step={60}
            value={closesAt}
            required={Boolean(opensAt)}
            min={opensAt || undefined}
            onChange={(e) => {
              setClosesAt(e.target.value);
              setErrors((current) => ({ ...current, schedule: undefined }));
            }}
            {...scheduleAria}
          />
        </label>
        <FieldError id="amenity-schedule-error" error={errors.schedule} />
        <small id="amenity-schedule-help" className="adm-field-help">
          Elige ambas horas o déjalas vacías si está disponible todo el día.
        </small>
        <label className="hk-form-label">
          Ícono
          <select className="hk-form-select" value={icon} onChange={(e) => setIcon(e.target.value)}>
            <option value="Waves">Piscina</option>
            <option value="Utensils">Restaurante</option>
            <option value="Dumbbell">Gimnasio</option>
            <option value="Sparkles">Spa</option>
            <option value="Star">Terraza</option>
            <option value="Wifi">Wi-Fi</option>
          </select>
        </label>
        <label className="hk-form-label">
          Estado
          <select
            className="hk-form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'Activo' | 'Inactivo')}
          >
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </label>
      </div>
      <label className="hk-form-label">
        Descripción
        <textarea
          className="hk-form-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej. Piscina climatizada con servicio de bebidas"
        />
      </label>
      <div className="adm-modal-section">
        <ImageGalleryField
          label="Foto de la amenidad"
          target="amenity"
          items={gallery}
          onChange={setGallery}
          maxImages={1}
          recordName={name || 'la amenidad'}
          disabled={save.submitting}
        />
      </div>
    </AdminModal>
  );
}

export function RsItemModal({
  item,
  onClose,
  onSave,
}: {
  item: RoomServiceItem | null;
  onClose: () => void;
  onSave: (i: RoomServiceItem, images: MediaImageAssignmentDto[]) => Promise<void>;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [categoryCode, setCategoryCode] = useState<Product['category']>(
    item?.categoryCode ?? 'foodAndBeverage',
  );
  const [price, setPrice] = useState(item ? amountToMoneyInput(item.price) : '');
  const [status, setStatus] = useState<'Activo' | 'Inactivo'>(item?.status ?? 'Activo');
  const [gallery, setGallery] = useState<GalleryItem[]>(() =>
    galleryFromImages(item?.images ?? []),
  );
  const [errors, setErrors] = useState<FieldErrors<'name' | 'price'>>({});
  const save = useModalSave(gallery, onClose);
  const submit = () => {
    const nextErrors = compactErrors({
      name: validateRequiredText(name, 'Ingresa el nombre del producto.') ?? catalogNameError(name),
      // Backend: precio de un producto ≥ 1 centavo (`UpsertProductRequest`, @Min(1)).
      price: validateMoneyAmount(price, { requiredMessage: 'Ingresa el precio.' }),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void save.submit(() =>
      onSave(
        {
          id: item?.id ?? 0,
          dbId: item?.dbId ?? '',
          name: name.trim(),
          description: description.trim(),
          category: PRODUCT_CATEGORY_LABELS[categoryCode],
          categoryCode,
          price: (moneyInputToCents(price) ?? 0) / 100,
          // La disponibilidad sale del estado: el backend solo guarda `active`.
          available: status === 'Activo',
          status,
          images: item?.images ?? [],
        },
        toImageAssignments(gallery),
      ),
    );
  };
  return (
    <AdminModal
      title={item ? 'Editar producto' : 'Nuevo producto'}
      eyebrow="CATÁLOGO DE ROOM SERVICE"
      onClose={save.cancel}
      submitting={save.submitting}
      error={save.error}
      onSubmit={submit}
      submitLabel={item ? 'Guardar cambios' : 'Crear producto'}
    >
      <div className="rc-form-grid">
        <label className="hk-form-label">
          Nombre *
          <input
            className={inputClass(errors.name)}
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((current) => ({ ...current, name: undefined }));
            }}
            placeholder="Ej. Desayuno Aurora"
            aria-required="true"
            {...fieldErrorProps('rs-item-name-error', errors.name)}
          />
          <FieldError id="rs-item-name-error" error={errors.name} />
        </label>
        <label className="hk-form-label">
          Precio *
          <input
            className={inputClass(errors.price)}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={price}
            onChange={(e) => {
              const next = e.target.value.trim();
              if (!isMoneyInput(next)) return;
              setPrice(next);
              setErrors((current) => ({ ...current, price: undefined }));
            }}
            aria-required="true"
            {...fieldErrorProps('rs-item-price-error', errors.price)}
          />
          <FieldError id="rs-item-price-error" error={errors.price} />
        </label>
        <label className="hk-form-label">
          Estado
          <select
            className="hk-form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'Activo' | 'Inactivo')}
          >
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </label>
        <label className="hk-form-label">
          Categoría
          <select
            className="hk-form-select"
            value={categoryCode}
            onChange={(event) => setCategoryCode(event.target.value as Product['category'])}
          >
            {Object.entries(PRODUCT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="hk-form-label">
        Descripción
        <textarea
          className="hk-form-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej. Pan de la casa, pollo, tocino y papas fritas"
        />
      </label>
      <div className="adm-modal-section">
        <ImageGalleryField
          label="Foto del producto"
          target="product"
          items={gallery}
          onChange={setGallery}
          maxImages={1}
          recordName={name || 'el producto'}
          disabled={save.submitting}
        />
      </div>
    </AdminModal>
  );
}

function ProductModal({
  product,
  onClose,
  onSave,
}: {
  product: InventoryProduct | null;
  onClose: () => void;
  onSave: (p: InventoryProduct, images: MediaImageAssignmentDto[]) => Promise<void>;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [category, setCategory] = useState(
    product?.category ?? INVENTORY_CATEGORY_LABELS.roomService,
  );
  const [unit, setUnit] = useState<InventoryUnit>(product?.unit ?? 'unit');
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [minStock, setMinStock] = useState(String(product?.minStock ?? 0));
  const [status, setStatus] = useState<'Activo' | 'Inactivo'>(product?.status ?? 'Activo');
  const [gallery, setGallery] = useState<GalleryItem[]>(() =>
    galleryFromImages(product?.images ?? []),
  );
  type Field = 'name' | 'sku' | 'stock' | 'minStock';
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const save = useModalSave(gallery, onClose);
  const clearError = (field: Field) => setErrors((current) => ({ ...current, [field]: undefined }));
  const submit = () => {
    // Backend: existencias y mínimo son enteros ≥ 0 (CHECK de inventory_items).
    const nextErrors = compactErrors({
      name: validateRequiredText(name, 'Ingresa el nombre del insumo.'),
      sku: product ? null : validateRequiredText(sku, 'Ingresa el SKU.', 80),
      stock: product
        ? validateWholeNumber(stock, { min: 0, requiredMessage: 'Ingresa las existencias.' })
        : null,
      minStock: validateWholeNumber(minStock, {
        min: 0,
        requiredMessage: 'Ingresa el stock mínimo.',
      }),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void save.submit(() =>
      onSave(
        {
          id: product?.id ?? 0,
          dbId: product?.dbId ?? '',
          sku: sku.trim(),
          categoryCode:
            INVENTORY_CATEGORY_BY_LABEL[category] ?? product?.categoryCode ?? 'roomService',
          unit,
          name: name.trim(),
          category,
          stock: Number(stock),
          minStock: Number(minStock),
          price: product?.price ?? 0,
          status,
          images: product?.images ?? [],
        },
        toImageAssignments(gallery),
      ),
    );
  };
  const wholeNumberField = (
    field: 'stock' | 'minStock',
    value: string,
    setValue: (v: string) => void,
  ) => (
    <input
      className={inputClass(errors[field])}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      onChange={(e) => {
        if (!isWholeNumberInput(e.target.value)) return;
        setValue(e.target.value);
        clearError(field);
      }}
      aria-required="true"
      {...fieldErrorProps(`inventory-${field}-error`, errors[field])}
    />
  );
  return (
    <AdminModal
      title={product ? 'Editar producto' : 'Nuevo producto'}
      eyebrow="GESTIÓN DE INVENTARIO"
      onClose={save.cancel}
      submitting={save.submitting}
      error={save.error}
      onSubmit={submit}
      submitLabel={product ? 'Guardar cambios' : 'Crear producto'}
    >
      <div className="rc-form-grid">
        <label className="hk-form-label">
          Nombre *
          <input
            className={inputClass(errors.name)}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError('name');
            }}
            placeholder="Ej. Toallas de baño"
            aria-required="true"
            {...fieldErrorProps('inventory-name-error', errors.name)}
          />
          <FieldError id="inventory-name-error" error={errors.name} />
        </label>
        {!product && (
          <label className="hk-form-label">
            SKU *
            <input
              className={inputClass(errors.sku)}
              value={sku}
              onChange={(e) => {
                setSku(e.target.value);
                clearError('sku');
              }}
              placeholder="Ej. COC-AGUA-001"
              maxLength={80}
              aria-required="true"
              {...fieldErrorProps('inventory-sku-error', errors.sku)}
            />
            <FieldError id="inventory-sku-error" error={errors.sku} />
          </label>
        )}
        <label className="hk-form-label">
          Categoría
          <select
            className="hk-form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {INVENTORY_CATEGORY_OPTIONS.map((code) => (
              <option key={code} value={INVENTORY_CATEGORY_LABELS[code]}>
                {INVENTORY_CATEGORY_LABELS[code]}
              </option>
            ))}
          </select>
        </label>
        <label className="hk-form-label">
          Unidad de medida
          <select
            className="hk-form-select"
            value={unit}
            onChange={(e) => setUnit(e.target.value as InventoryUnit)}
            disabled={Boolean(product)}
          >
            {Object.entries(INVENTORY_UNIT_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {product ? (
          <label className="hk-form-label">
            Existencias actuales *{wholeNumberField('stock', stock, setStock)}
            <FieldError id="inventory-stock-error" error={errors.stock} />
          </label>
        ) : (
          <p className="login-helper">El nuevo insumo inicia con existencias en cero.</p>
        )}
        <label className="hk-form-label">
          Stock mínimo *{wholeNumberField('minStock', minStock, setMinStock)}
          <FieldError id="inventory-minStock-error" error={errors.minStock} />
        </label>
        <label className="hk-form-label">
          Estado
          <select
            className="hk-form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'Activo' | 'Inactivo')}
          >
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </label>
      </div>
      <div className="adm-modal-section">
        <ImageGalleryField
          label="Imagen del artículo"
          target="inventoryItem"
          items={gallery}
          onChange={setGallery}
          maxImages={1}
          recordName={name || 'el artículo de inventario'}
          disabled={save.submitting}
        />
      </div>
    </AdminModal>
  );
}

export function MovementModal({
  products,
  onClose,
  onSave,
}: {
  products: InventoryProduct[];
  onClose: () => void;
  onSave: (m: {
    productId: number;
    type: 'Entrada' | 'Salida';
    quantity: number;
    reason: string;
    responsible: string;
  }) => void | Promise<void>;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  const [type, setType] = useState<'Entrada' | 'Salida'>('Entrada');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [responsible, setResponsible] = useState('Edgar González');
  const [errors, setErrors] = useState<FieldErrors<'product' | 'quantity'>>({});
  const save = useAdminSubmit();
  const submit = () => {
    const nextErrors = compactErrors({
      product: products.some((p) => p.id === productId) ? null : 'Selecciona un producto.',
      // Backend: cantidad entera > 0 (`CreateInventoryMovementRequest`, @Positive).
      quantity: validateWholeNumber(quantity, {
        min: 1,
        requiredMessage: 'Ingresa la cantidad.',
        minMessage: 'La cantidad debe ser mayor a 0.',
      }),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void save.submit(() =>
      onSave({
        productId,
        type,
        quantity: Number(quantity),
        reason: reason.trim(),
        responsible: responsible.trim(),
      }),
    );
  };
  return (
    <AdminModal
      title="Registrar movimiento"
      eyebrow="MOVIMIENTO DE INVENTARIO"
      onClose={onClose}
      onSubmit={submit}
      submitting={save.submitting}
      error={save.error}
      submitLabel="Registrar"
    >
      <div className="rc-form-grid">
        <label className="hk-form-label">
          Producto *
          <select
            className={inputClass(errors.product)}
            value={productId}
            disabled={products.length === 0}
            onChange={(e) => {
              setProductId(Number(e.target.value));
              setErrors((current) => ({ ...current, product: undefined }));
            }}
            aria-required="true"
            {...fieldErrorProps('movement-product-error', errors.product)}
          >
            {products.length === 0 && <option value={0}>No hay productos en inventario</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <FieldError id="movement-product-error" error={errors.product} />
        </label>
        <label className="hk-form-label">
          Tipo
          <select
            className="hk-form-select"
            value={type}
            onChange={(e) => setType(e.target.value as 'Entrada' | 'Salida')}
          >
            <option value="Entrada">Entrada</option>
            <option value="Salida">Salida</option>
          </select>
        </label>
        <label className="hk-form-label">
          Cantidad *
          <input
            className={inputClass(errors.quantity)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={quantity}
            onChange={(e) => {
              if (!isWholeNumberInput(e.target.value)) return;
              setQuantity(e.target.value);
              setErrors((current) => ({ ...current, quantity: undefined }));
            }}
            aria-required="true"
            {...fieldErrorProps('movement-quantity-error', errors.quantity)}
          />
          <FieldError id="movement-quantity-error" error={errors.quantity} />
        </label>
        <label className="hk-form-label">
          Responsable
          <input
            className="hk-form-select"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
          />
        </label>
      </div>
      <label className="hk-form-label">
        Motivo
        <textarea
          className="hk-form-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. Compra mensual, reposición..."
        />
      </label>
    </AdminModal>
  );
}

/**
 * Apertura (saldo inicial) o cierre (efectivo contado) de la caja propia. Antes
 * la apertura reutilizaba el saldo de la sesión anterior y el cierre enviaba el
 * saldo esperado como contado, así que el arqueo nunca mostraba diferencias.
 */
export function CashSessionModal({
  mode,
  expectedCents,
  ownerLabel,
  onClose,
  onSave,
}: {
  mode: 'open' | 'close';
  expectedCents?: number;
  /** B9: cierre excepcional de la caja de otro usuario; exige motivo. */
  ownerLabel?: string;
  onClose: () => void;
  onSave: (amountCents: number, notes?: string, reason?: string) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [amountError, setAmountError] = useState<string | undefined>();
  const [reasonError, setReasonError] = useState<string | undefined>();
  const exceptional = mode === 'close' && ownerLabel !== undefined;
  const save = useAdminSubmit();
  const isOpening = mode === 'open';
  const countedCents = moneyInputToCents(amount);
  const difference =
    !isOpening && countedCents !== null && expectedCents !== undefined
      ? countedCents - expectedCents
      : null;
  const submit = () => {
    // Backend: saldo inicial y contado son enteros ≥ 0 (0 es válido).
    const error = validateMoneyAmount(amount, {
      allowZero: true,
      requiredMessage: isOpening ? 'Ingresa el saldo inicial.' : 'Ingresa el efectivo contado.',
    });
    setAmountError(error ?? undefined);
    const missingReason =
      exceptional && !reason.trim() ? 'Indica el motivo del cierre excepcional.' : undefined;
    setReasonError(missingReason);
    if (error || missingReason || countedCents === null) return;
    void save.submit(() =>
      onSave(countedCents, notes.trim() || undefined, exceptional ? reason.trim() : undefined),
    );
  };
  return (
    <AdminModal
      title={
        isOpening
          ? 'Abrir caja'
          : exceptional
            ? `Cierre excepcional · ${ownerLabel}`
            : 'Cerrar caja'
      }
      eyebrow="GESTIÓN DE CAJA"
      onClose={onClose}
      onSubmit={submit}
      submitting={save.submitting}
      error={save.error}
      submitLabel={isOpening ? 'Abrir caja' : 'Cerrar caja'}
      width={420}
    >
      {!isOpening && expectedCents !== undefined && (
        <p className="login-helper">
          Saldo esperado según el sistema: {formatCurrency(expectedCents, 'GTQ')}
        </p>
      )}
      <label className="hk-form-label">
        {isOpening ? 'Saldo inicial *' : 'Efectivo contado *'}
        <input
          className={inputClass(amountError)}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            const next = e.target.value.trim();
            if (!isMoneyInput(next)) return;
            setAmount(next);
            setAmountError(undefined);
          }}
          aria-required="true"
          {...fieldErrorProps('cash-session-amount-error', amountError)}
        />
        <FieldError id="cash-session-amount-error" error={amountError} />
      </label>
      {difference !== null && (
        <p className="login-helper" aria-live="polite">
          {difference === 0
            ? 'Sin diferencia.'
            : `${difference < 0 ? 'Faltante' : 'Sobrante'}: ${formatCurrency(Math.abs(difference), 'GTQ')}`}
        </p>
      )}
      {exceptional && (
        <label className="hk-form-label">
          Motivo del cierre excepcional *
          <textarea
            className={`hk-form-textarea${reasonError ? ' input-error' : ''}`}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(undefined);
            }}
            placeholder="Ej. el cajero terminó su turno sin cerrar"
            aria-required="true"
            {...fieldErrorProps('cash-session-reason-error', reasonError)}
          />
          <FieldError id="cash-session-reason-error" error={reasonError} />
        </label>
      )}
      <label className="hk-form-label">
        Notas (opcional)
        <textarea
          className="hk-form-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={isOpening ? 'Ej. fondo de caja del turno' : 'Ej. motivo de la diferencia'}
        />
      </label>
    </AdminModal>
  );
}

export function CashModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (m: {
    concept: string;
    type: 'Ingreso' | 'Egreso';
    amount: number;
    responsible: string;
  }) => void | Promise<void>;
}) {
  const [concept, setConcept] = useState('');
  const [type, setType] = useState<'Ingreso' | 'Egreso'>('Ingreso');
  const [amount, setAmount] = useState('');
  const [responsible, setResponsible] = useState('Edgar González');
  const [errors, setErrors] = useState<FieldErrors<'concept' | 'amount'>>({});
  const save = useAdminSubmit();
  const submit = () => {
    const nextErrors = compactErrors({
      // Backend: concepto obligatorio de hasta 255 y monto > 0 (`CreateCashMovementRequest`).
      concept: validateRequiredText(concept, 'Ingresa el concepto.', CASH_CONCEPT_MAX_LENGTH),
      amount: validateMoneyAmount(amount),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void save.submit(() =>
      onSave({
        concept: concept.trim(),
        type,
        amount: (moneyInputToCents(amount) ?? 0) / 100,
        responsible: responsible.trim(),
      }),
    );
  };
  return (
    <AdminModal
      title="Nuevo movimiento de caja"
      eyebrow="GESTIÓN DE CAJA"
      onClose={onClose}
      onSubmit={submit}
      submitting={save.submitting}
      error={save.error}
      submitLabel="Registrar"
    >
      <div className="rc-form-grid">
        <label className="hk-form-label">
          Concepto *
          <input
            className={inputClass(errors.concept)}
            value={concept}
            maxLength={CASH_CONCEPT_MAX_LENGTH}
            onChange={(e) => {
              setConcept(e.target.value);
              setErrors((current) => ({ ...current, concept: undefined }));
            }}
            placeholder="Ej. Pago de huésped"
            aria-required="true"
            {...fieldErrorProps('cash-concept-error', errors.concept)}
          />
          <FieldError id="cash-concept-error" error={errors.concept} />
        </label>
        <label className="hk-form-label">
          Tipo
          <select
            className="hk-form-select"
            value={type}
            onChange={(e) => setType(e.target.value as 'Ingreso' | 'Egreso')}
          >
            <option value="Ingreso">Ingreso</option>
            <option value="Egreso">Egreso</option>
          </select>
        </label>
        <label className="hk-form-label">
          Monto *
          <input
            className={inputClass(errors.amount)}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              const next = e.target.value.trim();
              if (!isMoneyInput(next)) return;
              setAmount(next);
              setErrors((current) => ({ ...current, amount: undefined }));
            }}
            aria-required="true"
            {...fieldErrorProps('cash-amount-error', errors.amount)}
          />
          <FieldError id="cash-amount-error" error={errors.amount} />
        </label>
        <label className="hk-form-label">
          Responsable
          <input
            className="hk-form-select"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
          />
        </label>
      </div>
    </AdminModal>
  );
}
