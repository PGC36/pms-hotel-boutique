/* eslint-disable @typescript-eslint/no-unused-vars -- Migracion controlada del prototipo Bolt; se conserva la logica original para portarla incrementalmente. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserFacingErrorMessage } from '@/services/http-client';
import {
  Activity,
  ArrowRight,
  Ban,
  Bell,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  DoorOpen,
  Dumbbell,
  Eye,
  FileText,
  Gauge,
  Gift,
  Headphones,
  Home,
  LogOut,
  LoaderCircle,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Package,
  Pencil,
  Percent,
  Plus,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  TriangleAlert,
  UserRound,
  Users,
  Utensils,
  Wallet,
  Waves,
  Wifi,
  X,
} from 'lucide-react';
import { ReceptionContent } from '@/modules/front-desk/components/workspace/ReceptionContent';
import { routePaths } from '@/app/routes';
import { GuestContent } from '@/modules/guest-portal/components/GuestContent';
import { RoomServiceContent } from '@/modules/room-service/components/RoomServiceContent';
import { AdminContent } from '@/modules/administration/components/AdminContent';
import {
  rolePermissionsFromBackendRoles,
  rolePermissionsFromSessionPermissions,
} from '@/modules/administration/utils/rolePermissions';
import { AccountPreferencesModal, AccountProfileModal } from '@/private/workspace/AccountPanels';
import { auditService } from '@/services/auditService';
import { authService } from '@/services/authService';
import { bookingService } from '@/services/bookingService';
import { cashService } from '@/services/cashService';
import { catalogService } from '@/services/catalogService';
import { guestAccountService } from '@/services/guestAccountService';
import { guestService } from '@/services/guestService';
import { inventoryService } from '@/services/inventoryService';
import {
  housekeepingService,
  type HousekeepingChecklist,
  type HousekeepingChecklistItem,
} from '@/services/housekeepingService';
import { orderService } from '@/services/orderService';
import { personnelService } from '@/services/personnelService';
import { roomService } from '@/services/roomService';
import { serviceRequestService } from '@/services/serviceRequestService';
import { HttpError } from '@/services/http-client';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { toDomainCalendarDate, toDtoCalendarDate } from '@/shared/types/common';
import { calculateNights } from '@/shared/utils/date';
import { exportDateSuffix, exportToCSV } from '@/shared/utils/exportCsv';
import type {
  OrderStatus as DomainOrderStatus,
  RoomHousekeepingStatus,
  ServiceRequestStatus,
} from '@/shared/constants/statuses';
import type { AuditLog } from '@/shared/types/entities/audit-log';
import type { Booking } from '@/shared/types/entities/booking';
import type { Charge } from '@/shared/types/entities/charge';
import type { Guest } from '@/shared/types/entities/guest';
import type { Order } from '@/shared/types/entities/order';
import type { Product } from '@/shared/types/entities/product';
import type { Room } from '@/shared/types/entities/room';
import type { RoomFeature } from '@/shared/types/entities/room-feature';
import type { RoomType as RoomTypeModel } from '@/shared/types/entities/room-type';
import type { ServiceRequest } from '@/shared/types/entities/service-request';

export type RoleId =
  'reception' | 'admin' | 'housekeeping' | 'room-service' | 'concierge' | 'guest';
type IconType = typeof Home;

type Role = {
  id: RoleId;
  name: string;
  person: string;
  initials: string;
  description: string;
  icon: IconType;
  color: string;
};

type NavChild = { label: string; nav: string; role: RoleId };
type NavItem = {
  label: string;
  icon: IconType;
  badge?: string;
  nav?: string;
  role?: RoleId;
  children?: NavChild[];
};
type NotificationItem = {
  title: string;
  detail: string;
  tone: 'warning' | 'info' | 'success';
  destination?: string;
};

type Task = {
  id: number;
  title: string;
  room: string;
  guest: string;
  time: string;
  status: string;
  tone: 'warning' | 'info' | 'success';
};

/** Etiqueta visible del turnover: dirty / cleaning / clean / inspected. */
type RoomStatus = 'Pendiente' | 'En proceso' | 'Completada' | 'Inspeccionada';
type CleaningRoom = {
  id: number;
  roomId: string;
  number: string;
  floor: string;
  type: string;
  cleaningType: string;
  priority: string;
  status: RoomStatus;
  /** Estado real de limpieza que devolvió el backend; independiente de `Room.status`. */
  housekeepingStatus: RoomHousekeepingStatus;
  startTime: string | null;
  endTime: string | null;
  duration: string | null;
  checklistId?: string;
  checklist: HousekeepingChecklistItem[];
};

export type GuestRequest = {
  id: number;
  requestId: string;
  room: string;
  request: string;
  time: string;
  priority: string;
  status: 'Pendiente' | 'En proceso' | 'Completada' | 'Rechazada';
  checklistId?: string;
  checklist?: HousekeepingChecklist;
};

export type HistoryEntry = {
  id: number;
  room: string;
  taskType: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: string;
  status: 'Completada';
};

export type DefectReport = {
  id: number;
  requestId?: string;
  roomId?: string;
  room: string;
  category: string;
  description: string;
  priority: string;
  observation: string;
};

export type OrderStatus =
  | 'Pendiente'
  | 'Aceptado'
  | 'En preparación'
  | 'Listo'
  | 'En camino'
  | 'Entregado'
  | 'Rechazado'
  | 'Cancelado';
export type RoomServiceOrder = {
  id: number;
  orderId: string;
  bookingId: string;
  room: string;
  guest: string;
  time: string;
  items: { name: string; quantity: number; price: number }[];
  status: OrderStatus;
  note: string;
  rejectionReason: string;
  charged: boolean;
  chargeId?: string;
};

export type ConciergeStatus =
  'Pendiente' | 'Aceptada' | 'En proceso' | 'Completada' | 'Rechazada' | 'Cancelada';
type ConciergeRequest = {
  id: number;
  requestId: string;
  bookingId: string;
  room: string;
  guest: string;
  time: string;
  requestedDate: string;
  updatedDate: string;
  category: string;
  description: string;
  priority: 'Alta' | 'Media' | 'Baja';
  status: ConciergeStatus;
  observation: string;
  rejectionReason: string;
  completedAt: string | null;
  /** Responsable según el backend (INT-11). */
  responsible: string;
};

export type ReservationStatus =
  'Pendiente' | 'Confirmada' | 'Check-in' | 'Check-out' | 'Cancelada' | 'Anulada';
export type RecRoomStatus = 'Disponible' | 'Ocupada' | 'Bloqueada' | 'Limpieza' | 'Mantenimiento';
export type RoomType = 'Estándar' | 'Deluxe' | 'Suite';
export type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia';

export type GuestInfo = {
  name: string;
  lastName: string;
  phone: string;
  email: string;
  docType: string;
  docNumber: string;
  birthDate: string;
  nationality: string;
};

export type Companion = {
  id: number;
  name: string;
  lastName: string;
  document: string;
  age: number;
};

export type FolioEntry = {
  id: number;
  concept: string;
  category: string;
  amount: number;
  date: string;
  type: 'Cargo' | 'Pago' | 'Depósito' | 'Anulación';
  status: 'Activo' | 'Anulado';
  method?: PaymentMethod;
  reference?: string;
  voidReason?: string;
};

export type Reservation = {
  id: number;
  bookingId?: string;
  roomTypeId?: string;
  code: string;
  /** Código que recepción entrega al huésped para entrar a su portal (INT-12). */
  guestLinkCode?: string;
  guest: GuestInfo;
  companions: Companion[];
  checkIn: string;
  checkOut: string;
  roomNumber: string;
  roomType: RoomType;
  rate: number;
  guestCount: number;
  status: ReservationStatus;
  origin: string;
  observations: string;
  folio: FolioEntry[];
  cancelReason: string;
  voidReason: string;
  checkInTime: string | null;
  checkOutTime: string | null;
};

export type RecRoom = {
  id: number;
  backendRoomId: string;
  roomTypeId: string;
  number: string;
  floor: string;
  type: RoomType;
  capacity: number;
  rate: number;
  status: RecRoomStatus;
  features: string[];
};

export type RoomBlock = {
  id: number;
  roomNumber: string;
  startDate: string;
  endDate: string;
  reason: string;
  observation: string;
  active: boolean;
};

const roles: Role[] = [
  {
    id: 'reception',
    name: 'Recepción',
    person: 'Chepe',
    initials: 'CH',
    description: 'Reservas, huéspedes y operación diaria',
    icon: Headphones,
    color: 'terracotta',
  },
  {
    id: 'admin',
    name: 'Administrador',
    person: 'Edgar',
    initials: 'EG',
    description: 'Control total del hotel y reportes',
    icon: ShieldCheck,
    color: 'gold',
  },
  {
    id: 'housekeeping',
    name: 'Limpieza',
    person: 'César',
    initials: 'CS',
    description: 'Habitaciones y tareas pendientes',
    icon: Sparkles,
    color: 'sage',
  },
  {
    id: 'room-service',
    name: 'Room service',
    person: 'Douglas',
    initials: 'DG',
    description: 'Pedidos y entregas en habitación',
    icon: Package,
    color: 'blue',
  },
  {
    id: 'concierge',
    name: 'Conserjería',
    person: 'Douglas',
    initials: 'DG',
    description: 'Solicitudes y atención al huésped',
    icon: MessageSquare,
    color: 'brown',
  },
  {
    id: 'guest',
    name: 'Huésped',
    person: 'Pablo',
    initials: 'PB',
    description: 'Reserva, estancia y servicios',
    icon: UserRound,
    color: 'cream',
  },
];

const parseDbId = (id: string, fallback: number) => {
  const value = Number(id.replace(/\D/g, ''));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const centsToAmount = (cents: number) => Math.round(cents / 100);
const formatGTQ = (amount: number) =>
  `Q${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDbTime = (value?: Date) => {
  if (!value) return '';
  return value.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getRoomTypeLabel = (roomTypeId: string | undefined, roomTypes: RoomTypeModel[]): RoomType => {
  const roomType = roomTypes.find((type) => type.id === roomTypeId);
  const name = roomType?.name.toLowerCase() ?? '';
  if (name.includes('suite')) return 'Suite';
  if (name.includes('deluxe')) return 'Deluxe';
  return 'Estándar';
};

const mapPaymentMethod = (method?: string): PaymentMethod => {
  if (method === 'creditCard' || method === 'debitCard') return 'Tarjeta';
  if (method === 'bankTransfer') return 'Transferencia';
  return 'Efectivo';
};

const mapReservationStatus = (status: Booking['status']): ReservationStatus => {
  const statuses: Record<Booking['status'], ReservationStatus> = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    checkedIn: 'Check-in',
    checkedOut: 'Check-out',
    cancelled: 'Cancelada',
    noShow: 'Anulada',
  };
  return statuses[status] ?? 'Pendiente';
};

const mapRecRoomStatus = (
  status: Room['status'],
  housekeepingStatus: Room['housekeepingStatus'],
): RecRoomStatus => {
  if (status === 'occupied') return 'Ocupada';
  if (status === 'maintenance' || status === 'outOfService') return 'Mantenimiento';
  if (housekeepingStatus === 'cleaning' || housekeepingStatus === 'dirty') return 'Limpieza';
  return 'Disponible';
};

const mapOrderStatus = (status: string): OrderStatus => {
  const statuses: Record<string, OrderStatus> = {
    pending: 'Pendiente',
    accepted: 'Aceptado',
    preparing: 'En preparación',
    ready: 'Listo',
    onTheWay: 'En camino',
    delivered: 'Entregado',
    rejected: 'Rechazado',
    cancelled: 'Cancelado',
  };
  return statuses[status] ?? 'Pendiente';
};

const toDomainOrderStatus = (status: OrderStatus): DomainOrderStatus => {
  const statuses: Record<OrderStatus, DomainOrderStatus> = {
    Pendiente: 'pending',
    Aceptado: 'accepted',
    'En preparación': 'preparing',
    Listo: 'ready',
    'En camino': 'onTheWay',
    Entregado: 'delivered',
    Rechazado: 'rejected',
    Cancelado: 'cancelled',
  };
  return statuses[status];
};

const toDomainConciergeStatus = (status: ConciergeStatus): ServiceRequestStatus => {
  const statuses: Record<ConciergeStatus, ServiceRequestStatus> = {
    Pendiente: 'pending',
    Aceptada: 'accepted',
    'En proceso': 'inProgress',
    Completada: 'completed',
    Rechazada: 'rejected',
    Cancelada: 'cancelled',
  };
  return statuses[status];
};

// Exhaustivo: `rejected` es terminal y no puede mostrarse como 'Pendiente', o la UI
// ofrecería "Atender" y el servicio rechazaría rejected -> accepted.
const mapServiceStatus = (status: ServiceRequestStatus): GuestRequest['status'] => {
  const statuses: Record<ServiceRequestStatus, GuestRequest['status']> = {
    pending: 'Pendiente',
    accepted: 'En proceso',
    inProgress: 'En proceso',
    completed: 'Completada',
    rejected: 'Rechazada',
    // Housekeeping todavía muestra un stayover cancelado como rechazado (D-013).
    cancelled: 'Rechazada',
  };
  return statuses[status];
};

/** Solicitud de limpieza que todavía requiere trabajo (mismo criterio que Conserjería). */
const isOpenGuestRequest = (request: GuestRequest) =>
  request.status === 'Pendiente' || request.status === 'En proceso';
const isGuestItemRequest = (request: GuestRequest) =>
  request.request.startsWith('Artículos solicitados:');

// --- Limpieza (INT-09) -------------------------------------------------------
// Habitaciones y tareas stayover salen de `housekeepingService` (backend). La UI
// solo traduce estados a etiquetas; las transiciones las valida el backend.

const DEFAULT_CLEANING_CHECKLIST = [
  'Cama preparada',
  'Baño limpio',
  'Toallas completas',
  'Amenidades repuestas',
  'Basura retirada',
  'Piso limpio',
];

const cleaningStatusLabels: Record<RoomHousekeepingStatus, RoomStatus> = {
  dirty: 'Pendiente',
  cleaning: 'En proceso',
  clean: 'Completada',
  inspected: 'Inspeccionada',
};

const isCleaningDone = (status: RoomStatus) =>
  status === 'Completada' || status === 'Inspeccionada';

const formatCleaningDuration = (startedAt?: Date, completedAt?: Date): string | null => {
  if (!startedAt || !completedAt) return null;
  const minutes = Math.round((completedAt.getTime() - startedAt.getTime()) / 60000);
  return minutes > 0 ? `${minutes} min` : null;
};

const toCleaningRoom = (
  room: Room,
  id: number,
  type: string,
  checklist?: HousekeepingChecklist,
): CleaningRoom => {
  const status = cleaningStatusLabels[room.housekeepingStatus];
  const done = isCleaningDone(status);
  // Tras un checkout la habitación vuelve a `dirty` conservando los tiempos del
  // ciclo anterior: solo se muestran mientras el ciclo actual los usa.
  const startedAt = status === 'Pendiente' ? undefined : room.cleaningStartedAt;
  const completedAt = done ? room.cleaningCompletedAt : undefined;
  return {
    id,
    roomId: room.id,
    number: room.roomNumber,
    floor: `Piso ${room.floor}`,
    type,
    cleaningType: 'Limpieza de salida',
    priority: room.housekeepingStatus === 'dirty' ? 'Alta' : 'Media',
    status,
    housekeepingStatus: room.housekeepingStatus,
    startTime: startedAt ? formatDbTime(startedAt) : null,
    endTime: completedAt ? formatDbTime(completedAt) : null,
    duration: formatCleaningDuration(startedAt, completedAt),
    checklistId: checklist?.id,
    checklist: checklist?.items ?? DEFAULT_CLEANING_CHECKLIST.map((label) => ({ label, done })),
  };
};

const toCleaningHistoryEntry = (
  id: number,
  room: string,
  taskType: string,
  startedAt: Date | undefined,
  completedAt: Date,
): HistoryEntry => ({
  id,
  room,
  taskType,
  date: toDtoCalendarDate(completedAt),
  startTime: startedAt ? formatDbTime(startedAt) : '—',
  endTime: formatDbTime(completedAt),
  duration: formatCleaningDuration(startedAt, completedAt) ?? '—',
  status: 'Completada',
});

const toStayoverRequest = (
  request: ServiceRequest,
  id: number,
  room: string,
  checklist?: HousekeepingChecklist,
): GuestRequest => ({
  id,
  requestId: request.id,
  room,
  request: request.description,
  time: formatDbTime(request.requestedAt),
  priority: 'Media',
  status: mapServiceStatus(request.status),
  checklistId: checklist?.id,
  checklist,
});

type HousekeepingData = {
  rooms: Room[];
  stayovers: ServiceRequest[];
  checklists: HousekeepingChecklist[];
};

async function fetchHousekeepingData(): Promise<HousekeepingData> {
  const [rooms, stayovers, checklists] = await Promise.all([
    safeList(() => housekeepingService.getRooms()),
    safeList(() => housekeepingService.getStayoverCleanings()),
    safeList(() => housekeepingService.getChecklists()),
  ]);
  return { rooms, stayovers, checklists };
}

/**
 * Historial = último turnover completado de cada habitación + tareas stayover
 * completadas. El backend no guarda un historial de turnovers anteriores.
 */
function buildHousekeepingState(
  { rooms, stayovers, checklists }: HousekeepingData,
  getRoomType: (room: Room) => string,
): Pick<WorkspaceState, 'cleaningRooms' | 'guestRequests' | 'history'> {
  const roomNumberById = new Map(rooms.map((room) => [room.id, room.roomNumber]));
  const roomLabel = (roomId: string) => roomNumberById.get(roomId) ?? 'Sin habitación';
  const checklistByRequestId = new Map(
    checklists.map((checklist) => [checklist.serviceRequestId, checklist]),
  );

  const turnoverChecklists = checklists
    .filter((checklist) => !checklist.serviceRequestId && checklist.roomId)
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const cleaningRooms = rooms.map((room, index) => {
    const currentChecklist = turnoverChecklists.find((checklist) => checklist.roomId === room.id);
    const checklist =
      room.housekeepingStatus === 'cleaning' ||
      room.housekeepingStatus === 'clean' ||
      room.housekeepingStatus === 'inspected'
        ? currentChecklist
        : undefined;
    return toCleaningRoom(room, index + 1, getRoomType(room), checklist);
  });

  const guestRequests = stayovers.map((request, index) =>
    toStayoverRequest(
      request,
      index + 1,
      roomLabel(request.roomId),
      checklistByRequestId.get(request.id),
    ),
  );

  const completions = [
    ...rooms
      .filter((room) => room.cleaningCompletedAt)
      .map((room) => ({
        room: room.roomNumber,
        taskType: 'Limpieza de salida',
        startedAt: room.cleaningStartedAt,
        completedAt: room.cleaningCompletedAt as Date,
      })),
    ...stayovers
      .filter((request) => request.status === 'completed' && request.completedAt)
      .map((request) => ({
        room: roomLabel(request.roomId),
        taskType: `Limpieza de estancia: ${request.description}`,
        startedAt: request.startedAt,
        completedAt: request.completedAt as Date,
      })),
  ].sort((left, right) => right.completedAt.getTime() - left.completedAt.getTime());

  const history = completions.map((entry, index) =>
    toCleaningHistoryEntry(
      index + 1,
      entry.room,
      entry.taskType,
      entry.startedAt,
      entry.completedAt,
    ),
  );

  return { cleaningRooms, guestRequests, history };
}

const scopedNav = (role: RoleId, label: string) => `${role}:${label}`;

const roleAccessKey = (groupName: string, item: string) =>
  `${groupName.toLocaleUpperCase('es-GT')}::${item}`;

const navChild = (role: RoleId, label: string): NavChild => ({
  label,
  nav: scopedNav(role, label),
  role,
});

type WorkspaceState = {
  tasks: Task[];
  cleaningRooms: CleaningRoom[];
  guestRequests: GuestRequest[];
  history: HistoryEntry[];
  defects: DefectReport[];
  roomServiceOrders: RoomServiceOrder[];
  conciergeRequests: ConciergeRequest[];
  recRooms: RecRoom[];
  recRoomTypeOptions: RoomType[];
  recReservations: Reservation[];
  recRoomBlocks: RoomBlock[];
  recentActivity: { time: string; text: string; tone: string }[];
};

// --- Room Service (INT-10) ---------------------------------------------------
// Pedidos de `orderService` (backend). Habitación, huésped y producto vienen en
// la respuesta; los catálogos locales solo cubren datos que el backend no envíe.

const toRoomServiceOrder = (
  order: Order,
  id: number,
  lookup: { rooms?: Room[]; guests?: Guest[]; products?: Product[] } = {},
): RoomServiceOrder => {
  const room = lookup.rooms?.find((item) => item.id === order.roomId);
  const guest = lookup.guests?.find((item) => item.id === order.guestId);
  const isClosedWithReason = order.status === 'rejected' || order.status === 'cancelled';
  return {
    id,
    orderId: order.id,
    bookingId: order.bookingId,
    room: order.roomNumber ?? room?.roomNumber ?? 'Sin habitación',
    guest: order.guestName ?? (guest ? `${guest.firstName} ${guest.lastName}` : 'Huésped'),
    time: formatDbTime(order.requestedAt),
    items: order.items.map((item) => ({
      name:
        item.productName ??
        lookup.products?.find((product) => product.id === item.productId)?.name ??
        item.productId,
      quantity: item.quantity,
      price: centsToAmount(item.unitPriceCents),
    })),
    status: mapOrderStatus(order.status),
    // En un pedido rechazado o cancelado las notas son el motivo: se muestran una sola vez.
    note: isClosedWithReason ? '' : (order.notes ?? ''),
    rejectionReason: isClosedWithReason ? (order.notes ?? '') : '',
    charged: Boolean(order.chargeId),
    chargeId: order.chargeId,
  };
};

// --- Conserjería (INT-11) ----------------------------------------------------
// Solicitudes de `serviceRequestService.getConciergeRequests` (backend). La UI
// solo traduce estados; las transiciones las valida el backend.

/** Roles con `concierge.read` en el backend. */
const CONCIERGE_READ_ROLES: readonly RoleId[] = ['admin', 'concierge'];

const CLOSED_CONCIERGE_STATUSES: readonly ConciergeStatus[] = [
  'Completada',
  'Rechazada',
  'Cancelada',
];
const isClosedConcierge = (status: ConciergeStatus) => CLOSED_CONCIERGE_STATUSES.includes(status);

const conciergeStatusLabels: Record<ServiceRequestStatus, ConciergeStatus> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  inProgress: 'En proceso',
  completed: 'Completada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

const toConciergeRequest = (
  request: ServiceRequest,
  id: number,
  lookup: { rooms?: Room[]; guests?: Guest[] } = {},
): ConciergeRequest => {
  const room = lookup.rooms?.find((item) => item.id === request.roomId);
  const guest = lookup.guests?.find((item) => item.id === request.guestId);
  const status = conciergeStatusLabels[request.status];
  const closedWithReason = status === 'Rechazada' || status === 'Cancelada';
  return {
    id,
    requestId: request.id,
    bookingId: request.bookingId,
    room: request.roomNumber ?? room?.roomNumber ?? 'Sin habitación',
    guest: request.guestName ?? (guest ? `${guest.firstName} ${guest.lastName}` : 'Huésped'),
    time: formatDbTime(request.requestedAt),
    requestedDate: toDtoCalendarDate(request.requestedAt),
    updatedDate: toDtoCalendarDate(request.updatedAt),
    category: 'Conserjería',
    description: request.description,
    priority: request.status === 'pending' ? 'Alta' : 'Media',
    status,
    // El backend agrega el motivo a las notas: en una solicitud cerrada se muestran como motivo.
    observation: closedWithReason ? '' : (request.notes ?? ''),
    rejectionReason: closedWithReason ? (request.notes ?? '') : '',
    completedAt: request.status === 'completed' ? formatDbTime(request.updatedAt) : null,
    responsible: request.responsibleUserName ?? 'Sin asignar',
  };
};

/**
 * Roles con `room-service.read` en el backend. Pedir catálogo o pedidos con
 * otro rol (Limpieza, Conserjería) responde 403 y tumbaría la carga del panel.
 */
const ROOM_SERVICE_READ_ROLES: readonly RoleId[] = ['admin', 'room-service'];
const ROOM_READ_ROLES: readonly RoleId[] = ['admin', 'reception', 'housekeeping'];
const ROOM_CATALOG_READ_ROLES: readonly RoleId[] = ['admin'];
const BOOKING_READ_ROLES: readonly RoleId[] = ['admin', 'reception'];
const GUEST_READ_ROLES: readonly RoleId[] = ['admin', 'reception'];
/**
 * `service-requests.read`: Conserjería también lo tiene, pero el backend solo le
 * devuelve solicitudes de conserjería, que ya carga desde `/concierge/requests`.
 */
const SERVICE_REQUEST_READ_ROLES: readonly RoleId[] = ['admin', 'housekeeping'];
/** `folios.read`, `charges.read`, `payments.read` y `deposits.read`. */
const FINANCE_READ_ROLES: readonly RoleId[] = ['admin'];

async function safeList<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

async function permissionAwareList<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (error) {
    // Role permissions can be customized per hotel. A denied optional dataset
    // must not prevent the rest of the employee workspace from loading.
    if (error instanceof HttpError && error.status === 403) return [];
    // Some services translate 403s into a localized Error before returning it.
    if (error instanceof Error) {
      const message = error.message.trim();
      if (
        message === 'Forbidden' ||
        /^HTTP 403\b/i.test(message) ||
        message.startsWith('No tienes permisos para operar ')
      ) {
        return [];
      }
    }
    throw error;
  }
}

async function loadWorkspaceData(role: RoleId): Promise<WorkspaceState> {
  const canReadRooms = ROOM_READ_ROLES.includes(role);
  const canReadRoomCatalog = ROOM_CATALOG_READ_ROLES.includes(role);
  const canReadBookings = BOOKING_READ_ROLES.includes(role);
  const canReadGuests = GUEST_READ_ROLES.includes(role);
  const canReadServiceRequests = SERVICE_REQUEST_READ_ROLES.includes(role);
  const canReadFinance = FINANCE_READ_ROLES.includes(role);
  const [
    rooms,
    roomTypes,
    roomFeatures,
    bookings,
    guests,
    products,
    orders,
    serviceRequests,
    auditLogs,
    charges,
    payments,
    deposits,
    housekeepingData,
    conciergeData,
  ] = await Promise.all([
    // Limpieza obtiene las habitaciones desde housekeeping; evita depender de
    // `rooms.read` en perfiles personalizados con acceso solo al módulo.
    canReadRooms && role !== 'housekeeping'
      ? permissionAwareList(() => roomService.getRooms())
      : [],
    canReadRoomCatalog ? permissionAwareList(() => roomService.getRoomTypes()) : [],
    canReadRoomCatalog ? permissionAwareList(() => roomService.getRoomFeatures()) : [],
    canReadBookings ? permissionAwareList(() => bookingService.getBookings()) : [],
    canReadGuests ? permissionAwareList(() => guestService.getGuests()) : [],
    ROOM_SERVICE_READ_ROLES.includes(role)
      ? permissionAwareList(() => catalogService.getProducts())
      : [],
    ROOM_SERVICE_READ_ROLES.includes(role)
      ? permissionAwareList(() => orderService.getOrders())
      : [],
    canReadServiceRequests
      ? role === 'housekeeping'
        ? safeList(() => serviceRequestService.getRequests())
        : permissionAwareList(() => serviceRequestService.getRequests())
      : [],
    role === 'admin' ? safeList(() => auditService.getLogs()) : [],
    canReadFinance ? permissionAwareList(() => guestAccountService.getCharges()) : [],
    canReadFinance ? permissionAwareList(() => guestAccountService.getPayments()) : [],
    canReadFinance ? permissionAwareList(() => guestAccountService.getDeposits()) : [],
    // Solo el rol de Limpieza tiene `housekeeping.read` en el backend.
    role === 'housekeeping' ? fetchHousekeepingData() : null,
    CONCIERGE_READ_ROLES.includes(role)
      ? permissionAwareList(() => serviceRequestService.getConciergeRequests())
      : [],
  ]);

  const recRooms: RecRoom[] = rooms.map((room, index) => {
    const roomType = roomTypes.find((type) => type.id === room.roomTypeId);
    const features = (roomType?.roomFeatureIds ?? [])
      .map((featureId) => roomFeatures.find((feature) => feature.id === featureId)?.name)
      .filter((name): name is string => Boolean(name));
    const sampleBooking = bookings.find((booking) => booking.roomTypeId === room.roomTypeId);
    const nights = sampleBooking
      ? Math.max(1, calculateNights(sampleBooking.checkIn, sampleBooking.checkOut))
      : 1;

    return {
      id: index + 1,
      backendRoomId: room.id,
      roomTypeId: room.roomTypeId,
      number: room.roomNumber,
      floor: `Piso ${room.floor}`,
      type: getRoomTypeLabel(room.roomTypeId, roomTypes),
      capacity: roomType?.capacity ?? 2,
      rate: sampleBooking ? centsToAmount(sampleBooking.totalAmountCents) / nights : 1850,
      status: mapRecRoomStatus(room.status, room.housekeepingStatus),
      features: features.length > 0 ? features : ['Wi-Fi', 'Desayuno'],
    };
  });

  const recRoomTypeOptions: RoomType[] = Array.from(
    new Set(roomTypes.map((roomType) => getRoomTypeLabel(roomType.id, roomTypes))),
  );

  const recReservations: Reservation[] = bookings.map((booking, index) => {
    const guest = guests.find((item) => item.id === booking.guestId);
    const room = rooms.find((item) => item.id === booking.roomId);
    const nights = Math.max(1, calculateNights(booking.checkIn, booking.checkOut));
    const status = mapReservationStatus(booking.status);
    const bookingCharges = charges.filter((charge) => charge.bookingId === booking.id);
    const bookingPayments = payments.filter((payment) => payment.bookingId === booking.id);
    const bookingDeposits = deposits.filter((deposit) => deposit.bookingId === booking.id);
    const folio: FolioEntry[] = [
      ...bookingCharges.map((charge, chargeIndex): FolioEntry => ({
        id: parseDbId(charge.id, chargeIndex + 1),
        concept: charge.description,
        category: 'Cargo',
        amount: centsToAmount(charge.amountCents),
        date: toDtoCalendarDate(charge.chargedAt),
        type: 'Cargo',
        status: charge.status === 'voided' ? 'Anulado' : 'Activo',
        voidReason: charge.voidReason ?? '',
      })),
      ...bookingPayments.map((payment, paymentIndex): FolioEntry => ({
        id: parseDbId(payment.id, 4000 + paymentIndex),
        concept: 'Pago registrado',
        category: 'Pago',
        amount: centsToAmount(payment.amountCents),
        date: toDtoCalendarDate(payment.paidAt ?? payment.createdAt),
        type: 'Pago',
        status: payment.status === 'refunded' || payment.status === 'failed' ? 'Anulado' : 'Activo',
        method: mapPaymentMethod(payment.method),
        reference: payment.transactionReference,
      })),
      ...bookingDeposits.map((deposit, depositIndex): FolioEntry => ({
        id: parseDbId(deposit.id, 6000 + depositIndex),
        concept: 'Depósito garantía',
        category: 'Depósito',
        amount: centsToAmount(deposit.amountCents),
        date: toDtoCalendarDate(deposit.collectedAt),
        type: 'Depósito',
        status: deposit.status === 'refunded' ? 'Anulado' : 'Activo',
        method: mapPaymentMethod(deposit.method),
        reference: deposit.id,
      })),
    ];

    return {
      id: index + 1,
      bookingId: booking.id,
      roomTypeId: booking.roomTypeId,
      code: booking.confirmationCode,
      guestLinkCode: booking.guestLinkCode,
      checkIn: toDtoCalendarDate(booking.checkIn),
      checkOut: toDtoCalendarDate(booking.checkOut),
      roomNumber: room?.roomNumber ?? 'Sin asignar',
      roomType: getRoomTypeLabel(booking.roomTypeId, roomTypes),
      rate: centsToAmount(booking.totalAmountCents) / nights,
      guestCount: booking.adults + booking.children,
      status,
      origin: 'Online',
      observations: booking.notes ?? '',
      checkInTime:
        status === 'Check-in' || status === 'Check-out' ? formatDbTime(booking.updatedAt) : null,
      checkOutTime: status === 'Check-out' ? formatDbTime(booking.updatedAt) : null,
      cancelReason:
        status === 'Cancelada'
          ? (booking.cancellationReason ?? 'Cancelación registrada en sistema')
          : '',
      voidReason: status === 'Anulada' ? (booking.notes ?? 'Reserva anulada en sistema') : '',
      guest: {
        name: guest?.firstName ?? 'Huésped',
        lastName: guest?.lastName ?? '',
        phone: guest?.phone ?? '',
        email: guest?.email ?? '',
        docType: guest?.documentType ?? 'DPI',
        docNumber: guest?.documentNumber ?? '',
        birthDate: '',
        nationality: guest?.nationality ?? '',
      },
      companions: [],
      folio,
    };
  });

  const recRoomBlocks: RoomBlock[] = rooms
    .filter((room) => room.status === 'maintenance' || room.status === 'outOfService')
    .map((room, index) => ({
      id: index + 1,
      roomNumber: room.roomNumber,
      startDate: toDtoCalendarDate(room.updatedAt),
      endDate: toDtoCalendarDate(room.updatedAt),
      reason: room.status === 'maintenance' ? 'Mantenimiento' : 'Fuera de servicio',
      observation: room.notes ?? 'Bloqueo registrado en inventario',
      active: true,
    }));

  const roomServiceOrders = orders.map((order, index) =>
    toRoomServiceOrder(order, index + 1, { rooms, guests, products }),
  );

  const { cleaningRooms, guestRequests, history } = housekeepingData
    ? buildHousekeepingState(housekeepingData, (room) =>
        getRoomTypeLabel(room.roomTypeId, roomTypes),
      )
    : { cleaningRooms: [], guestRequests: [], history: [] };

  const defects: DefectReport[] = serviceRequests
    .filter((request) => request.type === 'maintenance')
    .map((request, index) => {
      const room = rooms.find((item) => item.id === request.roomId);
      return {
        id: parseDbId(request.id, index + 1),
        requestId: request.id,
        roomId: request.roomId,
        room: request.roomNumber ?? room?.roomNumber ?? 'Sin habitación',
        category: 'Mantenimiento',
        description: request.description,
        priority: request.status === 'pending' ? 'Alta' : 'Media',
        observation: request.notes ?? '',
      };
    });

  const conciergeRequests = conciergeData.map((request, index) =>
    toConciergeRequest(request, index + 1, { rooms, guests }),
  );

  const tasks: Task[] = [...serviceRequests.slice(0, 3), ...orders.slice(0, 2)].map(
    (item, index) => {
      const isOrder = 'items' in item;
      const room = rooms.find((roomItem) => roomItem.id === item.roomId);
      const guest = guests.find((guestItem) => guestItem.id === item.guestId);
      return {
        id: index + 1,
        title: isOrder ? 'Pedido de Room Service' : item.description,
        room: `${room?.roomNumber ?? 'Sin habitación'} · ${getRoomTypeLabel(room?.roomTypeId, roomTypes)}`,
        guest: guest ? `${guest.firstName} ${guest.lastName}` : 'Huésped',
        time: formatDbTime(item.requestedAt),
        status: isOrder ? mapOrderStatus(item.status) : mapServiceStatus(item.status),
        tone:
          item.status === 'pending'
            ? 'warning'
            : item.status === 'completed' || item.status === 'delivered'
              ? 'success'
              : 'info',
      };
    },
  );

  const recentActivity = [...auditLogs]
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
    .slice(0, 4)
    .map((entry: AuditLog) => ({
      time: formatDbTime(entry.occurredAt),
      text: `${entry.module} · ${entry.action} · ${entry.entityType} ${entry.entityId}`,
      tone:
        entry.action === 'delete' || entry.action === 'void' || entry.action === 'close'
          ? 'terracotta'
          : 'success',
    }));

  return {
    tasks,
    cleaningRooms,
    guestRequests,
    history,
    defects,
    roomServiceOrders,
    conciergeRequests,
    recRooms,
    recRoomTypeOptions,
    recReservations,
    recRoomBlocks,
    recentActivity,
  };
}

function loadWorkspaceDataWithTimeout(role: RoleId, timeoutMs: number): Promise<WorkspaceState> {
  let timeoutId: number | undefined;
  return Promise.race([
    loadWorkspaceData(role),
    new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(
        () =>
          reject(
            new Error('La carga tardó demasiado. Comprueba tu conexión e inténtalo de nuevo.'),
          ),
        timeoutMs,
      );
    }),
  ]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  });
}

const navByRole: Record<RoleId, NavItem[]> = {
  reception: [
    { label: 'Resumen', icon: Gauge },
    { label: 'Calendario', icon: CalendarDays },
    { label: 'Reservas', icon: ClipboardList },
    { label: 'Huéspedes', icon: Users },
    { label: 'Disponibilidad', icon: BedDouble },
    { label: 'Habitaciones', icon: DoorOpen },
    { label: 'Caja', icon: Wallet },
  ],
  admin: [
    {
      label: 'Administración',
      icon: ShieldCheck,
      children: [
        navChild('admin', 'Dashboard'),
        navChild('admin', 'Gestión de usuarios'),
        navChild('admin', 'Roles y permisos'),
        navChild('admin', 'Gestión de habitaciones'),
        navChild('admin', 'Tipos de habitación'),
        navChild('admin', 'Tarifas por temporada'),
        navChild('admin', 'Promociones'),
        navChild('admin', 'Amenidades'),
        navChild('admin', 'Catálogo de Limpieza'),
        navChild('admin', 'Catálogo de Conserjería'),
        navChild('admin', 'Catálogo de Room Service'),
        navChild('admin', 'Resumen operativo'),
        navChild('admin', 'Reportes financieros'),
        navChild('admin', 'Gestión de inventario'),
        navChild('admin', 'Movimientos de inventario'),
        navChild('admin', 'Caja'),
        navChild('admin', 'Auditoría'),
      ],
    },
    {
      label: 'Recepción',
      icon: Headphones,
      children: [
        navChild('reception', 'Resumen'),
        navChild('reception', 'Calendario'),
        navChild('reception', 'Reservas'),
        navChild('reception', 'Huéspedes'),
        navChild('reception', 'Disponibilidad'),
        navChild('reception', 'Habitaciones'),
        navChild('reception', 'Caja'),
      ],
    },
    {
      label: 'Limpieza',
      icon: Sparkles,
      children: [
        navChild('housekeeping', 'Inicio'),
        navChild('housekeeping', 'Habitaciones'),
        navChild('housekeeping', 'Solicitudes'),
        navChild('housekeeping', 'Historial'),
      ],
    },
    {
      label: 'Room Service',
      icon: Package,
      children: [
        navChild('room-service', 'Pedidos activos'),
        navChild('room-service', 'Menú'),
        navChild('room-service', 'Historial'),
        navChild('room-service', 'Inventario'),
      ],
    },
    {
      label: 'Conserjería',
      icon: MessageSquare,
      children: [
        navChild('concierge', 'Solicitudes'),
        navChild('concierge', 'Por habitación'),
        navChild('concierge', 'Historial'),
      ],
    },
    {
      label: 'Huésped',
      icon: UserRound,
      children: [
        navChild('guest', 'Inicio'),
        navChild('guest', 'Mis reservas'),
        navChild('guest', 'Mi estancia'),
        navChild('guest', 'Amenidades'),
        navChild('guest', 'Conserjería'),
        navChild('guest', 'Limpieza y artículos'),
        navChild('guest', 'Room service'),
        navChild('guest', 'Mis solicitudes y pedidos'),
        navChild('guest', 'Notificaciones'),
      ],
    },
  ],
  housekeeping: [
    { label: 'Inicio', icon: Gauge },
    { label: 'Habitaciones', icon: BedDouble },
    { label: 'Solicitudes', icon: ClipboardList },
    { label: 'Historial', icon: FileText },
  ],
  'room-service': [
    { label: 'Pedidos activos', icon: Gauge },
    { label: 'Menú', icon: ClipboardList },
    { label: 'Historial', icon: FileText },
    { label: 'Inventario', icon: Package },
  ],
  concierge: [
    { label: 'Solicitudes', icon: ClipboardList },
    { label: 'Por habitación', icon: BedDouble },
    { label: 'Historial', icon: FileText },
  ],
  guest: [
    { label: 'Inicio', icon: Home },
    { label: 'Mis reservas', icon: CalendarDays },
    { label: 'Mi estancia', icon: BedDouble },
    { label: 'Amenidades', icon: Sparkles },
    { label: 'Conserjería', icon: MessageSquare },
    { label: 'Limpieza y artículos', icon: ClipboardList },
    { label: 'Room service', icon: Package },
    { label: 'Mis solicitudes y pedidos', icon: FileText },
    { label: 'Notificaciones', icon: Bell },
  ],
};

// Pestaña única donde se muestran los KPI de cada rol; el resto no los repite (#85).
const groupRoleBySidebarLabel: Record<string, string> = {
  Administración: 'admin',
  Recepción: 'reception',
  Limpieza: 'housekeeping',
  'Room Service': 'roomService',
  Conserjería: 'concierge',
  Huésped: 'guest',
};

const adminPermissionBySidebarLabel: Record<string, string> = {
  Dashboard: 'Dashboard',
  'Gestión de usuarios': 'Usuarios y roles',
  'Roles y permisos': 'Usuarios y roles',
  'Gestión de habitaciones': 'Habitaciones',
  'Tipos de habitación': 'Habitaciones',
  'Tarifas por temporada': 'Tarifas',
  Promociones: 'Promociones',
  Amenidades: 'Servicios',
  'Catálogo de Limpieza': 'Servicios',
  'Catálogo de Conserjería': 'Servicios',
  'Catálogo de Room Service': 'Servicios',
  'Resumen operativo': 'Reportes',
  'Reportes financieros': 'Reportes',
  'Gestión de inventario': 'Inventario',
  'Movimientos de inventario': 'Inventario',
  Caja: 'Caja',
  Auditoría: 'Auditoría',
};
const navPermissionKeys = (groupLabel: string, childLabel: string) => {
  const keys = [roleAccessKey(groupLabel, childLabel)];
  if (groupRoleBySidebarLabel[groupLabel] === 'admin') {
    const adminPermission = adminPermissionBySidebarLabel[childLabel];
    if (adminPermission) keys.push(roleAccessKey(groupLabel, adminPermission));
  }
  return keys;
};

const defaultRolePermissions = Object.fromEntries(
  Object.entries(groupRoleBySidebarLabel).map(([groupName, roleCode]) => [
    roleCode,
    Object.fromEntries(
      navByRole.admin.flatMap((group) =>
        (group.children ?? []).map((child) => [
          roleAccessKey(group.label, child.label),
          roleCode === 'admin' || groupRoleBySidebarLabel[group.label] === roleCode,
        ]),
      ),
    ) as Record<string, boolean>,
  ]),
) as Record<string, Record<string, boolean>>;

const filterNavByPermissions = (nav: NavItem[], permissions: Record<string, boolean>) => {
  if (Object.keys(permissions).length === 0) return nav;
  return nav
    .map((item) => {
      if (!item.children) return item;
      const children = item.children.filter((child) =>
        navPermissionKeys(item.label, child.label).some((key) => permissions[key]),
      );
      return children.length > 0 ? { ...item, children } : null;
    })
    .filter((item): item is NavItem => Boolean(item));
};

const flattenPermittedNav = (nav: NavItem[]): NavItem[] =>
  nav.flatMap((item) =>
    item.children
      ? item.children.map((child) => ({
          label: child.label,
          nav: child.nav,
          role: child.role,
          icon: item.icon,
        }))
      : [item],
  );

const firstNavValue = (nav: NavItem[]) => {
  const first = nav[0];
  return first?.children?.[0]?.nav ?? first?.nav ?? first?.label ?? 'Dashboard';
};

const summaryNavByRole: Record<RoleId, string> = {
  reception: 'Resumen',
  admin: 'Dashboard',
  housekeeping: 'Inicio',
  'room-service': 'Pedidos activos',
  concierge: 'Solicitudes',
  guest: 'Inicio',
};

type PrivateWorkspaceProps = {
  role: RoleId;
  initialNav?: string;
  sessionName?: string;
  sessionEmail?: string;
  sessionUserId?: string;
  sessionRoleLabel?: string;
  onLogout?: () => void;
};

function getInitialNav(role: RoleId, initialNav?: string) {
  if (initialNav) {
    const adminLegacyNav: Record<string, string> = {
      'Usuarios y roles': scopedNav('admin', 'Gestión de usuarios'),
      Habitaciones: scopedNav('admin', 'Gestión de habitaciones'),
      Tarifas: scopedNav('admin', 'Tarifas por temporada'),
      Servicios: scopedNav('admin', 'Amenidades'),
      Reportes: scopedNav('admin', 'Resumen operativo'),
      Inventario: scopedNav('admin', 'Gestión de inventario'),
    };
    if (role === 'admin' && adminLegacyNav[initialNav]) return adminLegacyNav[initialNav];
    const directItem = navByRole[role].find((item) => item.label === initialNav);
    if (directItem?.children?.length) return directItem.children[0].nav;
    if (directItem) return directItem.nav ?? initialNav;
    const childItem = navByRole[role]
      .flatMap((item) => item.children ?? [])
      .find((child) => child.nav === initialNav || child.label === initialNav);
    if (childItem) return childItem.nav;
  }
  if (role === 'admin') return scopedNav('admin', 'Dashboard');
  if (role === 'guest') return 'Inicio';
  if (role === 'housekeeping') return 'Inicio';
  if (role === 'concierge') return 'Solicitudes';
  if (role === 'reception') return 'Resumen';
  return navByRole[role][0].label;
}

function getDefaultExpandedNav(role: RoleId, activeNav: string) {
  const groupedItems = navByRole[role].filter((item) => item.children?.length);
  if (role === 'admin') return groupedItems.map((item) => item.label);
  return groupedItems
    .filter(
      (item) =>
        (item.nav ?? item.label) === activeNav ||
        item.children?.some((child) => child.nav === activeNav),
    )
    .map((item) => item.label);
}

function resolveWorkspaceNav(role: RoleId, activeNav: string, navItems = navByRole[role]) {
  const directItem = navItems.find((item) => (item.nav ?? item.label) === activeNav);
  if (directItem) {
    return {
      role: directItem.role ?? role,
      nav: directItem.role ? directItem.label : (directItem.nav ?? directItem.label),
      label: directItem.label,
    };
  }

  for (const item of navItems) {
    const child = item.children?.find((entry) => entry.nav === activeNav);
    if (child) return { role: child.role, nav: child.label, label: child.label };
  }

  const scopedMatch = activeNav.match(
    /^(admin|reception|housekeeping|room-service|concierge|guest):(.+)$/,
  );
  if (scopedMatch) {
    return {
      role: scopedMatch[1] as RoleId,
      nav: scopedMatch[2],
      label: scopedMatch[2],
    };
  }

  return { role, nav: activeNav, label: activeNav };
}

function getErrorMessage(cause: unknown): string {
  return getUserFacingErrorMessage(cause, 'No fue posible cargar el panel privado.');
}

type LoaderState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | ({ status: 'ready'; sessionPermissions: string[] | null } & WorkspaceState);

const toRolePermissionCode = (role: RoleId) => (role === 'room-service' ? 'roomService' : role);

/**
 * Permisos reales del empleado (`GET /auth/permissions`). El workspace operativo
 * no se muestra hasta tenerlos: sin ellos no hay fallback por grupo que ofrezca
 * secciones que el backend negaría (p. ej. Inventario sin inventory.read).
 */
async function loadSessionPermissions(role: RoleId): Promise<string[]> {
  let permissionKeys: string[];
  try {
    permissionKeys = await authService.getPermissions();
  } catch {
    throw new Error('No pudimos verificar los permisos de tu usuario. Intenta de nuevo.');
  }
  const sections = rolePermissionsFromSessionPermissions(
    toRolePermissionCode(role),
    permissionKeys,
  );
  if (!Object.values(sections).some(Boolean)) {
    throw new Error(
      'Tu usuario no tiene secciones asignadas en este panel. Solicita acceso a Administración.',
    );
  }
  return permissionKeys;
}

/**
 * `admin` y `guest` renderizan `AdminContent`/`GuestContent`, que hacen su
 * propia carga async independiente y nunca leen `initialData` — traer los
 * datos compartidos aquí para esos dos roles sería una segunda ronda de
 * latencia simulada en serie, sin ningún consumidor. Se salta el loader
 * para esos roles y se les pasa este estado vacío en su lugar.
 */
const EMPTY_WORKSPACE_DATA: WorkspaceState = {
  tasks: [],
  cleaningRooms: [],
  guestRequests: [],
  history: [],
  defects: [],
  roomServiceOrders: [],
  conciergeRequests: [],
  recRooms: [],
  recRoomTypeOptions: [],
  recReservations: [],
  recRoomBlocks: [],
  recentActivity: [],
};

export function PrivateWorkspace(props: PrivateWorkspaceProps) {
  const role = props.role;
  const skipLoad = role === 'admin' || role === 'guest';
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [screen, setScreen] = useState<LoaderState>(
    skipLoad
      ? { status: 'ready', sessionPermissions: null, ...EMPTY_WORKSPACE_DATA }
      : { status: 'loading' },
  );

  useEffect(() => {
    if (skipLoad) {
      setScreen({ status: 'ready', sessionPermissions: null, ...EMPTY_WORKSPACE_DATA });
      return;
    }
    let active = true;

    async function load() {
      setScreen({ status: 'loading' });
      try {
        const [data, sessionPermissions] = await Promise.all([
          loadWorkspaceDataWithTimeout(role, 20000),
          loadSessionPermissions(role),
        ]);
        if (active) setScreen({ status: 'ready', sessionPermissions, ...data });
      } catch (cause) {
        if (active) setScreen({ status: 'error', message: getErrorMessage(cause) });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [skipLoad, role, loadAttempt]);

  if (screen.status === 'loading') {
    return <LoadingState label="Cargando el panel privado..." />;
  }

  if (screen.status === 'error') {
    return (
      <ErrorState
        title="No pudimos cargar el panel privado"
        description={screen.message}
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
      />
    );
  }

  return (
    <PrivateWorkspaceReady
      {...props}
      initialData={screen}
      sessionPermissions={screen.sessionPermissions}
    />
  );
}

function PrivateWorkspaceReady({
  role: workspaceRole,
  initialNav,
  sessionName,
  sessionEmail,
  sessionUserId,
  sessionRoleLabel,
  onLogout,
  initialData,
  sessionPermissions,
}: PrivateWorkspaceProps & {
  initialData: WorkspaceState;
  /** Permisos reales de un rol operativo; `null` para admin y huésped. */
  sessionPermissions: string[] | null;
}) {
  const activeRole = workspaceRole;
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState(() => getInitialNav(workspaceRole, initialNav));
  const [expandedNav, setExpandedNav] = useState(() =>
    getDefaultExpandedNav(workspaceRole, getInitialNav(workspaceRole, initialNav)),
  );
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [accountPanel, setAccountPanel] = useState<'profile' | 'preferences' | null>(null);
  const [toast, setToast] = useState('');
  const [tasks, setTasks] = useState(initialData.tasks);
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [rolePermissions, setRolePermissions] = useState(() =>
    sessionPermissions
      ? {
          ...defaultRolePermissions,
          [toRolePermissionCode(workspaceRole)]: rolePermissionsFromSessionPermissions(
            toRolePermissionCode(workspaceRole),
            sessionPermissions,
          ),
        }
      : defaultRolePermissions,
  );
  const canWriteInventory =
    workspaceRole === 'admin' || Boolean(sessionPermissions?.includes('inventory.write'));
  const [adminStockNotifications, setAdminStockNotifications] = useState<NotificationItem[]>([]);
  const [hkRooms, setHkRooms] = useState(initialData.cleaningRooms);
  const [hkRequests, setHkRequests] = useState(initialData.guestRequests);
  const [hkHistory, setHkHistory] = useState(initialData.history);
  const [hkDefects, setHkDefects] = useState(initialData.defects);
  const [hkDetailRoomId, setHkDetailRoomId] = useState<number | null>(null);
  const [hkShowDefectModal, setHkShowDefectModal] = useState(false);
  const [hkShowStatusModal, setHkShowStatusModal] = useState<CleaningRoom | null>(null);
  const [hkSearch, setHkSearch] = useState('');
  const [hkFilter, setHkFilter] = useState<'Todos' | RoomStatus>('Todos');
  const [rsOrders, setRsOrders] = useState(initialData.roomServiceOrders);
  const [rsSelectedOrderId, setRsSelectedOrderId] = useState<number | null>(null);
  const [rsSearch, setRsSearch] = useState('');
  const [rsFilter, setRsFilter] = useState<'Todos' | OrderStatus>('Todos');
  const [cgRequests, setCgRequests] = useState(initialData.conciergeRequests);
  const [cgSelectedRequestId, setCgSelectedRequestId] = useState<number | null>(null);
  const [cgSearch, setCgSearch] = useState('');
  const [cgFilter, setCgFilter] = useState<'Todos' | ConciergeStatus>('Todos');
  const [recReservationList, setRecReservationList] = useState<Reservation[]>(
    initialData.recReservations,
  );
  const [recRoomList, setRecRoomList] = useState<RecRoom[]>(initialData.recRooms);
  const [recBlockList, setRecBlockList] = useState<RoomBlock[]>(initialData.recRoomBlocks);
  const [recentActivity] = useState(initialData.recentActivity);
  const [recSelectedResId, setRecSelectedResId] = useState<number | null>(null);
  const [recShowNewRes, setRecShowNewRes] = useState(false);
  const [recShowWalkin, setRecShowWalkin] = useState(false);
  const [recShowCheckin, setRecShowCheckin] = useState<number | null>(null);
  const [recShowCheckout, setRecShowCheckout] = useState<number | null>(null);
  const [recShowCancel, setRecShowCancel] = useState<number | null>(null);
  const [recShowVoid, setRecShowVoid] = useState<number | null>(null);
  const [recShowCharge, setRecShowCharge] = useState<number | null>(null);
  const [recShowVoidCharge, setRecShowVoidCharge] = useState<{
    resId: number;
    entryId: number;
  } | null>(null);
  const [recShowPayment, setRecShowPayment] = useState<number | null>(null);
  const [recShowDeposit, setRecShowDeposit] = useState<number | null>(null);
  const [recShowRoomChange, setRecShowRoomChange] = useState<number | null>(null);
  const [recShowBlock, setRecShowBlock] = useState(false);
  const [recShowInvoice, setRecShowInvoice] = useState<number | null>(null);
  const [recCashAction, setRecCashAction] = useState<'payment' | 'charge' | null>(null);
  const [recCalFilter, setRecCalFilter] = useState<{ room: string; type: string; status: string }>({
    room: 'Todos',
    type: 'Todos',
    status: 'Todos',
  });
  const [recSearch, setRecSearch] = useState('');
  const hkDetailRoom =
    hkDetailRoomId !== null ? (hkRooms.find((r) => r.id === hkDetailRoomId) ?? null) : null;
  const rsSelectedOrder =
    rsSelectedOrderId === null
      ? null
      : (rsOrders.find((order) => order.id === rsSelectedOrderId) ?? null);
  const cgSelectedRequest =
    cgSelectedRequestId === null
      ? null
      : (cgRequests.find((req) => req.id === cgSelectedRequestId) ?? null);
  const recSelectedRes =
    recSelectedResId === null
      ? null
      : (recReservationList.find((r) => r.id === recSelectedResId) ?? null);
  const recNextCode = () =>
    `AUR-${26001 + recReservationList.length - initialData.recReservations.length}`;
  const recNights = (checkIn: string, checkOut: string) =>
    Math.max(1, calculateNights(toDomainCalendarDate(checkIn), toDomainCalendarDate(checkOut)));
  const recFolioTotals = (folio: FolioEntry[]) => {
    const active = folio.filter((f) => f.status === 'Activo');
    const charges = active.filter((f) => f.type === 'Cargo').reduce((s, f) => s + f.amount, 0);
    const deposits = active.filter((f) => f.type === 'Depósito').reduce((s, f) => s + f.amount, 0);
    const payments = active.filter((f) => f.type === 'Pago').reduce((s, f) => s + f.amount, 0);
    return { charges, deposits, payments, balance: charges - payments - deposits };
  };
  const recIsRoomBlocked = (roomNumber: string, checkIn: string, checkOut: string) =>
    recBlockList.some(
      (b) =>
        b.active && b.roomNumber === roomNumber && b.endDate >= checkIn && b.startDate <= checkOut,
    );
  const recHasConflict = (
    roomNumber: string,
    checkIn: string,
    checkOut: string,
    excludeId?: number,
  ) =>
    recReservationList.some(
      (r) =>
        r.id !== excludeId &&
        !['Cancelada', 'Anulada'].includes(r.status) &&
        r.roomNumber === roomNumber &&
        r.checkOut > checkIn &&
        r.checkIn < checkOut,
    );

  useEffect(() => {
    if (activeRole !== 'admin') return;
    let cancelled = false;
    personnelService
      .getRoles()
      .then((roles) => {
        if (cancelled) return;
        setRolePermissions((current) => ({
          ...current,
          ...rolePermissionsFromBackendRoles(roles),
        }));
      })
      .catch(() => {
        // El panel de administracion muestra el error detallado; el sidebar conserva el fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [activeRole]);

  useEffect(() => {
    if (activeRole !== 'admin') {
      setAdminStockNotifications([]);
      return;
    }

    let cancelled = false;
    inventoryService
      .getItemsBelowMinimum()
      .then((items) => {
        if (cancelled) return;
        setAdminStockNotifications(
          items.map((item) => ({
            title: `${item.name}: stock bajo`,
            detail: `${item.currentQuantity} disponibles · mínimo ${item.minimumQuantity}`,
            tone: 'warning',
            destination: scopedNav('admin', 'Gestión de inventario'),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setAdminStockNotifications([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRole]);

  const rolePermissionCode = toRolePermissionCode(activeRole);
  const baseNav = activeRole ? navByRole.admin : [];
  const filteredNav = filterNavByPermissions(baseNav, rolePermissions[rolePermissionCode] ?? {});
  const permittedNav =
    activeRole === 'guest'
      ? filteredNav.map((item) =>
          item.label === 'Huésped' &&
          !item.children?.some((child) => child.label === 'Notificaciones')
            ? { ...item, children: [...(item.children ?? []), navChild('guest', 'Notificaciones')] }
            : item,
        )
      : filteredNav;
  const shouldGroupNav = activeRole === 'admin' || permittedNav.length > 1;
  const nav = shouldGroupNav ? permittedNav : flattenPermittedNav(permittedNav);
  const groupedNavLabels = nav
    .filter((item) => item.children?.length)
    .map((item) => item.label)
    .join('|');
  useEffect(() => {
    if (!groupedNavLabels) return;
    const labels = groupedNavLabels.split('|');
    setExpandedNav((current) => {
      const missing = labels.filter((label) => !current.includes(label));
      return missing.length > 0 ? [...current, ...missing] : current;
    });
  }, [groupedNavLabels]);
  useEffect(() => {
    const isVisible =
      nav.some((item) => (item.nav ?? item.label) === activeNav) ||
      nav.some((item) => item.children?.some((child) => child.nav === activeNav));
    const isGuestBellDestination = activeRole === 'guest' && activeNav === 'Notificaciones';
    if (!isVisible && !isGuestBellDestination) setActiveNav(firstNavValue(nav));
  }, [activeNav, activeRole, nav]);
  const activeWorkspace = resolveWorkspaceNav(activeRole, activeNav, nav);
  const contentRole = activeWorkspace.role;
  const contentNav = activeWorkspace.nav;
  const contentLabel = activeWorkspace.label;
  const workspaceDataRole = contentRole;
  const role = roles.find((item) => item.id === activeRole) ?? roles[0];
  const contentRoleInfo = roles.find((item) => item.id === contentRole) ?? role;
  const accountName = sessionName ?? role.person;
  const accountRoleLabel = sessionRoleLabel ?? role.name;
  const greetingName = accountName.trim().split(/\s+/)[0] || role.person;
  const preferenceViews = nav.map((item) => item.label);
  const today = toDtoCalendarDate(new Date());
  const arrivalsToday = recReservationList.filter(
    (reservation) =>
      reservation.checkIn === today && ['Pendiente', 'Confirmada'].includes(reservation.status),
  ).length;
  const departuresToday = recReservationList.filter(
    (reservation) => reservation.checkOut === today && reservation.status === 'Check-in',
  ).length;
  const openConciergeRequests = cgRequests.filter((request) => !isClosedConcierge(request.status));
  const navBadge = (roleId: RoleId, label: string) => {
    if (roleId === 'housekeeping' && label === 'Habitaciones') {
      return hkRooms.filter((room) => room.status === 'Pendiente').length;
    }
    if (roleId === 'housekeeping' && label === 'Solicitudes') {
      return hkRequests.filter(isOpenGuestRequest).length;
    }
    if (roleId === 'reception' && label === 'Calendario') {
      return arrivalsToday + departuresToday;
    }
    if (roleId === 'room-service' && label === 'Pedidos activos') {
      return rsOrders.filter(
        (order) => !['Entregado', 'Rechazado', 'Cancelado'].includes(order.status),
      ).length;
    }
    if (roleId === 'concierge' && label === 'Solicitudes') {
      return openConciergeRequests.length;
    }
    return undefined;
  };
  const sidebarNav = nav
    .map((item) => {
      const visibleChildren = item.children
        ?.filter((child) => !(child.role === 'guest' && child.label === 'Notificaciones'))
        .map((child) => {
          const count = navBadge(child.role, child.label);
          return { ...child, badge: count ? String(count) : undefined };
        });
      const visibleItem = visibleChildren ? { ...item, children: visibleChildren } : item;
      const count = navBadge(item.role ?? activeRole, item.label);
      return { ...visibleItem, badge: count ? String(count) : undefined };
    })
    .filter((item) => !(activeRole === 'guest' && item.label === 'Notificaciones'));
  const showsGreeting = [
    'Resumen',
    'Dashboard',
    'Mi jornada',
    'Mi estancia',
    'Inicio',
    'Pedidos activos',
  ].includes(contentNav);
  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) =>
        `${task.title} ${task.room} ${task.guest}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [tasks, search],
  );
  const roomServiceActiveOrders = rsOrders.filter(
    (order) => !['Entregado', 'Rechazado', 'Cancelado'].includes(order.status),
  );
  const roomServiceInProgress = rsOrders.filter((order) =>
    ['Aceptado', 'En preparación'].includes(order.status),
  );
  const roomServiceReadyToDeliver = rsOrders.filter((order) =>
    ['Listo', 'En camino'].includes(order.status),
  );
  const roomServiceDeliveredTotal = rsOrders
    .filter((order) => order.status === 'Entregado')
    .reduce(
      (total, order) =>
        total +
        order.items.reduce((orderTotal, item) => orderTotal + item.quantity * item.price, 0),
      0,
    );
  const occupancyCount = recRoomList.filter((room) => room.status === 'Ocupada').length;
  const occupancyRate =
    recRoomList.length > 0 ? Math.round((occupancyCount / recRoomList.length) * 100) : 0;
  const paymentsToday = recReservationList
    .flatMap((reservation) => reservation.folio)
    .filter((entry) => entry.date === today && entry.type === 'Pago' && entry.status === 'Activo');
  const paymentsTodayTotal = paymentsToday.reduce((total, entry) => total + entry.amount, 0);
  const currentMetrics =
    contentRole === 'reception'
      ? [
          {
            label: 'Ocupación actual',
            value: `${occupancyRate}%`,
            change: `${occupancyCount} de ${recRoomList.length} habitaciones ocupadas`,
            icon: BedDouble,
            tone: 'sage',
          },
          {
            label: 'Entradas de hoy',
            value: String(arrivalsToday),
            change: 'Reservas pendientes o confirmadas',
            icon: DoorOpen,
            tone: 'gold',
          },
          {
            label: 'Salidas de hoy',
            value: String(departuresToday),
            change: 'Huéspedes con check-in activo',
            icon: ClipboardList,
            tone: 'terracotta',
          },
          {
            label: 'Pagos de hoy',
            value: formatGTQ(paymentsTodayTotal),
            change: `${paymentsToday.length} pagos registrados`,
            icon: Wallet,
            tone: 'blue',
          },
        ]
      : contentRole === 'room-service'
        ? [
            {
              label: 'Pedidos activos',
              value: String(roomServiceActiveOrders.length),
              change: `${rsOrders.filter((order) => order.status === 'Pendiente').length} pendientes de aceptar`,
              icon: ClipboardList,
              tone: 'terracotta',
            },
            {
              label: 'En proceso',
              value: String(roomServiceInProgress.length),
              change: 'Aceptados o preparando',
              icon: Package,
              tone: 'gold',
            },
            {
              label: 'Por entregar',
              value: String(roomServiceReadyToDeliver.length),
              change: 'Listos o en camino',
              icon: DoorOpen,
              tone: 'sage',
            },
            {
              label: 'Ventas entregadas',
              value: formatGTQ(roomServiceDeliveredTotal),
              change: `${rsOrders.filter((order) => order.status === 'Entregado').length} pedidos entregados`,
              icon: Wallet,
              tone: 'blue',
            },
          ]
        : contentRole === 'housekeeping'
          ? [
              {
                label: 'Habitaciones hoy',
                value: String(hkRooms.length),
                change: `${hkRooms.filter((r) => r.status === 'Pendiente').length} pendientes`,
                icon: BedDouble as IconType,
                tone: 'sage',
              },
              {
                label: 'En limpieza',
                value: String(hkRooms.filter((r) => r.status === 'En proceso').length),
                change: 'Ahora',
                icon: Sparkles as IconType,
                tone: 'gold',
              },
              {
                label: 'Solicitudes',
                value: String(hkRequests.filter(isOpenGuestRequest).length),
                change: `${hkRequests.filter((r) => r.priority === 'Alta' && isOpenGuestRequest(r)).length} urgentes`,
                icon: ClipboardList as IconType,
                tone: 'terracotta',
              },
              {
                label: 'Inspeccionadas',
                value: String(hkRooms.filter((room) => room.status === 'Inspeccionada').length),
                change: 'Habitaciones en estado inspeccionado',
                icon: ShieldCheck as IconType,
                tone: 'blue',
              },
            ]
          : contentRole === 'concierge'
            ? [
                {
                  label: 'Solicitudes abiertas',
                  value: String(openConciergeRequests.length),
                  change: 'Pendientes o en atención',
                  icon: ClipboardList,
                  tone: 'terracotta',
                },
                {
                  label: 'En atención',
                  value: String(
                    cgRequests.filter((request) =>
                      ['Aceptada', 'En proceso'].includes(request.status),
                    ).length,
                  ),
                  change: 'Aceptadas o en proceso',
                  icon: Headphones,
                  tone: 'gold',
                },
                {
                  label: 'Completadas',
                  value: String(
                    cgRequests.filter((request) => request.status === 'Completada').length,
                  ),
                  change: 'Solicitudes completadas',
                  icon: Sparkles,
                  tone: 'sage',
                },
                {
                  label: 'Rechazadas o canceladas',
                  value: String(
                    cgRequests.filter((request) =>
                      ['Rechazada', 'Cancelada'].includes(request.status),
                    ).length,
                  ),
                  change: 'Solicitudes cerradas sin completar',
                  icon: ClipboardList,
                  tone: 'blue',
                },
              ]
            : [];
  const notificationItems: NotificationItem[] =
    contentRole === 'housekeeping'
      ? [
          {
            title: `${hkRooms.filter((room) => room.status === 'Pendiente').length} habitaciones pendientes`,
            detail: 'Revisa la cola de limpieza de hoy',
            tone: 'warning',
          },
          {
            title: `${hkRequests.filter(isOpenGuestRequest).length} solicitudes activas`,
            detail: 'Amenidades y pedidos de huéspedes',
            tone: 'info',
          },
        ]
      : contentRole === 'reception'
        ? [
            {
              title: `${recReservationList.filter((reservation) => reservation.status === 'Pendiente').length} reservas pendientes`,
              detail: 'Confirma o da seguimiento desde Reservas',
              tone: 'warning',
            },
            {
              title: `${recRoomList.filter((room) => room.status === 'Limpieza').length} habitaciones en limpieza`,
              detail: 'Valida disponibilidad antes de asignar',
              tone: 'info',
            },
          ]
        : contentRole === 'room-service'
          ? [
              {
                title: `${rsOrders.filter((order) => order.status === 'Pendiente').length} pedidos pendientes`,
                detail: 'Acepta o rechaza los pedidos nuevos',
                tone: 'warning',
              },
              {
                title: `${rsOrders.filter((order) => order.status === 'Listo').length} pedidos listos`,
                detail: 'Coordina entrega a habitación',
                tone: 'success',
              },
            ]
          : contentRole === 'concierge'
            ? [
                {
                  title: `${cgRequests.filter((request) => request.status === 'Pendiente').length} solicitudes pendientes`,
                  detail: 'Transporte, reservas y servicios especiales',
                  tone: 'warning',
                },
                {
                  title: `${cgRequests.filter((request) => ['Aceptada', 'En proceso'].includes(request.status)).length} solicitudes en atención`,
                  detail: 'Solicitudes aceptadas o en proceso',
                  tone: 'info',
                },
              ]
            : contentRole === 'admin'
              ? adminStockNotifications
              : contentRole === 'guest'
                ? []
                : [
                    {
                      title: 'Reserva activa',
                      detail: 'Tu estancia y servicios están disponibles',
                      tone: 'success',
                    },
                  ];

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  };

  const notifyError = (cause: unknown) => {
    notify(getErrorMessage(cause));
  };

  useEffect(() => {
    if (activeRole !== 'admin') return;
    if (!['reception', 'housekeeping', 'room-service', 'concierge'].includes(contentRole)) return;
    let active = true;

    async function loadAdminScopedWorkspace() {
      try {
        const data = await loadWorkspaceData(workspaceDataRole);
        if (!active) return;

        if (contentRole === 'reception') {
          setRecReservationList(data.recReservations);
          setRecRoomList(data.recRooms);
          setRecBlockList(data.recRoomBlocks);
        }

        if (contentRole === 'housekeeping') {
          setHkRooms(data.cleaningRooms);
          setHkRequests(data.guestRequests);
          setHkHistory(data.history);
          setHkDefects(data.defects);
        }

        if (contentRole === 'room-service') {
          setRsOrders(data.roomServiceOrders);
          setRsSelectedOrderId((currentId) =>
            currentId !== null && data.roomServiceOrders.some((order) => order.id === currentId)
              ? currentId
              : null,
          );
        }

        if (contentRole === 'concierge') {
          setCgRequests(data.conciergeRequests);
          setCgSelectedRequestId((currentId) =>
            currentId !== null && data.conciergeRequests.some((request) => request.id === currentId)
              ? currentId
              : null,
          );
        }
      } catch (cause) {
        if (active) {
          setToast(getErrorMessage(cause));
          window.setTimeout(() => setToast(''), 2800);
        }
      }
    }

    void loadAdminScopedWorkspace();
    return () => {
      active = false;
    };
  }, [activeRole, contentRole, workspaceDataRole]);

  const refreshRoomServiceOrders = async () => {
    try {
      const orders = await orderService.getOrders();
      setRsOrders(orders.map((order, index) => toRoomServiceOrder(order, index + 1)));
      setRsSelectedOrderId((currentId) =>
        currentId !== null && currentId <= orders.length ? currentId : null,
      );
      notify('Historial de pedidos actualizado');
    } catch (cause) {
      notifyError(cause);
    }
  };

  const refreshConciergeRequests = async () => {
    try {
      const data = await loadWorkspaceData(workspaceDataRole);
      setCgRequests(data.conciergeRequests);
      setCgSelectedRequestId((currentId) =>
        currentId !== null && data.conciergeRequests.some((request) => request.id === currentId)
          ? currentId
          : null,
      );
      notify('Historial de solicitudes actualizado');
    } catch (cause) {
      notifyError(cause);
    }
  };

  const refreshReception = async () => {
    try {
      const data = await loadWorkspaceData(workspaceDataRole);
      setRecReservationList(data.recReservations);
      setRecRoomList(data.recRooms);
      setRecBlockList(data.recRoomBlocks);
      notify('Calendario actualizado');
    } catch (cause) {
      notifyError(cause);
    }
  };

  const handleWorkspaceExport = async () => {
    const date = exportDateSuffix();
    const download = <T extends Record<string, unknown>>(
      fileName: string,
      data: readonly T[],
      headers: { key: keyof T; label: string }[],
      emptyMessage: string,
    ) => {
      if (!exportToCSV(fileName, data, headers)) notify(emptyMessage);
      else notify(`Archivo ${fileName}.csv descargado`);
    };

    if (contentRole === 'reception') {
      download(
        `recepcion-${date}`,
        recReservationList.map((reservation) => ({
          codigo: reservation.code,
          huesped: `${reservation.guest.name} ${reservation.guest.lastName}`,
          entrada: reservation.checkIn,
          salida: reservation.checkOut,
          habitacion: reservation.roomNumber,
          estado: reservation.status,
        })),
        [
          { key: 'codigo', label: 'Código' },
          { key: 'huesped', label: 'Huésped' },
          { key: 'entrada', label: 'Entrada' },
          { key: 'salida', label: 'Salida' },
          { key: 'habitacion', label: 'Habitación' },
          { key: 'estado', label: 'Estado' },
        ],
        'No hay reservas para exportar',
      );
      return;
    }

    if (contentRole === 'room-service') {
      const activeOrders = rsOrders.filter(
        (order) => !['Entregado', 'Rechazado', 'Cancelado'].includes(order.status),
      );
      const source = contentNav === 'Historial' ? rsOrders : activeOrders;
      const visible = source.filter((order) => {
        const matchesSearch = `${order.id} ${order.room} ${order.guest} ${order.items
          .map((item) => item.name)
          .join(' ')}`
          .toLowerCase()
          .includes(rsSearch.toLowerCase());
        return matchesSearch && (rsFilter === 'Todos' || order.status === rsFilter);
      });
      download(
        `room-service-${date}`,
        visible.map((order) => ({
          pedido: order.id,
          habitacion: order.room,
          huesped: order.guest,
          total: order.items.reduce((sum, item) => sum + item.quantity * item.price, 0),
          estado: order.status,
          hora: order.time,
        })),
        [
          { key: 'pedido', label: 'Pedido' },
          { key: 'habitacion', label: 'Habitación' },
          { key: 'huesped', label: 'Huésped' },
          { key: 'total', label: 'Total' },
          { key: 'estado', label: 'Estado' },
          { key: 'hora', label: 'Hora' },
        ],
        'No hay pedidos de Room Service para exportar',
      );
      return;
    }

    if (contentRole === 'concierge') {
      const activeRequests = cgRequests.filter((request) => !isClosedConcierge(request.status));
      const source = contentNav === 'Historial' ? cgRequests : activeRequests;
      const visible = source.filter((request) => {
        const matchesSearch =
          `${request.id} ${request.room} ${request.guest} ${request.category} ${request.description}`
            .toLowerCase()
            .includes(cgSearch.toLowerCase());
        return matchesSearch && (cgFilter === 'Todos' || request.status === cgFilter);
      });
      download(
        `conserjeria-${date}`,
        visible.map((request) => ({
          solicitud: request.id,
          habitacion: request.room,
          huesped: request.guest,
          categoria: request.category,
          prioridad: request.priority,
          estado: request.status,
          hora: request.time,
        })),
        [
          { key: 'solicitud', label: 'Solicitud' },
          { key: 'habitacion', label: 'Habitación' },
          { key: 'huesped', label: 'Huésped' },
          { key: 'categoria', label: 'Categoría' },
          { key: 'prioridad', label: 'Prioridad' },
          { key: 'estado', label: 'Estado' },
          { key: 'hora', label: 'Hora' },
        ],
        'No hay solicitudes de conserjería para exportar',
      );
      return;
    }

    if (contentRole === 'admin' && contentNav === 'Dashboard') {
      try {
        const [rooms, bookings, cashMovements] = await Promise.all([
          roomService.getRooms(),
          bookingService.getBookings(),
          cashService.getMovements(),
        ]);
        const dashboardRows =
          rooms.length > 0 || bookings.length > 0 || cashMovements.length > 0
            ? [
                {
                  indicador: 'Habitaciones',
                  total: rooms.length,
                  ocupadas: rooms.filter((room) => room.status === 'occupied').length,
                  reservas: bookings.length,
                  movimientosCaja: cashMovements.length,
                },
              ]
            : [];
        download(
          `dashboard-${date}`,
          dashboardRows,
          [
            { key: 'indicador', label: 'Indicador' },
            { key: 'total', label: 'Total habitaciones' },
            { key: 'ocupadas', label: 'Habitaciones ocupadas' },
            { key: 'reservas', label: 'Reservas' },
            { key: 'movimientosCaja', label: 'Movimientos de caja' },
          ],
          'No hay datos del dashboard para exportar',
        );
      } catch (cause) {
        notifyError(cause);
      }
    }
  };

  const updateTask = (taskId: number) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, status: 'Completada', tone: 'success' } : task,
      ),
    );
    notify('La tarea se marcó como completada');
  };

  // Limpieza: cada acción espera la respuesta del backend antes de tocar la UI.
  // Si el backend la rechaza (400/403/404), se recarga el estado real.
  const refreshHousekeeping = async () => {
    const typeByRoomId = new Map(hkRooms.map((room) => [room.roomId, room.type]));
    const next = buildHousekeepingState(
      await fetchHousekeepingData(),
      (room) => typeByRoomId.get(room.id) ?? 'Estándar',
    );
    setHkRooms(next.cleaningRooms);
    setHkRequests(next.guestRequests);
    setHkHistory(next.history);
  };

  const failHousekeeping = async (cause: unknown) => {
    notifyError(cause);
    try {
      await refreshHousekeeping();
    } catch {
      // El aviso anterior ya informa del fallo; se conserva el último estado conocido.
    }
  };

  const ensureRequestChecklist = async (request: GuestRequest) => {
    if (request.checklist) return request.checklist;
    const labels = await housekeepingService.getGuestCleaningChecklistTemplate();
    if (labels.length === 0) throw new Error('La lista de limpieza no tiene tareas configuradas.');
    return housekeepingService.createChecklist({
      serviceRequestId: request.requestId,
      observations: request.request,
      items: labels.map((label, position) => ({ label, done: false, position })),
    });
  };

  const replaceCleaningRoom = (next: CleaningRoom) => {
    setHkRooms((current) => current.map((item) => (item.id === next.id ? next : item)));
  };

  const startCleaning = async (roomId: number) => {
    const room = hkRooms.find((item) => item.id === roomId);
    if (!room) return;

    try {
      const updated = await housekeepingService.startCleaning(room.roomId);
      const checklists = await housekeepingService.getChecklists();
      const checklist = checklists
        .filter(
          (item) =>
            !item.serviceRequestId &&
            item.roomId === room.roomId &&
            ['pending', 'in_progress'].includes(item.status),
        )
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
      if (!checklist) throw new Error('No encontramos el checklist activo de esta habitación.');
      replaceCleaningRoom(toCleaningRoom(updated, room.id, room.type, checklist));
      notify('Limpieza iniciada correctamente');
    } catch (cause) {
      await failHousekeeping(cause);
    }
  };

  const finishCleaning = async (roomId: number) => {
    const room = hkRooms.find((item) => item.id === roomId);
    if (!room) return false;
    if (room.checklist.some((item) => !item.done)) {
      notify('Marca todas las tareas del checklist antes de finalizar la limpieza.');
      return false;
    }

    try {
      const updated = await housekeepingService.completeCleaning(room.roomId);
      const checklist = (await housekeepingService.getChecklists())
        .filter(
          (item) =>
            !item.serviceRequestId && item.roomId === room.roomId && item.status === 'completed',
        )
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
      if (!checklist)
        throw new Error('La limpieza se completó, pero no encontramos el checklist guardado.');
      replaceCleaningRoom(toCleaningRoom(updated, room.id, room.type, checklist));
      if (updated.cleaningCompletedAt) {
        const entry = toCleaningHistoryEntry(
          Date.now(),
          room.number,
          'Limpieza de salida',
          updated.cleaningStartedAt,
          updated.cleaningCompletedAt,
        );
        setHkHistory((prev) => [entry, ...prev]);
      }
      notify('Habitación marcada como limpia');
      return true;
    } catch (cause) {
      await failHousekeeping(cause);
      return false;
    }
  };

  const inspectRoom = async (roomId: number) => {
    const room = hkRooms.find((item) => item.id === roomId);
    if (!room) return;

    try {
      const updated = await housekeepingService.inspectRoom(room.roomId);
      const checklist = (await housekeepingService.getChecklists())
        .filter((item) => !item.serviceRequestId && item.roomId === room.roomId)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
      replaceCleaningRoom(toCleaningRoom(updated, room.id, room.type, checklist));
      notify('Habitación inspeccionada correctamente');
    } catch (cause) {
      await failHousekeeping(cause);
    }
  };

  // "Cambiar estado" solo ofrece las acciones que expone el backend; no existe
  // un endpoint para devolver una habitación a `dirty` (lo hace el checkout).
  const changeRoomStatus = async (roomId: number, status: RoomStatus) => {
    setHkShowStatusModal(null);
    if (status === 'En proceso') await startCleaning(roomId);
    if (status === 'Completada') await finishCleaning(roomId);
    if (status === 'Inspeccionada') await inspectRoom(roomId);
  };

  const attendRequest = async (reqId: number) => {
    const request = hkRequests.find((item) => item.id === reqId);
    if (!request) return;

    try {
      const updated = await housekeepingService.startStayoverCleaning(request.requestId);
      const checklist = isGuestItemRequest(request)
        ? undefined
        : await ensureRequestChecklist(request);
      setHkRequests((current) =>
        current.map((item) =>
          item.id === reqId
            ? {
                ...item,
                status: mapServiceStatus(updated.status),
                checklistId: checklist?.id,
                checklist,
              }
            : item,
        ),
      );
      notify('Limpieza iniciada. Marca cada tarea conforme la completes.');
    } catch (cause) {
      await failHousekeeping(cause);
    }
  };

  const completeRequest = async (reqId: number) => {
    const req = hkRequests.find((item) => item.id === reqId);
    if (!req) return;

    try {
      if (!isGuestItemRequest(req) && (!req.checklist || req.checklist.status !== 'completed')) {
        throw new Error('Completa primero todos los puntos del checklist.');
      }
      const updated = await housekeepingService.completeStayoverCleaning(req.requestId);
      setHkRequests((current) =>
        current.map((item) =>
          item.id === reqId
            ? {
                ...item,
                status: mapServiceStatus(updated.status),
              }
            : item,
        ),
      );
      if (updated.completedAt) {
        const entry = toCleaningHistoryEntry(
          Date.now(),
          req.room,
          `Limpieza de estancia: ${req.request}`,
          updated.startedAt,
          updated.completedAt,
        );
        setHkHistory((prev) => [entry, ...prev]);
      }
      notify('Limpieza de estancia completada correctamente');
    } catch (cause) {
      await failHousekeeping(cause);
    }
  };

  const prepareRequestChecklist = async (reqId: number) => {
    const request = hkRequests.find((item) => item.id === reqId);
    if (!request || isGuestItemRequest(request)) return;
    try {
      const checklist = await ensureRequestChecklist(request);
      setHkRequests((current) =>
        current.map((item) =>
          item.id === reqId ? { ...item, checklistId: checklist.id, checklist } : item,
        ),
      );
    } catch (cause) {
      await failHousekeeping(cause);
    }
  };

  const toggleRequestChecklistItem = async (reqId: number, index: number) => {
    const request = hkRequests.find((item) => item.id === reqId);
    if (!request?.checklist || request.checklist.status === 'completed') return;
    const items = request.checklist.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, done: !item.done } : item,
    );
    try {
      const checklist = await housekeepingService.saveChecklist(request.checklist.id, {
        status: 'in_progress',
        items,
      });
      setHkRequests((current) =>
        current.map((item) =>
          item.id === reqId ? { ...item, checklistId: checklist.id, checklist } : item,
        ),
      );
    } catch (cause) {
      await failHousekeeping(cause);
    }
  };

  const completeRequestChecklist = async (reqId: number) => {
    const request = hkRequests.find((item) => item.id === reqId);
    if (!request?.checklist) return;
    if (request.checklist.items.some((item) => !item.done)) {
      notify('Marca todos los puntos antes de cerrar el checklist.');
      return;
    }
    try {
      const checklist = await housekeepingService.saveChecklist(request.checklist.id, {
        status: 'completed',
        items: request.checklist.items,
      });
      setHkRequests((current) =>
        current.map((item) =>
          item.id === reqId ? { ...item, checklistId: checklist.id, checklist } : item,
        ),
      );
      notify('Checklist de limpieza completado. Ya puedes cerrar la solicitud.');
    } catch (cause) {
      await failHousekeeping(cause);
    }
  };

  const toggleChecklistItem = async (roomId: number, index: number) => {
    const room = hkRooms.find((item) => item.id === roomId);
    if (!room) return;

    const checklistItems = room.checklist.map((item, itemIndex) =>
      itemIndex === index ? { ...item, done: !item.done } : item,
    );

    try {
      if (!room.checklistId)
        throw new Error('No encontramos el checklist guardado de esta habitación.');
      const checklist = await housekeepingService.saveChecklist(room.checklistId, {
        status: 'in_progress',
        items: checklistItems,
      });
      setHkRooms((current) =>
        current.map((item) =>
          item.id === roomId
            ? { ...item, checklistId: checklist.id, checklist: checklist.items }
            : item,
        ),
      );
    } catch (cause) {
      notifyError(cause);
    }
  };

  const submitDefect = async (report: Omit<DefectReport, 'id'>) => {
    const room = hkRooms.find((item) => item.number === report.room);
    if (!room) {
      notify('No encontramos la habitacion seleccionada.');
      return;
    }

    try {
      const request = await serviceRequestService.createMaintenanceReport({
        roomId: room.roomId,
        description: `${report.category}: ${report.description}`,
        notes: [report.priority, report.observation].filter(Boolean).join(' - '),
      });
      setHkDefects((prev) => [
        ...prev,
        {
          ...report,
          id: parseDbId(request.id, Date.now()),
          requestId: request.id,
          roomId: room.roomId,
        },
      ]);
      setHkShowDefectModal(false);
      notify('Reporte enviado correctamente');
    } catch (cause) {
      notifyError(cause);
    }
  };

  const addRoomServiceChargeToFolio = (order: RoomServiceOrder, charge: Charge) => {
    setRecReservationList((current) =>
      current.map((reservation) => {
        const isActiveStay = !['Cancelada', 'Anulada', 'Check-out'].includes(reservation.status);
        if (
          reservation.roomNumber !== order.room ||
          (reservation.bookingId !== undefined && reservation.bookingId !== order.bookingId) ||
          !isActiveStay
        ) {
          return reservation;
        }
        if (reservation.folio.some((entry) => entry.id === parseDbId(charge.id, 0)))
          return reservation;
        return {
          ...reservation,
          folio: [
            ...reservation.folio,
            {
              id: parseDbId(charge.id, Date.now() + order.id),
              concept: charge.description,
              category: 'Room service',
              amount: centsToAmount(charge.amountCents),
              date: toDtoCalendarDate(charge.chargedAt),
              type: 'Cargo' as const,
              status: 'Activo' as const,
            },
          ],
        };
      }),
    );
  };

  // Room Service: cada acción espera la respuesta del backend. Si la rechaza
  // (transición inválida, sin stock, folio cerrado), se recargan los pedidos reales.
  const replaceRoomServiceOrder = (orderId: number, updated: Order) => {
    setRsOrders((current) =>
      current.map((item) => {
        if (item.id !== orderId) return item;
        const next = toRoomServiceOrder(updated, item.id);
        // La respuesta del backend no repite los nombres si no los conoce.
        return {
          ...next,
          room: updated.roomNumber ? next.room : item.room,
          guest: updated.guestName ? next.guest : item.guest,
        };
      }),
    );
  };

  const reloadRoomServiceOrders = async () => {
    const orders = await orderService.getOrders();
    setRsOrders(orders.map((order, index) => toRoomServiceOrder(order, index + 1)));
  };

  const failRoomService = async (cause: unknown) => {
    notifyError(cause);
    try {
      await reloadRoomServiceOrders();
    } catch {
      // El aviso anterior ya informa del fallo; se conserva el último estado conocido.
    }
  };

  // El cargo lo crea el backend al entregar; recepción solo refleja ese cargo en
  // el folio que tiene en pantalla. Room Service no tiene `charges.read`.
  const syncDeliveredChargeToFolio = async (order: RoomServiceOrder, chargeId: string) => {
    if (activeRole !== 'reception' && activeRole !== 'admin') return;
    try {
      const charges = await guestAccountService.getChargesByBookingId(order.bookingId);
      const charge = charges.find((item) => item.id === chargeId);
      if (charge) addRoomServiceChargeToFolio(order, charge);
    } catch (cause) {
      notifyError(cause);
    }
  };

  const updateRoomServiceOrder = async (orderId: number, status: OrderStatus) => {
    const order = rsOrders.find((item) => item.id === orderId);
    if (!order) return;

    try {
      const updated = await orderService.updateOrderStatus(
        order.orderId,
        toDomainOrderStatus(status),
      );
      replaceRoomServiceOrder(orderId, updated);
      notify(
        status === 'Entregado'
          ? `Pedido #${orderId} entregado y cargado al folio`
          : `Pedido #${orderId} actualizado: ${status}`,
      );
      if (updated.status === 'delivered' && updated.chargeId) {
        await syncDeliveredChargeToFolio(order, updated.chargeId);
      }
    } catch (cause) {
      await failRoomService(cause);
    }
  };

  const updateRoomServiceNote = async (orderId: number, note: string) => {
    const order = rsOrders.find((item) => item.id === orderId);
    if (!order) return;

    try {
      const updated = await orderService.updateOrderNotes(order.orderId, note);
      replaceRoomServiceOrder(orderId, updated);
      notify('Observación guardada');
    } catch (cause) {
      await failRoomService(cause);
    }
  };

  const rejectRoomServiceOrder = async (orderId: number, reason: string) => {
    const order = rsOrders.find((item) => item.id === orderId);
    if (!order) return;

    try {
      const updated = await orderService.updateOrderStatus(order.orderId, 'rejected', reason);
      replaceRoomServiceOrder(orderId, updated);
      notify(`Pedido #${orderId} rechazado`);
    } catch (cause) {
      await failRoomService(cause);
    }
  };

  const cancelRoomServiceOrder = async (orderId: number, reason: string) => {
    const order = rsOrders.find((item) => item.id === orderId);
    if (!order) return;

    try {
      // El backend devuelve el inventario si el pedido ya lo había descontado.
      const updated = await orderService.updateOrderStatus(order.orderId, 'cancelled', reason);
      replaceRoomServiceOrder(orderId, updated);
      notify(`Pedido #${orderId} cancelado`);
    } catch (cause) {
      await failRoomService(cause);
    }
  };

  // Conserjería: cada acción espera la respuesta del backend. Si la rechaza
  // (transición inválida, solicitud cerrada), se recargan las solicitudes reales.
  const replaceConciergeRequest = (requestId: number, updated: ServiceRequest) => {
    setCgRequests((current) =>
      current.map((item) => {
        if (item.id !== requestId) return item;
        const next = toConciergeRequest(updated, item.id);
        // La respuesta no repite habitación ni huésped si el backend no los conoce.
        return {
          ...next,
          room: updated.roomNumber ? next.room : item.room,
          guest: updated.guestName ? next.guest : item.guest,
        };
      }),
    );
  };

  const reloadConciergeRequests = async () => {
    const requests = await serviceRequestService.getConciergeRequests();
    setCgRequests(requests.map((request, index) => toConciergeRequest(request, index + 1)));
  };

  const failConcierge = async (cause: unknown) => {
    notifyError(cause);
    try {
      await reloadConciergeRequests();
    } catch {
      // El aviso anterior ya informa del fallo; se conserva el último estado conocido.
    }
  };

  // El detalle se pide al backend al abrirlo, para mostrar responsable y notas vigentes.
  const openConciergeDetail = async (requestId: number) => {
    setCgSelectedRequestId(requestId);
    const request = cgRequests.find((item) => item.id === requestId);
    if (!request) return;
    try {
      const detail = await serviceRequestService.getConciergeRequestById(request.requestId);
      if (detail) replaceConciergeRequest(requestId, detail);
      else await reloadConciergeRequests();
    } catch (cause) {
      notifyError(cause);
    }
  };

  const updateConciergeStatus = async (requestId: number, status: ConciergeStatus) => {
    const request = cgRequests.find((item) => item.id === requestId);
    if (!request) return;

    try {
      // Sin notas: el backend las agregaría a las existentes en cada cambio de estado.
      const updated = await serviceRequestService.updateConciergeRequestStatus(
        request.requestId,
        toDomainConciergeStatus(status),
      );
      replaceConciergeRequest(requestId, updated);
      notify(`Solicitud #${requestId} actualizada: ${status}`);
    } catch (cause) {
      await failConcierge(cause);
    }
  };

  const updateConciergeObservation = async (requestId: number, observation: string) => {
    const request = cgRequests.find((item) => item.id === requestId);
    if (!request) return;

    try {
      const updated = await serviceRequestService.updateConciergeRequest(request.requestId, {
        notes: observation,
      });
      replaceConciergeRequest(requestId, updated);
      notify('Observación guardada correctamente');
    } catch (cause) {
      await failConcierge(cause);
    }
  };

  const rejectConciergeRequest = async (requestId: number, reason: string) => {
    const request = cgRequests.find((item) => item.id === requestId);
    if (!request) return;

    try {
      const updated = await serviceRequestService.updateConciergeRequestStatus(
        request.requestId,
        'rejected',
        { notes: reason },
      );
      replaceConciergeRequest(requestId, updated);
      notify(`Solicitud #${requestId} rechazada`);
    } catch (cause) {
      await failConcierge(cause);
    }
  };

  const cancelConciergeRequest = async (requestId: number, reason: string) => {
    const request = cgRequests.find((item) => item.id === requestId);
    if (!request) return;

    try {
      const updated = await serviceRequestService.updateConciergeRequestStatus(
        request.requestId,
        'cancelled',
        { notes: reason },
      );
      replaceConciergeRequest(requestId, updated);
      notify(`Solicitud #${requestId} cancelada`);
    } catch (cause) {
      await failConcierge(cause);
    }
  };

  const recUpdateReservation = (id: number, updates: Partial<Reservation>) => {
    setRecReservationList((current) =>
      current.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    );
  };

  const recAddReservation = async (reservation: Reservation): Promise<Reservation> => {
    const room = recRoomList.find((item) => item.number === reservation.roomNumber);
    if (!room?.backendRoomId || !room.roomTypeId) {
      throw new Error('La habitación seleccionada no está vinculada al backend.');
    }

    const [guests, rates] = await Promise.all([guestService.getGuests(), roomService.getRates()]);
    const email = reservation.guest.email.trim().toLowerCase();
    const existingGuest = email
      ? guests.find((guest) => guest.email?.trim().toLowerCase() === email)
      : undefined;
    const guest =
      existingGuest ??
      (await guestService.createGuest({
        first_name: reservation.guest.name,
        last_name: reservation.guest.lastName,
        email: reservation.guest.email,
        phone: reservation.guest.phone,
        nationality: reservation.guest.nationality || undefined,
        document_number: reservation.guest.docNumber || undefined,
      }));

    const lastNight = new Date(`${reservation.checkOut}T00:00:00`);
    lastNight.setDate(lastNight.getDate() - 1);
    const lastNightDate = toDtoCalendarDate(lastNight);
    const stayNights = calculateNights(
      toDomainCalendarDate(reservation.checkIn),
      toDomainCalendarDate(reservation.checkOut),
    );
    const rate = rates
      .filter(
        (item) =>
          item.active &&
          item.roomTypeId === room.roomTypeId &&
          toDtoCalendarDate(item.validFrom) <= reservation.checkIn &&
          toDtoCalendarDate(item.validTo) >= lastNightDate &&
          stayNights >= item.minimumNights,
      )
      .sort((left, right) => left.priceCents - right.priceCents)[0];
    if (!rate)
      throw new Error('No hay una tarifa activa para el tipo de habitación y las fechas elegidas.');

    const created = await bookingService.createBooking({
      guest_id: guest.id,
      room_type_id: room.roomTypeId,
      room_id: room.backendRoomId,
      rate_id: rate.id,
      check_in: reservation.checkIn,
      check_out: reservation.checkOut,
      adults: reservation.guestCount,
      children: 0,
      notes: reservation.observations.trim() || undefined,
    });
    const confirmed = await bookingService.confirmBooking(created.id);
    const saved: Reservation = {
      ...reservation,
      id: Number.parseInt(confirmed.id.replace(/-/g, '').slice(-8), 16),
      bookingId: confirmed.id,
      roomTypeId: room.roomTypeId,
      code: confirmed.confirmationCode,
      guestLinkCode: confirmed.guestLinkCode,
      guest: { ...reservation.guest, name: guest.firstName, lastName: guest.lastName },
      rate: rate.priceCents / 100,
      folio: reservation.folio.map((entry) => ({
        ...entry,
        amount: (rate.priceCents / 100) * stayNights,
      })),
      status: 'Confirmada',
    };
    setRecReservationList((current) => [...current, saved]);
    return saved;
  };

  const recDoCheckin = async (
    id: number,
    _updates: Partial<GuestInfo>,
    _companions: Companion[],
    res: Reservation,
    roomId?: string,
  ) => {
    if (!res.bookingId) {
      notify('La reserva no está vinculada al backend.');
      return;
    }
    if (res.roomNumber === 'Sin asignar' && !roomId) {
      notify('Selecciona una habitación compatible antes de hacer check-in.');
      return;
    }

    const assignedRoom = roomId ? recRoomList.find((room) => room.backendRoomId === roomId) : null;
    if (roomId && !assignedRoom) {
      notify('La habitación seleccionada ya no está disponible. Actualiza e inténtalo de nuevo.');
      return;
    }

    try {
      if (roomId) await bookingService.assignRoom(res.bookingId, roomId);
      await bookingService.checkIn(res.bookingId);
    } catch (cause) {
      notifyError(cause);
      return;
    }

    const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    setRecReservationList((current) =>
      current.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'Check-in',
              checkInTime: now,
              checkIn: res.checkIn,
              checkOut: res.checkOut,
              roomNumber: assignedRoom?.number ?? res.roomNumber,
            }
          : r,
      ),
    );
    setRecRoomList((current) =>
      current.map((rm) =>
        rm.number === (assignedRoom?.number ?? res.roomNumber) ? { ...rm, status: 'Ocupada' } : rm,
      ),
    );
    setRecShowCheckin(null);
    notify(`Check-in realizado · ${res.code}`);

    try {
      const data = await loadWorkspaceData(workspaceDataRole);
      setRecReservationList(data.recReservations);
      setRecRoomList(data.recRooms);
    } catch (cause) {
      notifyError(cause);
    }
  };

  const recConfirmReservation = async (id: number) => {
    const reservation = recReservationList.find((item) => item.id === id);
    if (!reservation?.bookingId) {
      notify('La reserva no está vinculada al backend.');
      return;
    }

    try {
      await bookingService.confirmBooking(reservation.bookingId);
    } catch (cause) {
      notifyError(cause);
      return;
    }

    setRecReservationList((current) =>
      current.map((item) => (item.id === id ? { ...item, status: 'Confirmada' } : item)),
    );
    notify(`Reserva confirmada · ${reservation.code}`);
  };

  const recDoCheckout = async (id: number) => {
    const res = recReservationList.find((r) => r.id === id);
    if (!res) return;
    if (recFolioTotals(res.folio).balance !== 0) {
      notify('No se puede finalizar el check-out: primero liquida el saldo de la cuenta.');
      return;
    }
    if (!res.bookingId) {
      notify('Esta reserva no está vinculada al backend y no puede cerrarse.');
      return;
    }

    try {
      await bookingService.checkOut(res.bookingId);
      const data = await loadWorkspaceData(workspaceDataRole);
      setRecReservationList(data.recReservations);
      setRecRoomList(data.recRooms);
      setRecShowCheckout(null);
      notify(`Check-out completado · ${res.code}`);
    } catch (cause) {
      notifyError(cause);
    }
  };

  const recCancelReservation = async (id: number, reason: string) => {
    const reservation = recReservationList.find((r) => r.id === id);
    if (!reservation?.bookingId) {
      notify('La reserva no está vinculada al backend.');
      return;
    }

    try {
      // El backend valida el estado (solo pending/confirmed) y guarda el motivo.
      await bookingService.cancelBooking(reservation.bookingId, reason);
    } catch (cause) {
      notifyError(cause);
      return;
    }

    setRecShowCancel(null);
    notify('Reserva cancelada correctamente');
    try {
      const data = await loadWorkspaceData(workspaceDataRole);
      setRecReservationList(data.recReservations);
      setRecRoomList(data.recRooms);
    } catch (cause) {
      notifyError(cause);
    }
  };

  const recVoidReservation = (id: number, reason: string) => {
    setRecReservationList((current) =>
      current.map((r) => (r.id === id ? { ...r, status: 'Anulada', voidReason: reason } : r)),
    );
    setRecShowVoid(null);
    notify('Reserva anulada · conservada para auditoría');
  };

  const recChangeRoom = async (id: number, newRoomNumber: string) => {
    const res = recReservationList.find((r) => r.id === id);
    if (!res) return;
    const targetRoom = recRoomList.find((room) => room.number === newRoomNumber);
    if (!res.bookingId || !targetRoom?.backendRoomId) {
      notify('No se pudo vincular la habitación o reserva con el backend.');
      return;
    }

    try {
      await bookingService.assignRoom(res.bookingId, targetRoom.backendRoomId);
      const data = await loadWorkspaceData(workspaceDataRole);
      setRecReservationList(data.recReservations);
      setRecRoomList(data.recRooms);
      setRecShowRoomChange(null);
      notify(`Habitación ${newRoomNumber} asignada correctamente`);
    } catch (cause) {
      notifyError(cause);
    }
  };

  const recAddCharge = (
    resId: number,
    concept: string,
    category: string,
    amount: number,
    observation: string,
  ) => {
    setRecReservationList((current) =>
      current.map((r) =>
        r.id === resId
          ? {
              ...r,
              folio: [
                ...r.folio,
                {
                  id: Date.now(),
                  concept,
                  category,
                  amount,
                  date: toDtoCalendarDate(new Date()),
                  type: 'Cargo' as const,
                  status: 'Activo' as const,
                },
              ],
            }
          : r,
      ),
    );
    setRecShowCharge(null);
    notify('Cargo agregado a la cuenta');
  };

  const recVoidCharge = (resId: number, entryId: number, reason: string) => {
    setRecReservationList((current) =>
      current.map((r) =>
        r.id === resId
          ? {
              ...r,
              folio: r.folio.map((f) =>
                f.id === entryId ? { ...f, status: 'Anulado' as const, voidReason: reason } : f,
              ),
            }
          : r,
      ),
    );
    setRecShowVoidCharge(null);
    notify('Cargo anulado · saldo recalculado');
  };

  const recAddPayment = (
    resId: number,
    amount: number,
    method: PaymentMethod,
    reference: string,
  ) => {
    setRecReservationList((current) =>
      current.map((r) =>
        r.id === resId
          ? {
              ...r,
              folio: [
                ...r.folio,
                {
                  id: Date.now(),
                  concept: `Pago ${method}`,
                  category: 'Pago',
                  amount,
                  date: toDtoCalendarDate(new Date()),
                  type: 'Pago' as const,
                  status: 'Activo' as const,
                  method,
                  reference,
                },
              ],
            }
          : r,
      ),
    );
    setRecShowPayment(null);
    notify('Pago registrado correctamente');
  };

  const recAddDeposit = (
    resId: number,
    amount: number,
    method: PaymentMethod,
    reference: string,
  ) => {
    setRecReservationList((current) =>
      current.map((r) =>
        r.id === resId
          ? {
              ...r,
              folio: [
                ...r.folio,
                {
                  id: Date.now(),
                  concept: 'Depósito / garantía',
                  category: 'Depósito',
                  amount,
                  date: toDtoCalendarDate(new Date()),
                  type: 'Depósito' as const,
                  status: 'Activo' as const,
                  method,
                  reference,
                },
              ],
            }
          : r,
      ),
    );
    setRecShowDeposit(null);
    notify('Depósito registrado correctamente');
  };

  const recAddBlock = (
    roomNumber: string,
    startDate: string,
    endDate: string,
    reason: string,
    observation: string,
  ) => {
    setRecBlockList((current) => [
      ...current,
      { id: Date.now(), roomNumber, startDate, endDate, reason, observation, active: true },
    ]);
    setRecRoomList((current) =>
      current.map((rm) => (rm.number === roomNumber ? { ...rm, status: 'Bloqueada' } : rm)),
    );
    setRecShowBlock(false);
    notify(`Habitación ${roomNumber} bloqueada`);
  };

  const recRemoveBlock = (blockId: number) => {
    const block = recBlockList.find((b) => b.id === blockId);
    setRecBlockList((current) =>
      current.map((b) => (b.id === blockId ? { ...b, active: false } : b)),
    );
    if (block)
      setRecRoomList((current) =>
        current.map((rm) =>
          rm.number === block.roomNumber ? { ...rm, status: 'Disponible' } : rm,
        ),
      );
    notify('Bloqueo finalizado · habitación disponible');
  };

  const closeAllReceptionModals = () => {
    setRecShowNewRes(false);
    setRecShowWalkin(false);
    setRecShowBlock(false);
    setRecShowCheckin(null);
    setRecShowCheckout(null);
    setRecShowCancel(null);
    setRecShowVoid(null);
    setRecShowCharge(null);
    setRecShowVoidCharge(null);
    setRecShowPayment(null);
    setRecShowDeposit(null);
    setRecShowRoomChange(null);
    setRecShowInvoice(null);
    setRecCashAction(null);
    setRecSelectedResId(null);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={19} />
          </span>
          <span>
            AURORA <small>HOTEL PMS</small>
          </span>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        {activeRole !== 'guest' && (
          <>
            <div className="workspace-label">ESPACIO DE TRABAJO</div>
            <button
              className="property-switcher"
              onClick={() => notify('Hotel Aurora · Sede Centro')}
            >
              <span className="property-icon">
                <Home size={16} />
              </span>
              <span>
                <strong>Hotel Aurora</strong>
                <small>Sede Centro</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </>
        )}
        <nav className="side-nav">
          <div className="workspace-label">
            {activeRole === 'guest' ? 'TU ESTANCIA' : 'OPERACIÓN'}
          </div>
          {sidebarNav.map((item) => {
            const Icon = item.icon;
            const hasChildren = Boolean(item.children?.length);
            const isExpanded = expandedNav.includes(item.label);
            const isActiveGroup =
              activeNav === (item.nav ?? item.label) ||
              Boolean(item.children?.some((child) => child.nav === activeNav));
            return (
              <div className="nav-group" key={item.nav ?? item.label}>
                <button
                  className={`nav-item ${isActiveGroup ? 'active' : ''} ${hasChildren ? 'has-children' : ''}`}
                  aria-expanded={hasChildren ? isExpanded : undefined}
                  onClick={() => {
                    if (hasChildren) {
                      setExpandedNav((current) =>
                        current.includes(item.label)
                          ? current.filter((label) => label !== item.label)
                          : [...current, item.label],
                      );
                      return;
                    }
                    if (activeRole === 'reception') closeAllReceptionModals();
                    setActiveNav(item.nav ?? item.label);
                    setSidebarOpen(false);
                    setShowNotifications(false);
                    notify(`${item.label} seleccionado`);
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {item.badge && <b>{item.badge}</b>}
                  {hasChildren && (
                    <ChevronDown className="nav-chevron" size={15} aria-hidden="true" />
                  )}
                </button>
                {hasChildren && isExpanded && (
                  <div className="nav-submenu">
                    {item.children?.map((child) => (
                      <button
                        key={child.nav}
                        className={`nav-subitem ${activeNav === child.nav ? 'active' : ''}`}
                        onClick={() => {
                          setActiveNav(child.nav);
                          setExpandedNav((current) =>
                            current.includes(item.label) ? current : [...current, item.label],
                          );
                          setSidebarOpen(false);
                          setShowNotifications(false);
                          notify(`${child.label} seleccionado`);
                        }}
                      >
                        <span>{child.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card">
            <div className="support-dot">
              <Headphones size={15} />
            </div>
            <div>
              <strong>¿Necesitas ayuda?</strong>
              <span>Habla con soporte</span>
            </div>
            <ArrowRight size={15} />
          </div>
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <main
        className="main-area"
        onScroll={(event) => {
          const nextScrolled = event.currentTarget.scrollTop > 8;
          setHeaderScrolled((current) => (current === nextScrolled ? current : nextScrolled));
        }}
      >
        <header className={`topbar ${headerScrolled ? 'is-scrolled' : ''}`}>
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="crumbs">
            <span>Hotel Aurora</span>
            <span>/</span>
            <strong>{contentLabel}</strong>
          </div>
          <div className="topbar-actions">
            <div className="notification-wrap">
              <button
                className="icon-btn notification"
                onClick={() => {
                  if (contentRole === 'guest') {
                    setShowNotifications(false);
                    setActiveNav('Notificaciones');
                  } else {
                    setShowNotifications((value) => !value);
                  }
                  setShowRoleMenu(false);
                }}
                aria-label="Notificaciones"
              >
                <Bell size={19} />
                {notificationItems.length > 0 && <i />}
              </button>
              {showNotifications && (
                <div className="notification-menu">
                  <div className="notification-head">
                    <strong>Notificaciones</strong>
                    <span>{notificationItems.length}</span>
                  </div>
                  {notificationItems.map((item) => (
                    <button
                      key={`${item.title}-${item.detail}`}
                      type="button"
                      className="notification-row"
                      onClick={() => {
                        setShowNotifications(false);
                        if (item.destination) setActiveNav(item.destination);
                        else notify(item.title);
                      }}
                    >
                      <span className={`notification-dot ${item.tone}`} />{' '}
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="profile-wrap">
              <button
                className="profile-button"
                onClick={() => {
                  setShowRoleMenu(!showRoleMenu);
                  setShowNotifications(false);
                }}
              >
                <span className={`avatar ${role.color}`}>{role.initials}</span>
                <span>
                  <strong>{accountName}</strong>
                  <small>{accountRoleLabel}</small>
                </span>
                <ChevronDown size={15} />
              </button>
              {showRoleMenu && (
                <div className="role-menu">
                  <button
                    onClick={() => {
                      setShowRoleMenu(false);
                      setAccountPanel('profile');
                    }}
                  >
                    <UserRound size={15} /> Mi perfil
                  </button>
                  <button
                    onClick={() => {
                      setShowRoleMenu(false);
                      setAccountPanel('preferences');
                    }}
                  >
                    <Settings size={15} /> Preferencias
                  </button>
                  <button
                    className="logout"
                    onClick={() => {
                      setShowRoleMenu(false);
                      setSidebarOpen(false);
                      onLogout?.();
                    }}
                  >
                    <LogOut size={15} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">
                {new Date().toLocaleDateString('es-MX', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              <h1>{showsGreeting ? `Buenos días, ${greetingName}` : contentLabel}</h1>
              <p className="muted">{getSubtitle(contentNav, contentRoleInfo.name)}</p>
            </div>
            {contentRole !== 'guest' && (
              <div className="welcome-actions">
                {contentRole === 'housekeeping' ? (
                  contentNav === summaryNavByRole.housekeeping && (
                    <button className="button primary" onClick={() => setHkShowDefectModal(true)}>
                      <Plus size={17} /> Reportar desperfecto
                    </button>
                  )
                ) : contentRole === 'reception' ? (
                  <>
                    <button
                      className="button secondary"
                      onClick={() => void handleWorkspaceExport()}
                    >
                      <FileText size={16} /> Exportar informe
                    </button>
                    {(contentNav === 'Resumen' ||
                      contentNav === 'Reservas' ||
                      contentNav === 'Calendario') && (
                      <button className="button primary" onClick={() => setRecShowNewRes(true)}>
                        <Plus size={17} /> Nueva reserva
                      </button>
                    )}
                    {contentNav === 'Habitaciones' && (
                      <button className="button primary" onClick={() => setRecShowBlock(true)}>
                        <Ban size={17} /> Bloquear habitación
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {(contentRole !== 'admin' || contentNav === 'Dashboard') && (
                      <>
                        <button
                          className="button secondary"
                          onClick={() => void handleWorkspaceExport()}
                        >
                          <FileText size={16} /> Exportar reporte
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
          {contentRole !== 'guest' &&
            contentRole !== 'admin' &&
            contentNav === summaryNavByRole[contentRole] && (
              <section className="metric-grid">
                {currentMetrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div className="metric-card" key={metric.label}>
                      <div className={`metric-icon ${metric.tone}`}>
                        <Icon size={19} />
                      </div>
                      <div>
                        <p>{metric.label}</p>
                        <h2>{metric.value}</h2>
                        <span className={metric.change.includes('+') ? 'positive' : ''}>
                          {metric.change}
                        </span>
                      </div>
                      <MoreHorizontal className="metric-more" size={18} />
                    </div>
                  );
                })}
              </section>
            )}
          {contentRole === 'housekeeping' ? (
            <HousekeepingContent
              nav={contentNav}
              rooms={hkRooms}
              requests={hkRequests}
              history={hkHistory}
              defects={hkDefects}
              search={hkSearch}
              setSearch={setHkSearch}
              onStartCleaning={startCleaning}
              onFinishCleaning={finishCleaning}
              onInspect={inspectRoom}
              onChangeStatus={changeRoomStatus}
              onAttendRequest={attendRequest}
              onCompleteRequest={completeRequest}
              onPrepareRequestChecklist={prepareRequestChecklist}
              onToggleRequestChecklist={toggleRequestChecklistItem}
              onCompleteRequestChecklist={completeRequestChecklist}
              onToggleChecklist={toggleChecklistItem}
              onOpenDetail={(room) => setHkDetailRoomId(room.id)}
              onOpenDefectModal={() => setHkShowDefectModal(true)}
              onOpenStatusModal={setHkShowStatusModal}
              onSubmitDefect={submitDefect}
              onAction={notify}
              onNavigate={(nextNav) =>
                setActiveNav(activeRole === 'admin' ? scopedNav('housekeeping', nextNav) : nextNav)
              }
              detailRoom={hkDetailRoom}
              onCloseDetail={() => setHkDetailRoomId(null)}
              showStatusModal={hkShowStatusModal}
              onCloseStatusModal={() => setHkShowStatusModal(null)}
              showDefectModal={hkShowDefectModal}
              onCloseDefectModal={() => setHkShowDefectModal(false)}
              hkFilter={hkFilter}
              setHkFilter={setHkFilter}
            />
          ) : contentRole === 'concierge' ? (
            <ConciergeContent
              nav={contentNav}
              requests={cgRequests}
              selectedRequest={cgSelectedRequest}
              onSelectRequest={(id) => void openConciergeDetail(id)}
              onCloseRequest={() => setCgSelectedRequestId(null)}
              onUpdateStatus={updateConciergeStatus}
              onUpdateObservation={updateConciergeObservation}
              onReject={rejectConciergeRequest}
              onCancel={cancelConciergeRequest}
              onRefresh={refreshConciergeRequests}
              onAction={notify}
              search={cgSearch}
              setSearch={setCgSearch}
              filter={cgFilter}
              setFilter={setCgFilter}
            />
          ) : contentRole === 'reception' ? (
            <ReceptionContent
              nav={contentNav}
              reservations={recReservationList}
              rooms={recRoomList}
              blocks={recBlockList}
              selectedRes={recSelectedRes}
              onSelectRes={setRecSelectedResId}
              onCloseRes={() => setRecSelectedResId(null)}
              onUpdateRes={recUpdateReservation}
              onAddReservation={recAddReservation}
              nextCode={recNextCode()}
              nights={recNights}
              folioTotals={recFolioTotals}
              isRoomBlocked={recIsRoomBlocked}
              hasConflict={recHasConflict}
              showNewRes={recShowNewRes}
              setShowNewRes={setRecShowNewRes}
              showWalkin={recShowWalkin}
              setShowWalkin={setRecShowWalkin}
              showCheckin={recShowCheckin}
              setShowCheckin={setRecShowCheckin}
              onCheckin={recDoCheckin}
              onConfirmReservation={recConfirmReservation}
              showCheckout={recShowCheckout}
              setShowCheckout={setRecShowCheckout}
              onCheckout={recDoCheckout}
              showCancel={recShowCancel}
              setShowCancel={setRecShowCancel}
              onCancel={recCancelReservation}
              showVoid={recShowVoid}
              setShowVoid={setRecShowVoid}
              onVoid={recVoidReservation}
              showCharge={recShowCharge}
              setShowCharge={setRecShowCharge}
              onAddCharge={recAddCharge}
              showVoidCharge={recShowVoidCharge}
              setShowVoidCharge={setRecShowVoidCharge}
              onVoidCharge={recVoidCharge}
              showPayment={recShowPayment}
              setShowPayment={setRecShowPayment}
              onAddPayment={recAddPayment}
              showDeposit={recShowDeposit}
              setShowDeposit={setRecShowDeposit}
              onAddDeposit={recAddDeposit}
              showRoomChange={recShowRoomChange}
              setShowRoomChange={setRecShowRoomChange}
              onRoomChange={recChangeRoom}
              showBlock={recShowBlock}
              setShowBlock={setRecShowBlock}
              onAddBlock={recAddBlock}
              onRemoveBlock={recRemoveBlock}
              showInvoice={recShowInvoice}
              setShowInvoice={setRecShowInvoice}
              cashAction={recCashAction}
              setCashAction={setRecCashAction}
              calFilter={recCalFilter}
              setCalFilter={setRecCalFilter}
              search={recSearch}
              setSearch={setRecSearch}
              onAction={notify}
              onNavigate={(nextNav) =>
                setActiveNav(activeRole === 'admin' ? scopedNav('reception', nextNav) : nextNav)
              }
              onRefresh={refreshReception}
            />
          ) : contentRole === 'room-service' ? (
            <RoomServiceContent
              nav={contentNav}
              orders={rsOrders}
              selectedOrder={rsSelectedOrder}
              onSelectOrder={setRsSelectedOrderId}
              onCloseOrder={() => setRsSelectedOrderId(null)}
              onUpdateStatus={updateRoomServiceOrder}
              onUpdateNote={updateRoomServiceNote}
              onReject={rejectRoomServiceOrder}
              onCancel={cancelRoomServiceOrder}
              onRefreshOrders={refreshRoomServiceOrders}
              canWriteInventory={canWriteInventory}
              onAction={notify}
              search={rsSearch}
              setSearch={setRsSearch}
              filter={rsFilter}
              setFilter={setRsFilter}
            />
          ) : contentRole === 'guest' ? (
            <GuestContent
              nav={contentNav}
              onAction={notify}
              onNavigate={(nextNav) =>
                setActiveNav(activeRole === 'admin' ? scopedNav('guest', nextNav) : nextNav)
              }
              onLogout={() => onLogout?.()}
              sessionUserId={sessionUserId}
              sessionName={sessionName}
              sessionEmail={sessionEmail}
            />
          ) : contentRole === 'admin' ? (
            <AdminContent
              nav={contentNav}
              onAction={notify}
              onNavigate={(nextNav) =>
                setActiveNav(activeRole === 'admin' ? scopedNav('admin', nextNav) : nextNav)
              }
              onRolePermissionsChange={(roleCode, permissions) =>
                setRolePermissions((current) => {
                  const next = { ...current, [roleCode]: permissions };
                  return next;
                })
              }
            />
          ) : (
            <>
              <section className="dashboard-grid">
                <div className="panel main-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>{getPanelTitle(contentRole, contentNav)}</h3>
                      <p>{getPanelDescription(contentRole)}</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        const destination = {
                          admin: scopedNav('admin', 'Reportes'),
                          reception: 'Reservas',
                          housekeeping: 'Habitaciones',
                          'room-service': 'Pedidos activos',
                          concierge: 'Solicitudes',
                          guest: 'Mis reservas',
                        }[contentRole];
                        setActiveNav(destination);
                      }}
                    >
                      Ver todo <ArrowRight size={15} />
                    </button>
                  </div>
                  {contentRole === 'admin' ? (
                    <AdminChart onAction={notify} />
                  ) : (
                    <TaskTable
                      tasks={filteredTasks}
                      search={search}
                      setSearch={setSearch}
                      onComplete={updateTask}
                      onAction={notify}
                      role={contentRole}
                    />
                  )}
                </div>
                <div className="panel side-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Actividad reciente</h3>
                      <p>Últimos movimientos del hotel</p>
                    </div>
                    <button className="icon-btn" onClick={() => notify('Actividad actualizada')}>
                      <Activity size={17} />
                    </button>
                  </div>
                  <ActivityFeed items={recentActivity} />
                </div>
              </section>
              <section className="bottom-grid">
                <div className="panel occupancy-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Estado de habitaciones</h3>
                      <p>Vista rápida del inventario en tiempo real</p>
                    </div>
                    <button
                      className="button small secondary"
                      onClick={() =>
                        setActiveNav(
                          activeRole === 'admin'
                            ? scopedNav('reception', 'Habitaciones')
                            : 'Habitaciones',
                        )
                      }
                    >
                      Gestionar <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="room-stats">
                    <RoomStat
                      label="Ocupadas"
                      value={String(recRoomList.filter((room) => room.status === 'Ocupada').length)}
                      tone="occupied"
                    />
                    <RoomStat
                      label="Disponibles"
                      value={String(
                        recRoomList.filter((room) => room.status === 'Disponible').length,
                      )}
                      tone="available"
                    />
                    <RoomStat
                      label="Limpieza"
                      value={String(
                        recRoomList.filter((room) => room.status === 'Limpieza').length,
                      )}
                      tone="cleaning"
                    />
                    <RoomStat
                      label="Mantenimiento"
                      value={String(
                        recRoomList.filter((room) => room.status === 'Mantenimiento').length,
                      )}
                      tone="maintenance"
                    />
                  </div>
                  <div className="progress-line">
                    <span>Ocupación general</span>
                    <strong>{occupancyRate}%</strong>
                    <div>
                      <i style={{ width: `${occupancyRate}%` }} />
                    </div>
                  </div>
                </div>
                <div className="panel quick-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Accesos rápidos</h3>
                      <p>Lo que más haces durante tu jornada</p>
                    </div>
                  </div>
                  <div className="quick-actions">
                    <button onClick={() => setRecShowNewRes(true)}>
                      <span>
                        <Plus size={17} />
                      </span>
                      Crear reserva
                    </button>
                    <button onClick={() => notify('Búsqueda de huésped activada')}>
                      <span>
                        <Search size={17} />
                      </span>
                      Buscar huésped
                    </button>
                    <button onClick={() => notify('Calendario abierto')}>
                      <span>
                        <CalendarDays size={17} />
                      </span>
                      Ver calendario
                    </button>
                    <button onClick={() => notify('Centro de ayuda abierto')}>
                      <span>
                        <Headphones size={17} />
                      </span>
                      Centro de ayuda
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      {accountPanel === 'profile' && (
        <AccountProfileModal
          name={accountName}
          roleLabel={accountRoleLabel}
          email={sessionEmail ?? ''}
          initials={role.initials}
          tone={role.color}
          onClose={() => setAccountPanel(null)}
          onSave={notify}
        />
      )}
      {accountPanel === 'preferences' && (
        <AccountPreferencesModal
          name={accountName}
          roleLabel={accountRoleLabel}
          initials={role.initials}
          tone={role.color}
          initialView={activeNav}
          viewOptions={preferenceViews}
          onClose={() => setAccountPanel(null)}
          onSave={notify}
        />
      )}
      {toast && (
        <div className="toast">
          <span className="toast-check">✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}

function ConciergeContent({
  nav,
  requests,
  selectedRequest,
  onSelectRequest,
  onCloseRequest,
  onUpdateStatus,
  onUpdateObservation,
  onReject,
  onCancel,
  onRefresh,
  onAction,
  search,
  setSearch,
  filter,
  setFilter,
}: {
  nav: string;
  requests: ConciergeRequest[];
  selectedRequest: ConciergeRequest | null;
  onSelectRequest: (id: number) => void;
  onCloseRequest: () => void;
  onUpdateStatus: (id: number, status: ConciergeStatus) => void;
  onUpdateObservation: (id: number, observation: string) => void;
  onReject: (id: number, reason: string) => void;
  onCancel: (id: number, reason: string) => void;
  onRefresh: () => Promise<void>;
  onAction: (message: string) => void;
  search: string;
  setSearch: (value: string) => void;
  filter: 'Todos' | ConciergeStatus;
  setFilter: (value: 'Todos' | ConciergeStatus) => void;
}) {
  const [rejectionRequestId, setRejectionRequestId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancelRequestId, setCancelRequestId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refreshHistory = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const activeRequests = requests.filter((req) => !isClosedConcierge(req.status));
  const completedRequests = requests.filter((req) => isClosedConcierge(req.status));

  const statusClass = (status: ConciergeStatus) =>
    status === 'Pendiente'
      ? 'warning'
      : status === 'Aceptada' || status === 'En proceso'
        ? 'info'
        : status === 'Completada'
          ? 'success'
          : 'terracotta';
  const priorityClass = (priority: string) =>
    priority === 'Alta' ? 'warning' : priority === 'Media' ? 'info' : 'success';
  const categoryIcon = (category: string) => {
    if (category === 'Transporte') return <Headphones size={15} />;
    if (category === 'Reservación') return <CalendarDays size={15} />;
    if (category === 'Lavandería') return <Sparkles size={15} />;
    if (category === 'Información turística') return <FileText size={15} />;
    return <ClipboardList size={15} />;
  };

  const nextAction = (req: ConciergeRequest) => {
    if (req.status === 'Pendiente')
      return (
        <>
          <button
            className="button small primary"
            onClick={() => onUpdateStatus(req.id, 'Aceptada')}
          >
            Aceptar solicitud
          </button>
          <button className="button small secondary" onClick={() => setRejectionRequestId(req.id)}>
            Rechazar
          </button>
        </>
      );
    if (req.status === 'Aceptada')
      return (
        <button
          className="button small primary"
          onClick={() => onUpdateStatus(req.id, 'En proceso')}
        >
          Marcar en proceso
        </button>
      );
    if (req.status === 'En proceso')
      return (
        <button
          className="button small primary"
          onClick={() => onUpdateStatus(req.id, 'Completada')}
        >
          Completar solicitud
        </button>
      );
    return null;
  };

  const renderRequest = (req: ConciergeRequest) => (
    <article className="cg-request-card" key={req.id}>
      <div className="cg-request-head">
        <div>
          <span className="cg-request-number">Solicitud #{req.id}</span>
          <h3>
            Habitación {req.room} · {req.guest}
          </h3>
          <p>
            {req.category} · recibida a las {req.time}
          </p>
        </div>
        <div className="cg-request-pills">
          <span className={`status-pill ${priorityClass(req.priority)}`}>{req.priority}</span>
          <span className={`status-pill ${statusClass(req.status)}`}>{req.status}</span>
        </div>
      </div>
      <div className="cg-request-body">
        <div className="cg-request-category">
          {categoryIcon(req.category)}
          <span>{req.category}</span>
        </div>
        <p className="cg-request-desc">{req.description}</p>
        {req.observation && (
          <span className="cg-observation">
            <MessageSquare size={13} /> {req.observation}
          </span>
        )}
        {req.rejectionReason && (
          <span className="cg-rejection-note">
            <ShieldCheck size={13} /> {req.rejectionReason}
          </span>
        )}
      </div>
      <div className="cg-request-foot">
        <div className="cg-request-actions">
          {nextAction(req)}
          {!isClosedConcierge(req.status) && (
            <button className="button small secondary" onClick={() => setCancelRequestId(req.id)}>
              Cancelar
            </button>
          )}
          <button className="button small secondary" onClick={() => onSelectRequest(req.id)}>
            Ver detalle
          </button>
        </div>
      </div>
    </article>
  );

  const filteredRequests = activeRequests.filter((req) => {
    const matchesSearch = `${req.id} ${req.room} ${req.guest} ${req.category} ${req.description}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesFilter = filter === 'Todos' || req.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (nav === 'Historial')
    return (
      <>
        <div className="panel cg-view">
          <div className="panel-heading">
            <div>
              <h3>Historial de solicitudes</h3>
              <p>Consulta las solicitudes atendidas, completadas o rechazadas.</p>
            </div>
            <button
              className="button small secondary"
              onClick={() => void refreshHistory()}
              disabled={refreshing}
            >
              <LoaderCircle size={14} className={refreshing ? 'rc-refresh-spinner' : undefined} />{' '}
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
          <div className="cg-history-list">
            {completedRequests.length === 0 ? (
              <div className="hk-empty">
                <FileText size={22} />
                <p>Aún no hay solicitudes finalizados</p>
              </div>
            ) : (
              completedRequests.map((req) => (
                <div className="cg-history-row" key={req.id}>
                  <div className="cg-history-info">
                    <strong>
                      #{req.id} · Habitación {req.room}
                    </strong>
                    <span>
                      {req.guest} · {req.category}
                    </span>
                    <small>{req.description}</small>
                  </div>
                  <div className="cg-history-meta">
                    {req.completedAt && (
                      <span>
                        <Clock size={13} /> Completada {req.completedAt}
                      </span>
                    )}
                    <strong className={`status-pill ${statusClass(req.status)}`}>
                      {req.status}
                    </strong>
                  </div>
                  <button
                    className="button small secondary"
                    onClick={() => onSelectRequest(req.id)}
                  >
                    Ver detalle
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        {selectedRequest && (
          <ConciergeRequestModal
            request={selectedRequest}
            onClose={onCloseRequest}
            onUpdateStatus={onUpdateStatus}
            onUpdateObservation={onUpdateObservation}
          />
        )}
      </>
    );

  if (nav === 'Por habitación') {
    const roomGroups = requests.reduce<Record<string, ConciergeRequest[]>>((groups, req) => {
      (groups[req.room] = groups[req.room] ?? []).push(req);
      return groups;
    }, {});
    const sortedRooms = Object.keys(roomGroups).sort((a, b) => Number(a) - Number(b));
    return (
      <div className="panel cg-view">
        <div className="panel-heading">
          <div>
            <h3>Solicitudes por habitación</h3>
            <p>Consulta las necesidades actuales de los huéspedes agrupadas por habitación.</p>
          </div>
        </div>
        <div className="cg-room-group-list">
          {sortedRooms.length === 0 ? (
            <div className="hk-empty">
              <BedDouble size={22} />
              <p>No hay solicitudes registradas</p>
            </div>
          ) : (
            sortedRooms.map((room) => {
              const roomRequests = roomGroups[room];
              const pendingCount = roomRequests.filter((r) => !isClosedConcierge(r.status)).length;
              return (
                <div className="cg-room-group" key={room}>
                  <div className="cg-room-group-head">
                    <div className="cg-room-group-title">
                      <BedDouble size={18} />
                      <div>
                        <strong>Habitación {room}</strong>
                        <span>{roomRequests[0].guest}</span>
                      </div>
                    </div>
                    <div className="cg-room-group-meta">
                      <span className={`status-pill ${pendingCount > 0 ? 'warning' : 'success'}`}>
                        {pendingCount > 0 ? `${pendingCount} activas` : 'Sin pendientes'}
                      </span>
                      <span className="cg-room-count">{roomRequests.length} en total</span>
                    </div>
                  </div>
                  <div className="cg-room-group-items">
                    {roomRequests.map((req) => (
                      <div
                        className="cg-room-group-item"
                        key={req.id}
                        onClick={() => onSelectRequest(req.id)}
                      >
                        <div className="cg-room-group-item-icon">{categoryIcon(req.category)}</div>
                        <div className="cg-room-group-item-info">
                          <strong>{req.category}</strong>
                          <span>{req.description}</span>
                        </div>
                        <span className={`status-pill ${statusClass(req.status)}`}>
                          {req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="cg-layout">
        <div className="panel cg-view">
          <div className="panel-heading">
            <div>
              <h3>Solicitudes activas</h3>
              <p>Gestiona cada solicitud desde su recepción hasta su atención.</p>
            </div>
            <span className="cg-live">
              <i /> Actualizado ahora
            </span>
          </div>
          <div className="toolbar">
            <div className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar solicitud, habitación, huésped..."
              />
            </div>
            <div className="filter-dropdown">
              <button className="filter-button">
                <span>{filter}</span>
                <ChevronDown size={15} />
              </button>
              <div className="filter-menu">
                <button
                  className={filter === 'Todos' ? 'active' : ''}
                  onClick={() => setFilter('Todos')}
                >
                  Todos
                </button>
                <button
                  className={filter === 'Pendiente' ? 'active' : ''}
                  onClick={() => setFilter('Pendiente')}
                >
                  Pendientes
                </button>
                <button
                  className={filter === 'Aceptada' ? 'active' : ''}
                  onClick={() => setFilter('Aceptada')}
                >
                  Aceptadas
                </button>
                <button
                  className={filter === 'En proceso' ? 'active' : ''}
                  onClick={() => setFilter('En proceso')}
                >
                  En proceso
                </button>
              </div>
            </div>
          </div>
          <div className="cg-summary">
            <div>
              <span className="status-pill warning">Pendientes</span>
              <strong>{requests.filter((r) => r.status === 'Pendiente').length}</strong>
            </div>
            <div>
              <span className="status-pill info">En atención</span>
              <strong>
                {requests.filter((r) => ['Aceptada', 'En proceso'].includes(r.status)).length}
              </strong>
            </div>
            <div>
              <span className="status-pill success">Completadas</span>
              <strong>{requests.filter((r) => r.status === 'Completada').length}</strong>
            </div>
          </div>
          <div className="cg-request-list">
            {filteredRequests.length === 0 ? (
              <div className="hk-empty">
                <ClipboardList size={22} />
                <p>No hay solicitudes activas</p>
              </div>
            ) : (
              filteredRequests.map(renderRequest)
            )}
          </div>
        </div>
        <aside className="panel cg-side-panel">
          <div className="panel-heading">
            <div>
              <h3>Turno de Douglas</h3>
              <p>Conserjería · Hotel Aurora</p>
            </div>
            <span className="avatar brown">DG</span>
          </div>
          <div className="cg-shift-card">
            <div>
              <span>Solicitudes del turno</span>
              <strong>{requests.length}</strong>
            </div>
            <div>
              <span>Completadas</span>
              <strong>{requests.filter((r) => r.status === 'Completada').length}</strong>
            </div>
            <div>
              <span>Rechazadas</span>
              <strong>{requests.filter((r) => r.status === 'Rechazada').length}</strong>
            </div>
            <div>
              <span>Canceladas</span>
              <strong>{requests.filter((r) => r.status === 'Cancelada').length}</strong>
            </div>
          </div>
          <div className="cg-legend">
            <strong>Flujo de la solicitud</strong>
            <span>
              <i className="warning" /> Pendiente de aceptación
            </span>
            <span>
              <i className="info" /> Aceptada o en proceso
            </span>
            <span>
              <i className="success" /> Completada
            </span>
            <span>
              <i className="terracotta" /> Rechazada o cancelada
            </span>
          </div>
          <div className="cg-category-breakdown">
            <strong>Solicitudes por categoría</strong>
            {[
              'Transporte',
              'Reservación',
              'Lavandería',
              'Información turística',
              'Servicios especiales',
            ].map((cat) => {
              const count = requests.filter((r) => r.category === cat).length;
              return count > 0 ? (
                <div className="cg-category-row" key={cat}>
                  <span>{cat}</span>
                  <strong>{count}</strong>
                </div>
              ) : null;
            })}
          </div>
        </aside>
      </div>
      {selectedRequest && (
        <ConciergeRequestModal
          request={selectedRequest}
          onClose={onCloseRequest}
          onUpdateStatus={onUpdateStatus}
          onUpdateObservation={onUpdateObservation}
        />
      )}
      {rejectionRequestId !== null && (
        <div className="modal-backdrop" onMouseDown={() => setRejectionRequestId(null)}>
          <div
            className="modal"
            style={{ width: 420 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">RECHAZAR SOLICITUD</p>
                <h2>Indica el motivo</h2>
              </div>
              <button className="icon-btn" onClick={() => setRejectionRequestId(null)}>
                <X size={18} />
              </button>
            </div>
            <p className="login-helper">
              El huésped podrá consultar por qué no fue posible atender su solicitud.
            </p>
            <textarea
              className="cg-rejection-textarea"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Ej. No hay disponibilidad para esta fecha..."
            />
            <div className="modal-foot">
              <button className="button secondary" onClick={() => setRejectionRequestId(null)}>
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={!rejectionReason.trim()}
                onClick={() => {
                  const requestId = rejectionRequestId;
                  onReject(requestId, rejectionReason.trim());
                  setRejectionRequestId(null);
                  setRejectionReason('');
                  onCloseRequest();
                }}
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}
      {cancelRequestId !== null && (
        <div className="modal-backdrop" onMouseDown={() => setCancelRequestId(null)}>
          <div
            className="modal"
            style={{ width: 420 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">CANCELAR SOLICITUD</p>
                <h2>Indica el motivo</h2>
              </div>
              <button className="icon-btn" onClick={() => setCancelRequestId(null)}>
                <X size={18} />
              </button>
            </div>
            <p className="login-helper">
              La solicitud dejará de atenderse y el huésped verá el motivo.
            </p>
            <textarea
              className="cg-rejection-textarea"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Ej. El huésped ya no necesita el servicio..."
            />
            <div className="modal-foot">
              <button className="button secondary" onClick={() => setCancelRequestId(null)}>
                Cerrar
              </button>
              <button
                className="button primary"
                disabled={!cancelReason.trim()}
                onClick={() => {
                  const requestId = cancelRequestId;
                  onCancel(requestId, cancelReason.trim());
                  setCancelRequestId(null);
                  setCancelReason('');
                  onCloseRequest();
                }}
              >
                Confirmar cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConciergeRequestModal({
  request,
  onClose,
  onUpdateStatus,
  onUpdateObservation,
}: {
  request: ConciergeRequest;
  onClose: () => void;
  onUpdateStatus: (id: number, status: ConciergeStatus) => void;
  onUpdateObservation: (id: number, observation: string) => void;
}) {
  const [observation, setObservation] = useState(request.observation);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal cg-detail-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">DETALLE DE SOLICITUD</p>
            <h2>Solicitud #{request.id}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="cg-detail-header">
          <div>
            <strong>Habitación {request.room}</strong>
            <span>
              {request.guest} · recibida {request.time}
            </span>
          </div>
          <span
            className={`status-pill ${request.status === 'Pendiente' ? 'warning' : request.status === 'Completada' ? 'success' : request.status === 'Rechazada' || request.status === 'Cancelada' ? 'terracotta' : 'info'}`}
          >
            {request.status}
          </span>
        </div>
        <div className="cg-detail-meta">
          {request.bookingId && (
            <div>
              <small>Reserva</small>
              <span>{request.bookingId}</span>
            </div>
          )}
          <div>
            <small>Categoría</small>
            <span>{request.category}</span>
          </div>
          <div>
            <small>Solicitada</small>
            <span>
              {request.requestedDate} {request.time}
            </span>
          </div>
          <div>
            <small>Actualizada</small>
            <span>{request.updatedDate}</span>
          </div>
          <div>
            <small>Prioridad</small>
            <span
              className={`status-pill ${request.priority === 'Alta' ? 'warning' : request.priority === 'Media' ? 'info' : 'success'}`}
            >
              {request.priority}
            </span>
          </div>
          <div>
            <small>Responsable</small>
            <span>{request.responsible}</span>
          </div>
          {request.completedAt && (
            <div>
              <small>Completada</small>
              <span>{request.completedAt}</span>
            </div>
          )}
        </div>
        <div className="cg-detail-description">
          <strong>Solicitud del huésped</strong>
          <p>{request.description}</p>
        </div>
        {request.rejectionReason && (
          <div className="cg-detail-rejection">
            <ShieldCheck size={16} />
            <div>
              <strong>
                {request.status === 'Cancelada' ? 'Motivo de cancelación' : 'Motivo de rechazo'}
              </strong>
              <p>{request.rejectionReason}</p>
            </div>
          </div>
        )}
        {/* El backend no permite editar una solicitud cerrada. */}
        {!isClosedConcierge(request.status) && (
          <label className="cg-note-label">
            Observaciones
            <textarea
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Agrega información sobre la atención brindada..."
            />
          </label>
        )}
        <div className="cg-detail-actions">
          {!isClosedConcierge(request.status) && (
            <button
              className="button secondary"
              onClick={() => {
                onUpdateObservation(request.id, observation);
              }}
            >
              Guardar observación
            </button>
          )}
          {request.status === 'Pendiente' && (
            <button
              className="button primary"
              onClick={() => onUpdateStatus(request.id, 'Aceptada')}
            >
              Aceptar solicitud
            </button>
          )}
          {request.status === 'Aceptada' && (
            <button
              className="button primary"
              onClick={() => onUpdateStatus(request.id, 'En proceso')}
            >
              Marcar en proceso
            </button>
          )}
          {request.status === 'En proceso' && (
            <button
              className="button primary"
              onClick={() => onUpdateStatus(request.id, 'Completada')}
            >
              Completar solicitud
            </button>
          )}
          {request.status === 'Completada' && (
            <span className="cg-completed">
              <ShieldCheck size={15} /> Solicitud atendida
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function HousekeepingContent({
  nav,
  rooms,
  requests,
  history,
  defects,
  search,
  setSearch,
  onStartCleaning,
  onFinishCleaning,
  onInspect,
  onChangeStatus,
  onAttendRequest,
  onCompleteRequest,
  onPrepareRequestChecklist,
  onToggleRequestChecklist,
  onCompleteRequestChecklist,
  onToggleChecklist,
  onOpenDetail,
  onOpenDefectModal,
  onOpenStatusModal,
  onSubmitDefect,
  onAction,
  onNavigate,
  detailRoom,
  onCloseDetail,
  hkFilter,
  setHkFilter,
  showStatusModal,
  onCloseStatusModal,
  showDefectModal,
  onCloseDefectModal,
}: {
  nav: string;
  rooms: CleaningRoom[];
  requests: GuestRequest[];
  history: HistoryEntry[];
  defects: DefectReport[];
  search: string;
  setSearch: (value: string) => void;
  onStartCleaning: (id: number) => void;
  onFinishCleaning: (id: number) => Promise<boolean>;
  onInspect: (id: number) => void;
  onChangeStatus: (id: number, status: RoomStatus) => void;
  onAttendRequest: (id: number) => void;
  onCompleteRequest: (id: number) => void;
  onPrepareRequestChecklist: (id: number) => void;
  onToggleRequestChecklist: (id: number, index: number) => void;
  onCompleteRequestChecklist: (id: number) => void;
  onToggleChecklist: (roomId: number, index: number) => void;
  onOpenDetail: (room: CleaningRoom) => void;
  hkFilter: 'Todos' | RoomStatus;
  setHkFilter: (value: 'Todos' | RoomStatus) => void;
  onOpenDefectModal: () => void;
  onOpenStatusModal: (room: CleaningRoom) => void;
  onSubmitDefect: (report: Omit<DefectReport, 'id'>) => void;
  onAction: (message: string) => void;
  onNavigate?: (nav: string) => void;
  detailRoom: CleaningRoom | null;
  onCloseDetail: () => void;
  showStatusModal: CleaningRoom | null;
  onCloseStatusModal: () => void;
  showDefectModal: boolean;
  onCloseDefectModal: () => void;
}) {
  const pending = rooms.filter((r) => r.status === 'Pendiente').length;
  const inProgress = rooms.filter((r) => r.status === 'En proceso').length;
  const completed = rooms.filter((r) => isCleaningDone(r.status)).length;
  const reqPending = requests.filter((r) => r.status === 'Pendiente').length;
  const reqInProgress = requests.filter((r) => r.status === 'En proceso').length;
  const reqCompleted = requests.filter((r) => r.status === 'Completada').length;
  const filteredRooms = rooms.filter((r) => {
    const matchesSearch = `${r.number} ${r.floor} ${r.type} ${r.cleaningType}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesFilter = hkFilter === 'Todos' || r.status === hkFilter;
    return matchesSearch && matchesFilter;
  });

  if (nav === 'Perfil') {
    return (
      <div className="panel" style={{ maxWidth: 540, margin: '0 auto' }}>
        <div className="panel-heading">
          <div>
            <h3>Mi perfil</h3>
            <p>Datos del personal de limpieza</p>
          </div>
        </div>
        <div className="hk-profile">
          <div className="hk-profile-avatar sage">CS</div>
          <div className="hk-profile-info">
            <h4>César Salazar</h4>
            <p>Personal de Limpieza · Hotel Aurora</p>
            <small>Turno: Matutino · 06:00 — 14:00</small>
          </div>
        </div>
        <div className="hk-profile-stats">
          <div>
            <span>Habitaciones hoy</span>
            <strong>{pending + inProgress + completed}</strong>
          </div>
          <div>
            <span>Completadas</span>
            <strong>{completed}</strong>
          </div>
          <div>
            <span>En proceso</span>
            <strong>{inProgress}</strong>
          </div>
        </div>
        <div className="hk-profile-detail">
          <div>
            <span>Rol</span>
            <strong>Personal de Limpieza</strong>
          </div>
          <div>
            <span>ID empleado</span>
            <strong>HK-0042</strong>
          </div>
          <div>
            <span>Sede</span>
            <strong>Hotel Aurora · Centro</strong>
          </div>
        </div>
      </div>
    );
  }

  if (nav === 'Historial') {
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Historial de tareas</h3>
            <p>Tareas y solicitudes completadas</p>
          </div>
        </div>
        <div className="hk-history-list">
          {history.length === 0 && (
            <div className="hk-empty">
              <FileText size={22} />
              <p>Aún no hay tareas completadas</p>
            </div>
          )}
          {history.map((entry) => (
            <div className="hk-history-row" key={entry.id}>
              <div className="hk-history-info">
                <strong>Habitación {entry.room}</strong>
                <span>{entry.taskType}</span>
                <small>{entry.date}</small>
              </div>
              <div className="hk-history-time">
                <span>
                  <Clock size={13} /> {entry.startTime} → {entry.endTime}
                </span>
                <strong>{entry.duration}</strong>
              </div>
              <span className="status-pill success">{entry.status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (nav === 'Solicitudes') {
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Solicitudes de huéspedes</h3>
            <p>Solicitudes relacionadas con limpieza y amenidades</p>
          </div>
        </div>
        <div className="hk-req-summary">
          <div className="hk-summary-card">
            <span className="status-pill warning">Pendientes</span>
            <strong>{reqPending}</strong>
          </div>
          <div className="hk-summary-card">
            <span className="status-pill info">En proceso</span>
            <strong>{reqInProgress}</strong>
          </div>
          <div className="hk-summary-card">
            <span className="status-pill success">Completadas</span>
            <strong>{reqCompleted}</strong>
          </div>
        </div>
        <div className="hk-req-list">
          {requests.length === 0 && (
            <div className="hk-empty">
              <ClipboardList size={22} />
              <p>No hay solicitudes pendientes</p>
            </div>
          )}
          {requests.map((req) => (
            <div
              className={`hk-req-row ${req.status === 'Completada' ? 'completed' : ''}`}
              key={req.id}
            >
              <div className="hk-req-info">
                <strong>Habitación {req.room}</strong>
                <span>{req.request}</span>
              </div>
              <span className="hk-req-time">{req.time}</span>
              {req.priority === 'Alta' && (
                <span className="status-pill warning">Prioridad alta</span>
              )}
              {req.priority === 'Media' && (
                <span className="status-pill info">Prioridad media</span>
              )}
              {req.priority === 'Baja' && (
                <span className="status-pill success">Prioridad baja</span>
              )}
              <span
                className={`status-pill ${req.status === 'Pendiente' ? 'warning' : req.status === 'En proceso' ? 'info' : req.status === 'Rechazada' ? 'terracotta' : 'success'}`}
              >
                {req.status}
              </span>
              {req.status === 'En proceso' && !isGuestItemRequest(req) && (
                <div className="hk-request-checklist">
                  {!req.checklist ? (
                    <>
                      <p>Esta solicitud todavía no tiene checklist.</p>
                      <button
                        className="button small secondary"
                        onClick={() => onPrepareRequestChecklist(req.id)}
                      >
                        Preparar checklist
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="hk-request-checklist-heading">
                        <strong>Checklist de limpieza</strong>
                        <span>
                          {req.checklist.items.filter((item) => item.done).length}/
                          {req.checklist.items.length}
                        </span>
                      </div>
                      <div className="hk-request-checklist-items">
                        {req.checklist.items.map((item, index) => (
                          <label key={item.id ?? `${item.position}-${item.label}`}>
                            <input
                              type="checkbox"
                              checked={item.done}
                              disabled={req.checklist?.status === 'completed'}
                              onChange={() => onToggleRequestChecklist(req.id, index)}
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                      {req.checklist.status !== 'completed' && (
                        <button
                          className="button small secondary"
                          disabled={
                            req.checklist.items.length === 0 ||
                            req.checklist.items.some((item) => !item.done)
                          }
                          onClick={() => onCompleteRequestChecklist(req.id)}
                        >
                          Completar checklist
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              {req.status === 'Pendiente' && (
                <button className="button small primary" onClick={() => onAttendRequest(req.id)}>
                  Atender solicitud
                </button>
              )}
              {req.status === 'En proceso' && (
                <button
                  className="button small primary"
                  disabled={!isGuestItemRequest(req) && req.checklist?.status !== 'completed'}
                  onClick={() => onCompleteRequest(req.id)}
                >
                  Completar solicitud
                </button>
              )}
              {req.status === 'Completada' && <span className="hk-done-label">Atendida</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (nav === 'Habitaciones') {
    return (
      <>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Habitaciones pendientes</h3>
              <p>Gestiona el estado de limpieza de cada habitación</p>
            </div>
          </div>
          <div className="toolbar">
            <div className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar habitación, piso, tipo..."
              />
            </div>
            <div className="filter-dropdown">
              <button className="filter-button">
                <span>{hkFilter}</span>
                <ChevronDown size={15} />
              </button>
              <div className="filter-menu">
                <button
                  className={hkFilter === 'Todos' ? 'active' : ''}
                  onClick={() => setHkFilter('Todos')}
                >
                  Todos
                </button>
                <button
                  className={hkFilter === 'Pendiente' ? 'active' : ''}
                  onClick={() => setHkFilter('Pendiente')}
                >
                  Pendientes
                </button>
                <button
                  className={hkFilter === 'En proceso' ? 'active' : ''}
                  onClick={() => setHkFilter('En proceso')}
                >
                  En proceso
                </button>
                <button
                  className={hkFilter === 'Completada' ? 'active' : ''}
                  onClick={() => setHkFilter('Completada')}
                >
                  Completadas
                </button>
                <button
                  className={hkFilter === 'Inspeccionada' ? 'active' : ''}
                  onClick={() => setHkFilter('Inspeccionada')}
                >
                  Inspeccionadas
                </button>
              </div>
            </div>
          </div>
          <div className="hk-room-grid">
            {filteredRooms.length === 0 && (
              <div className="hk-empty">
                <Search size={22} />
                <p>No se encontraron habitaciones</p>
              </div>
            )}
            {filteredRooms.map((room) => (
              <div className={`hk-room-card priority-${room.priority.toLowerCase()}`} key={room.id}>
                <div className="hk-room-head">
                  <div>
                    <strong>Habitación {room.number}</strong>
                    <span>
                      {room.floor} · {room.type}
                    </span>
                  </div>
                  <span
                    className={`status-pill ${room.status === 'Pendiente' ? 'warning' : room.status === 'En proceso' ? 'info' : 'success'}`}
                  >
                    {room.status}
                  </span>
                </div>
                <div className="hk-room-meta">
                  <div>
                    <small>Tipo de limpieza</small>
                    <span>{room.cleaningType}</span>
                  </div>
                  <div>
                    <small>Prioridad</small>
                    <span>{room.priority}</span>
                  </div>
                  {room.startTime && (
                    <div>
                      <small>Inicio</small>
                      <span>{room.startTime}</span>
                    </div>
                  )}
                  {room.endTime && (
                    <div>
                      <small>Fin</small>
                      <span>{room.endTime}</span>
                    </div>
                  )}
                  {room.duration && (
                    <div>
                      <small>Duración</small>
                      <span>{room.duration}</span>
                    </div>
                  )}
                </div>
                <div className="hk-room-actions">
                  {room.status === 'Pendiente' && (
                    <button
                      className="button small primary"
                      onClick={() => onStartCleaning(room.id)}
                    >
                      Iniciar limpieza
                    </button>
                  )}
                  {room.status === 'En proceso' && (
                    <button
                      className="button small primary"
                      onClick={() => onFinishCleaning(room.id)}
                    >
                      Finalizar limpieza
                    </button>
                  )}
                  {room.status === 'Completada' && (
                    <button className="button small primary" onClick={() => onInspect(room.id)}>
                      Inspeccionar
                    </button>
                  )}
                  {room.status === 'Inspeccionada' && (
                    <span className="hk-done-label">Habitación inspeccionada</span>
                  )}
                  <button className="button small secondary" onClick={() => onOpenDetail(room)}>
                    Ver detalle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        {detailRoom && (
          <RoomDetailModal
            room={detailRoom}
            onClose={onCloseDetail}
            onStartCleaning={onStartCleaning}
            onFinishCleaning={onFinishCleaning}
            onInspect={onInspect}
            onToggleChecklist={onToggleChecklist}
            onOpenDefectModal={onOpenDefectModal}
            onOpenStatusModal={(r) => {
              onCloseDetail();
              onOpenStatusModal(r);
            }}
            onAction={onAction}
          />
        )}
        {showStatusModal && (
          <StatusModal
            room={showStatusModal}
            onClose={onCloseStatusModal}
            onChangeStatus={onChangeStatus}
          />
        )}
        {showDefectModal && (
          <DefectModal onClose={onCloseDefectModal} onSubmit={onSubmitDefect} rooms={rooms} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="hk-dashboard-grid">
        <div className="panel main-panel">
          <div className="panel-heading">
            <div>
              <h3>Actividad de hoy</h3>
              <p>Tareas de limpieza que necesitan tu atención</p>
            </div>
            <button
              className="text-button"
              onClick={() => {
                if (onNavigate) onNavigate('Habitaciones');
                else onAction('Habitaciones seleccionado');
              }}
            >
              Ver todo <ArrowRight size={15} />
            </button>
          </div>
          <div className="toolbar">
            <div className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar habitación o tarea..."
              />
            </div>
          </div>
          <div className="task-list">
            {rooms.filter((r) => !isCleaningDone(r.status)).length === 0 &&
              requests.filter(isOpenGuestRequest).length === 0 && (
                <div className="hk-empty">
                  <Sparkles size={22} />
                  <p>Toda la jornada está al día</p>
                </div>
              )}
            {rooms
              .filter((r) => !isCleaningDone(r.status))
              .map((room) => (
                <div className="task-row" key={room.id}>
                  <div className="task-status-dot" />
                  <div className="task-info">
                    <strong>{room.cleaningType}</strong>
                    <span>
                      Habitación {room.number} · {room.floor} · {room.type}
                    </span>
                  </div>
                  <span className="task-time">{room.startTime ?? '—'}</span>
                  <span
                    className={`status-pill ${room.status === 'Pendiente' ? 'warning' : 'info'}`}
                  >
                    {room.status}
                  </span>
                  {room.status === 'Pendiente' && (
                    <button
                      className="button small primary"
                      onClick={() => onStartCleaning(room.id)}
                    >
                      Iniciar limpieza
                    </button>
                  )}
                  {room.status === 'En proceso' && (
                    <button
                      className="button small primary"
                      onClick={() => onFinishCleaning(room.id)}
                    >
                      Finalizar
                    </button>
                  )}
                </div>
              ))}
            {requests.filter(isOpenGuestRequest).map((req) => (
              <div className="task-row" key={req.id}>
                <div className="task-status-dot" />
                <div className="task-info">
                  <strong>{req.request}</strong>
                  <span>Habitación {req.room}</span>
                </div>
                <span className="task-time">{req.time}</span>
                <span className={`status-pill ${req.status === 'Pendiente' ? 'warning' : 'info'}`}>
                  {req.status}
                </span>
                {req.status === 'Pendiente' && (
                  <button className="button small primary" onClick={() => onAttendRequest(req.id)}>
                    Atender
                  </button>
                )}
                {req.status === 'En proceso' && (
                  <button
                    className="button small primary"
                    onClick={() => onCompleteRequest(req.id)}
                  >
                    Completar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="panel side-panel">
          <div className="panel-heading">
            <div>
              <h3>Resumen de limpieza</h3>
              <p>Estado actual de tu jornada</p>
            </div>
          </div>
          <div className="hk-summary-block">
            <div className="hk-summary-item">
              <span className="hk-summary-dot warning" />
              <div>
                <strong>{pending}</strong>
                <small>Habitaciones pendientes</small>
              </div>
            </div>
            <div className="hk-summary-item">
              <span className="hk-summary-dot info" />
              <div>
                <strong>{inProgress}</strong>
                <small>En proceso</small>
              </div>
            </div>
            <div className="hk-summary-item">
              <span className="hk-summary-dot success" />
              <div>
                <strong>{completed}</strong>
                <small>Completadas</small>
              </div>
            </div>
          </div>
          <div className="hk-summary-divider" />
          <div className="hk-summary-block">
            <div className="hk-summary-item">
              <span className="hk-summary-dot warning" />
              <div>
                <strong>{reqPending}</strong>
                <small>Solicitudes pendientes</small>
              </div>
            </div>
            <div className="hk-summary-item">
              <span className="hk-summary-dot info" />
              <div>
                <strong>{reqInProgress}</strong>
                <small>Solicitudes en proceso</small>
              </div>
            </div>
            <div className="hk-summary-item">
              <span className="hk-summary-dot success" />
              <div>
                <strong>{reqCompleted}</strong>
                <small>Solicitudes completadas</small>
              </div>
            </div>
          </div>
          <div className="hk-summary-divider" />
          <div className="hk-summary-block">
            <div className="hk-summary-item">
              <span className="hk-summary-dot terracotta" />
              <div>
                <strong>{defects.length}</strong>
                <small>Desperfectos reportados</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      {detailRoom && (
        <RoomDetailModal
          room={detailRoom}
          onClose={onCloseDetail}
          onStartCleaning={onStartCleaning}
          onFinishCleaning={onFinishCleaning}
          onInspect={onInspect}
          onToggleChecklist={onToggleChecklist}
          onOpenDefectModal={onOpenDefectModal}
          onOpenStatusModal={(r) => {
            onCloseDetail();
            onOpenStatusModal(r);
          }}
          onAction={onAction}
        />
      )}
      {showStatusModal && (
        <StatusModal
          room={showStatusModal}
          onClose={onCloseStatusModal}
          onChangeStatus={onChangeStatus}
        />
      )}
      {showDefectModal && (
        <DefectModal onClose={onCloseDefectModal} onSubmit={onSubmitDefect} rooms={rooms} />
      )}
    </>
  );
}

function RoomDetailModal({
  room,
  onClose,
  onStartCleaning,
  onFinishCleaning,
  onInspect,
  onToggleChecklist,
  onOpenDefectModal,
  onOpenStatusModal,
  onAction,
}: {
  room: CleaningRoom;
  onClose: () => void;
  onStartCleaning: (id: number) => void;
  onFinishCleaning: (id: number) => Promise<boolean>;
  onInspect: (id: number) => void;
  onToggleChecklist: (roomId: number, index: number) => void;
  onOpenDefectModal: () => void;
  onOpenStatusModal: (room: CleaningRoom) => void;
  onAction: (message: string) => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 460 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">DETALLE DE HABITACIÓN</p>
            <h2>Habitación {room.number}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="hk-detail-meta">
          <div>
            <small>Piso</small>
            <span>{room.floor}</span>
          </div>
          <div>
            <small>Tipo</small>
            <span>{room.type}</span>
          </div>
          <div>
            <small>Limpieza</small>
            <span>{room.cleaningType}</span>
          </div>
          <div>
            <small>Prioridad</small>
            <span>{room.priority}</span>
          </div>
          <div>
            <small>Estado</small>
            <span
              className={`status-pill ${room.status === 'Pendiente' ? 'warning' : room.status === 'En proceso' ? 'info' : 'success'}`}
            >
              {room.status}
            </span>
          </div>
          {room.startTime && (
            <div>
              <small>Inicio</small>
              <span>{room.startTime}</span>
            </div>
          )}
        </div>
        <div className="hk-detail-section">
          <h4>Checklist de limpieza</h4>
          <div className="hk-checklist-progress">
            <div className="hk-checklist-bar">
              <i
                style={{
                  width: `${(room.checklist.filter((c) => c.done).length / room.checklist.length) * 100}%`,
                }}
              />
            </div>
            <span className="hk-checklist-count">
              {room.checklist.filter((c) => c.done).length}/{room.checklist.length}
            </span>
          </div>
          <div className="hk-checklist">
            {room.checklist.map((item, i) => (
              <button
                className={`hk-check-item ${item.done ? 'done' : ''}`}
                key={i}
                onClick={() => onToggleChecklist(room.id, i)}
              >
                <span className="hk-check-box">{item.done && '✓'}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="hk-detail-actions">
          {room.status === 'Pendiente' && (
            <button
              className="button primary"
              onClick={() => {
                onStartCleaning(room.id);
                onClose();
              }}
            >
              Iniciar limpieza
            </button>
          )}
          {room.status === 'En proceso' && (
            <button
              className="button primary"
              onClick={async () => {
                if (await onFinishCleaning(room.id)) onClose();
              }}
            >
              Finalizar limpieza
            </button>
          )}
          {room.status === 'Completada' && (
            <button
              className="button primary"
              onClick={() => {
                onInspect(room.id);
                onClose();
              }}
            >
              Inspeccionar
            </button>
          )}
          {room.status === 'Inspeccionada' && (
            <span className="hk-done-label">Habitación inspeccionada</span>
          )}
          <button
            className="button secondary"
            onClick={() => {
              onClose();
              onOpenStatusModal(room);
            }}
          >
            Cambiar estado
          </button>
          <button
            className="button secondary"
            onClick={() => {
              onClose();
              onOpenDefectModal();
            }}
          >
            Reportar desperfecto
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusModal({
  room,
  onClose,
  onChangeStatus,
}: {
  room: CleaningRoom;
  onClose: () => void;
  onChangeStatus: (id: number, status: RoomStatus) => void;
}) {
  const nextStatusOptions: Record<
    RoomHousekeepingStatus,
    { status: RoomStatus; tone: 'info' | 'success'; note?: string }[]
  > = {
    dirty: [{ status: 'En proceso', tone: 'info' }],
    cleaning: [{ status: 'Completada', tone: 'success' }],
    clean: [{ status: 'Inspeccionada', tone: 'success' }],
    inspected: [{ status: 'Completada', tone: 'success', note: 'Revertir inspección' }],
  };
  const nextStatuses = nextStatusOptions[room.housekeepingStatus];

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 360 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">CAMBIAR ESTADO</p>
            <h2>Habitación {room.number}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="login-helper">
          {room.housekeepingStatus === 'inspected'
            ? 'Puedes regresar la habitación a Completada si necesitas corregir la inspección.'
            : 'Selecciona el siguiente estado permitido en el flujo de limpieza.'}
        </p>
        <div className="hk-status-options">
          {nextStatuses.map(({ status, tone, note }) => (
            <button
              className="hk-status-option"
              key={status}
              onClick={() => onChangeStatus(room.id, status)}
            >
              <span className={`hk-summary-dot ${tone}`} />
              <span>{status}</span>
              {note && <small>{note}</small>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DefectModal({
  onClose,
  onSubmit,
  rooms,
}: {
  onClose: () => void;
  onSubmit: (report: Omit<DefectReport, 'id'>) => void;
  rooms: CleaningRoom[];
}) {
  const [room, setRoom] = useState(rooms[0]?.number ?? '');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('');
  const [observation, setObservation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const handleSubmit = () => {
    const e: Record<string, string> = {};
    if (!room) e.room = 'Selecciona una habitación';
    if (!category) e.category = 'Selecciona una categoría';
    if (!description.trim()) e.description = 'La descripción es obligatoria';
    if (!priority) e.priority = 'Selecciona una prioridad';
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    onSubmit({ room, category, description: description.trim(), priority, observation });
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 440 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">REPORTAR DESPERFECTO</p>
            <h2>Reportar problema</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label className="hk-form-label">
          Habitación
          <select className="hk-form-select" value={room} onChange={(e) => setRoom(e.target.value)}>
            {rooms.map((r) => (
              <option key={r.id} value={r.number}>
                {r.number} · {r.floor}
              </option>
            ))}
          </select>
        </label>
        <label className="hk-form-label">
          Categoría
          <select
            className={`hk-form-select ${errors.category ? 'error' : ''}`}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setErrors((p) => ({ ...p, category: '' }));
            }}
          >
            <option value="">Selecciona...</option>
            <option>Plomería</option>
            <option>Eléctrico</option>
            <option>Mobiliario</option>
            <option>Climatización</option>
            <option>Otro</option>
          </select>
          {errors.category && <span className="hk-form-error">{errors.category}</span>}
        </label>
        <label className="hk-form-label">
          Descripción
          <textarea
            className={`hk-form-textarea ${errors.description ? 'error' : ''}`}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors((p) => ({ ...p, description: '' }));
            }}
            placeholder="Describe el problema encontrado..."
          />
          {errors.description && <span className="hk-form-error">{errors.description}</span>}
        </label>
        <label className="hk-form-label">
          Prioridad
          <select
            className={`hk-form-select ${errors.priority ? 'error' : ''}`}
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setErrors((p) => ({ ...p, priority: '' }));
            }}
          >
            <option value="">Selecciona...</option>
            <option>Baja</option>
            <option>Media</option>
            <option>Alta</option>
            <option>Urgente</option>
          </select>
          {errors.priority && <span className="hk-form-error">{errors.priority}</span>}
        </label>
        <label className="hk-form-label">
          Observación
          <textarea
            className="hk-form-textarea"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Notas adicionales (opcional)..."
          />
        </label>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" onClick={handleSubmit}>
            Enviar reporte <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

type ReservationStep = 'guest' | 'payment' | 'confirmation';
type RoomDetail = {
  name: string;
  detail: string;
  price: number;
  tag: string;
  image: string;
  features: string[];
  maxGuests: number;
  gallery: string[];
  description: string;
  size: string;
  bed: string;
};

function VisitorScreen({
  onOpenAuth,
  onRegister,
  onAction,
}: {
  onOpenAuth: () => void;
  onRegister: () => void;
  onAction: (message: string) => void;
}) {
  const [checkIn, setCheckIn] = useState('2024-08-25');
  const [checkOut, setCheckOut] = useState('2024-08-28');
  const [guests, setGuests] = useState('2 adultos · 1 habitación');
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [tab, setTab] = useState<'rooms' | 'amenities' | 'promos' | 'policies'>('rooms');
  const [copiedCode, setCopiedCode] = useState('');
  const [detailRoom, setDetailRoom] = useState<RoomDetail | null>(null);
  const [detailGalleryIdx, setDetailGalleryIdx] = useState(0);
  const [reservingRoom, setReservingRoom] = useState<RoomDetail | null>(null);
  const [resStep, setResStep] = useState<ReservationStep>('guest');
  const [resData, setResData] = useState({
    name: '',
    email: '',
    phone: '',
    card: '',
    cardName: '',
    cardExp: '',
    cardCvc: '',
    paymentMethod: 'card',
  });
  const [resErrors, setResErrors] = useState<Record<string, string>>({});

  const rooms: RoomDetail[] = [
    {
      name: 'Habitación Estándar',
      detail: '1 cama king · 2 huéspedes · 28 m²',
      price: 1850,
      tag: 'Mejor precio',
      image:
        'https://images.pexels.com/photos/6434592/pexels-photo-6434592.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      features: [
        'Cama king',
        'Wi-Fi gratis',
        'Desayuno incluido',
        'TV 43"',
        'Aire acondicionado',
        '28 m²',
      ],
      maxGuests: 2,
      size: '28 m²',
      bed: '1 cama king',
      description:
        'Una habitación acogedora y funcional, ideal para viajeros que buscan comodidad sin renunciar a la elegancia. Cuenta con todas las comodidades modernas para una estancia placentera.',
      gallery: [
        'https://images.pexels.com/photos/6434592/pexels-photo-6434592.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        'https://images.pexels.com/photos/33072150/pexels-photo-33072150.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        'https://images.pexels.com/photos/16113326/pexels-photo-16113326.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      ],
    },
    {
      name: 'Habitación Deluxe',
      detail: '1 cama king · 2 huéspedes · 36 m²',
      price: 2450,
      tag: 'Más reservada',
      image:
        'https://images.pexels.com/photos/2736384/pexels-photo-2736384.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      features: [
        'Cama king',
        'Balcón privado',
        'Wi-Fi gratis',
        'Desayuno incluido',
        'TV 50"',
        'Minibar',
        '36 m²',
      ],
      maxGuests: 2,
      size: '36 m²',
      bed: '1 cama king',
      description:
        'Amplia y luminosa, con balcón privado y vistas a la ciudad. Perfecta para quienes disfrutan de un espacio extra con detalles de diseño y confort superior.',
      gallery: [
        'https://images.pexels.com/photos/2736384/pexels-photo-2736384.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        'https://images.pexels.com/photos/36331296/pexels-photo-36331296.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        'https://images.pexels.com/photos/7166637/pexels-photo-7166637.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      ],
    },
    {
      name: 'Suite Aurora',
      detail: '1 cama king · 4 huéspedes · 58 m²',
      price: 3900,
      tag: 'Experiencia premium',
      image:
        'https://images.pexels.com/photos/8082217/pexels-photo-8082217.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      features: [
        'Cama king',
        'Sala de estar',
        'Jacuzzi',
        'Wi-Fi gratis',
        'Desayuno incluido',
        'TV 55"',
        'Minibar premium',
        '58 m²',
      ],
      maxGuests: 4,
      size: '58 m²',
      bed: '1 cama king + sofá cama',
      description:
        'Nuestra suite más exclusiva, con sala de estar independiente, jacuzzi privado y acabados de lujo. Diseñada para una experiencia de hospedaje inolvidable, ideal para familias o estancias especiales.',
      gallery: [
        'https://images.pexels.com/photos/8082217/pexels-photo-8082217.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        'https://images.pexels.com/photos/29000314/pexels-photo-29000314.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        'https://images.pexels.com/photos/8146150/pexels-photo-8146150.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      ],
    },
  ];

  const guestCount = parseInt(guests) || 2;
  const nights = calculateNights(toDomainCalendarDate(checkIn), toDomainCalendarDate(checkOut));
  const availableRooms = rooms.filter((r) => r.maxGuests >= guestCount);

  const handleSearch = () => {
    if (!checkIn || !checkOut) {
      setSearchError('Selecciona las fechas de entrada y salida');
      return;
    }
    if (nights <= 0) {
      setSearchError('La fecha de salida debe ser posterior a la de entrada');
      return;
    }
    setSearchError('');
    setSearched(true);
    setTab('rooms');
    onAction(`Disponibilidad consultada del ${checkIn} al ${checkOut}`);
  };

  const openDetail = (room: RoomDetail) => {
    setDetailRoom(room);
    setDetailGalleryIdx(0);
  };
  const closeDetail = () => setDetailRoom(null);

  const openReservation = (room: RoomDetail) => {
    setReservingRoom(room);
    setResStep('guest');
    setResErrors({});
  };
  const closeReservation = () => {
    setReservingRoom(null);
    setResStep('guest');
    setResData({
      name: '',
      email: '',
      phone: '',
      card: '',
      cardName: '',
      cardExp: '',
      cardCvc: '',
      paymentMethod: 'card',
    });
    setResErrors({});
  };

  const validateGuest = () => {
    const e: Record<string, string> = {};
    if (!resData.name.trim()) e.name = 'Ingresa tu nombre completo';
    if (!resData.email.trim()) e.email = 'Ingresa tu correo electrónico';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resData.email))
      e.email = 'Ingresa un correo válido';
    if (!resData.phone.trim()) e.phone = 'Ingresa tu teléfono';
    setResErrors(e);
    return Object.keys(e).length === 0;
  };

  const validatePayment = () => {
    if (resData.paymentMethod === 'transfer') return true;
    const e: Record<string, string> = {};
    if (!resData.card.trim()) e.card = 'Ingresa el número de tarjeta';
    else if (resData.card.replace(/\s/g, '').length < 15) e.card = 'Número de tarjeta incompleto';
    if (!resData.cardName.trim()) e.cardName = 'Ingresa el nombre del titular';
    if (!resData.cardExp.trim()) e.cardExp = 'MM/AA';
    if (!resData.cardCvc.trim()) e.cardCvc = 'CVC';
    setResErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNextStep = () => {
    if (resStep === 'guest') {
      if (validateGuest()) setResStep('payment');
    } else if (resStep === 'payment') {
      if (validatePayment()) {
        setResStep('confirmation');
        onAction('Reserva confirmada');
      }
    }
  };

  const reservationTotal = reservingRoom ? reservingRoom.price * Math.max(nights, 1) : 0;

  const amenities = [
    {
      icon: Sparkles,
      title: 'Desayuno buffet',
      desc: 'Sabores locales cada mañana',
      image:
        'https://images.pexels.com/photos/33674440/pexels-photo-33674440.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    },
    {
      icon: Waves,
      title: 'Piscina climatizada',
      desc: 'Relajación durante todo el año',
      image:
        'https://images.pexels.com/photos/27274134/pexels-photo-27274134.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    },
    {
      icon: Utensils,
      title: 'Restaurante gourmet',
      desc: 'Cocina de autor con ingredientes locales',
      image:
        'https://images.pexels.com/photos/28999503/pexels-photo-28999503.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    },
    {
      icon: Dumbbell,
      title: 'Wellness & gimnasio',
      desc: 'Equipamiento moderno y clases guiadas',
      image:
        'https://images.pexels.com/photos/7222170/pexels-photo-7222170.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    },
    {
      icon: Wifi,
      title: 'Wi-Fi de alta velocidad',
      desc: 'Conexión en todo el hotel',
      image:
        'https://images.pexels.com/photos/7821349/pexels-photo-7821349.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    },
    {
      icon: Headphones,
      title: 'Atención 24/7',
      desc: 'Siempre estamos para ti',
      image:
        'https://images.pexels.com/photos/14036253/pexels-photo-14036253.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    },
  ];

  const promos = [
    {
      title: 'Estancia extendida',
      desc: '15% de descuento en estancias de 4 noches o más',
      code: 'AURORA15',
      icon: Percent,
      tone: 'gold',
      image:
        'https://images.pexels.com/photos/2725675/pexels-photo-2725675.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    },
    {
      title: 'Escapada romántica',
      desc: 'Cena para dos + botella de vino + decoración floral',
      code: 'ROMANCE',
      icon: Gift,
      tone: 'terracotta',
      image:
        'https://images.pexels.com/photos/24433378/pexels-photo-24433378.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    },
    {
      title: 'Fin de semana',
      desc: '10% de descuento en reservas de viernes a domingo',
      code: 'WEEKEND10',
      icon: CalendarDays,
      tone: 'info',
      image:
        'https://images.pexels.com/photos/3011575/pexels-photo-3011575.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    },
    {
      title: 'Reserva anticipada',
      desc: '12% de descuento reservando 30 días antes',
      code: 'EARLY12',
      icon: Star,
      tone: 'success',
      image:
        'https://images.pexels.com/photos/8134808/pexels-photo-8134808.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    },
  ];

  const policies = [
    {
      icon: CalendarDays,
      title: 'Check-in y check-out',
      desc: 'El check-in es a partir de las 15:00 y el check-out antes de las 12:00. Sujeto a disponibilidad.',
      tone: 'gold',
    },
    {
      icon: ShieldCheck,
      title: 'Cancelación flexible',
      desc: 'Cancelación gratuita hasta 48 horas antes de la fecha de llegada. Después de ese plazo se cobrará la primera noche.',
      tone: 'info',
    },
    {
      icon: Wallet,
      title: 'Depósito y pagos',
      desc: 'Se requiere depósito de garantía equivalente a una noche. Aceptamos efectivo, tarjeta y transferencia.',
      tone: 'success',
    },
    {
      icon: Users,
      title: 'Niños y acompañantes',
      desc: 'Menores de 12 años se hospedan gratis compartiendo cama con sus padres. Capacidad máxima según tipo de habitación.',
      tone: 'terracotta',
    },
    {
      icon: Activity,
      title: 'Mascotas',
      desc: 'Permitimos mascotas pequeñas previa solicitud. Sujeto a cargo adicional de limpieza de $250 por estancia.',
      tone: 'brown',
    },
    {
      icon: Headphones,
      title: 'Atención 24/7',
      desc: 'Nuestro equipo de recepción está disponible las 24 horas para cualquier necesidad durante tu estancia.',
      tone: 'cream',
    },
  ];

  const experienceImages = [
    'https://images.pexels.com/photos/9119625/pexels-photo-9119625.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/14036253/pexels-photo-14036253.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/7222168/pexels-photo-7222168.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/24433378/pexels-photo-24433378.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/3011575/pexels-photo-3011575.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/6466301/pexels-photo-6466301.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  ];

  const tabs = [
    { id: 'rooms' as const, label: 'Habitaciones', icon: BedDouble },
    { id: 'amenities' as const, label: 'Amenidades', icon: Sparkles },
    { id: 'promos' as const, label: 'Promociones', icon: Percent },
    { id: 'policies' as const, label: 'Políticas', icon: ShieldCheck },
  ];

  return (
    <div className="visitor-page">
      <header className="visitor-header">
        <div className="brand visitor-brand">
          <span className="brand-mark">
            <Sparkles size={19} />
          </span>
          <span>
            AURORA <small>HOTEL & RESORT</small>
          </span>
        </div>
        <nav className="visitor-tabs">
          {tabs.map((t) => {
            const TabIcon = t.icon;
            return (
              <button
                key={t.id}
                className={tab === t.id ? 'visitor-tab active' : 'visitor-tab'}
                onClick={() => setTab(t.id)}
              >
                <TabIcon size={15} /> <span className="visitor-tab-label">{t.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="visitor-auth">
          <button className="visitor-link" onClick={onOpenAuth}>
            Iniciar sesión
          </button>
          <button className="button primary small" onClick={onRegister}>
            Registrarse
          </button>
        </div>
      </header>
      <section className="visitor-hero">
        <div
          className="visitor-hero-bg"
          style={{
            backgroundImage:
              'url(https://images.pexels.com/photos/9119622/pexels-photo-9119622.jpeg?auto=compress&cs=tinysrgb&h=650&w=940)',
          }}
        />
        <div className="visitor-hero-overlay" />
        <div className="visitor-hero-copy">
          <p className="eyebrow">HOSPITALIDAD QUE SE SIENTE</p>
          <h1>
            Tu próxima estancia
            <br />
            <em>comienza aquí.</em>
          </h1>
          <p>
            Descansa, descubre y déjanos cuidar cada detalle. Encuentra el espacio perfecto para tu
            próxima visita a Hotel Aurora.
          </p>
          <div className="hero-stats">
            <span>
              <strong>4.9</strong>
              <small>Valoración de huéspedes</small>
            </span>
            <span>
              <strong>24/7</strong>
              <small>Atención personalizada</small>
            </span>
            <span>
              <strong>+12</strong>
              <small>Amenidades incluidas</small>
            </span>
          </div>
        </div>
        <div className="hero-orbit">
          <div className="orbit-card">
            <span className="status-pill success">Hotel Aurora · Centro</span>
            <h3>
              Un refugio
              <br />
              <em>en la ciudad.</em>
            </h3>
            <p>Momentos que se quedan contigo.</p>
            <div className="orbit-line">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>
      <section className="search-panel">
        <div className="search-title">
          <CalendarDays size={20} />
          <div>
            <strong>Encuentra tu habitación</strong>
            <span>Consulta disponibilidad y tarifas en segundos</span>
          </div>
        </div>
        <div className="search-fields">
          <label>
            <span>Entrada</span>
            <input
              type="date"
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
            />
          </label>
          <label>
            <span>Salida</span>
            <input
              type="date"
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
            />
          </label>
          <label>
            <span>Huéspedes</span>
            <select value={guests} onChange={(event) => setGuests(event.target.value)}>
              <option>2 adultos · 1 habitación</option>
              <option>1 adulto · 1 habitación</option>
              <option>2 adultos · 2 habitaciones</option>
              <option>2 adultos · 2 niños · 1 habitación</option>
              <option>4 adultos · 1 habitación</option>
            </select>
          </label>
        </div>
        <button className="button primary search-button" onClick={handleSearch}>
          Buscar disponibilidad <ArrowRight size={16} />
        </button>
      </section>
      {searchError && (
        <div className="search-error">
          <TriangleAlert size={15} /> {searchError}
        </div>
      )}
      <main className="visitor-content">
        {tab === 'rooms' && (
          <section className="visitor-section visitor-tab-content">
            <div className="visitor-section-head">
              <div>
                <p className="eyebrow">ELIGE TU ESPACIO</p>
                <h2>
                  Habitaciones pensadas
                  <br />
                  para ti
                </h2>
              </div>
              {searched && (
                <div className="availability-note">
                  <span className="room-dot available" />
                  Disponibilidad actualizada
                </div>
              )}
            </div>
            {searched && nights > 0 && (
              <div className="search-results-bar">
                <div className="search-results-info">
                  <CalendarDays size={16} />
                  <span>
                    <strong>{checkIn}</strong> → <strong>{checkOut}</strong>
                  </span>
                  <span className="search-results-nights">
                    {nights} {nights === 1 ? 'noche' : 'noches'}
                  </span>
                  <span className="search-results-guests">
                    <Users size={14} /> {guests}
                  </span>
                </div>
                <span className="search-results-count">
                  {availableRooms.length}{' '}
                  {availableRooms.length === 1
                    ? 'habitación disponible'
                    : 'habitaciones disponibles'}
                </span>
              </div>
            )}
            <div className="room-cards">
              {(searched ? availableRooms : rooms).map((room) => (
                <article className="visitor-room" key={room.name}>
                  <div className="room-visual" style={{ backgroundImage: `url(${room.image})` }}>
                    <span className="room-tag">{room.tag}</span>
                  </div>
                  <div className="room-card-body">
                    <div>
                      <h3>{room.name}</h3>
                      <p>{room.detail}</p>
                    </div>
                    <div className="room-price">
                      <small>Desde</small>
                      <strong>${room.price.toLocaleString()}</strong>
                      <span>por noche</span>
                    </div>
                  </div>
                  {searched && nights > 0 && (
                    <div className="room-total-stay">
                      <small>
                        Total estancia · {nights} {nights === 1 ? 'noche' : 'noches'}
                      </small>
                      <strong>${(room.price * nights).toLocaleString()}</strong>
                    </div>
                  )}
                  <div className="room-features-list">
                    {room.features.slice(0, 4).map((f) => (
                      <span key={f}>
                        <Check size={13} /> {f}
                      </span>
                    ))}
                  </div>
                  <div className="room-card-footer">
                    <button className="text-button" onClick={() => openDetail(room)}>
                      Ver detalles <ArrowRight size={14} />
                    </button>
                    <button className="button primary small" onClick={() => openReservation(room)}>
                      Reservar
                    </button>
                  </div>
                </article>
              ))}
              {searched && availableRooms.length === 0 && (
                <div className="search-empty">
                  <TriangleAlert size={28} />
                  <p>
                    No encontramos habitaciones para {guestCount}{' '}
                    {guestCount === 1 ? 'huésped' : 'huéspedes'} en las fechas seleccionadas.
                  </p>
                  <span>Prueba con otras fechas o reduce el número de huéspedes.</span>
                </div>
              )}
            </div>
          </section>
        )}
        {tab === 'amenities' && (
          <section className="visitor-section visitor-tab-content">
            <div className="visitor-section-head">
              <div>
                <p className="eyebrow">TODO INCLUIDO EN TU ESTANCIA</p>
                <h2>
                  Pequeños detalles.
                  <br />
                  <em>Grandes momentos.</em>
                </h2>
              </div>
            </div>
            <p className="visitor-section-desc">
              Desde el primer café de la mañana hasta la última luz de la tarde, todo está pensado
              para que tú solo tengas que disfrutar.
            </p>
            <div className="amenity-grid">
              {amenities.map((a) => {
                const AmenityIcon = a.icon;
                return (
                  <article
                    className={a.image ? 'amenity-card with-image' : 'amenity-card'}
                    key={a.title}
                  >
                    {a.image ? (
                      <div
                        className="amenity-image"
                        style={{ backgroundImage: `url(${a.image})` }}
                      />
                    ) : null}
                    <div className="amenity-body">
                      <span className="amenity-icon-wrap">
                        <AmenityIcon size={20} />
                      </span>
                      <strong>{a.title}</strong>
                      <p>{a.desc}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
        {tab === 'promos' && (
          <section className="visitor-section visitor-tab-content">
            <div className="visitor-section-head">
              <div>
                <p className="eyebrow">OFERTAS Y DESCUENTOS</p>
                <h2>
                  Promociones
                  <br />
                  <em>que te convienen.</em>
                </h2>
              </div>
            </div>
            <p className="visitor-section-desc">
              Aprovecha nuestras mejores ofertas y haz tu estancia aún más memorable.
            </p>
            <div className="promo-grid">
              {promos.map((p) => {
                const PromoIcon = p.icon;
                return (
                  <article className="promo-card" key={p.code}>
                    <div className="promo-image" style={{ backgroundImage: `url(${p.image})` }}>
                      <span className={`promo-icon ${p.tone}`}>
                        <PromoIcon size={24} />
                      </span>
                    </div>
                    <div className="promo-body">
                      <strong>{p.title}</strong>
                      <p>{p.desc}</p>
                    </div>
                    <div className="promo-code-row">
                      <code>{p.code}</code>
                      <button
                        className={copiedCode === p.code ? 'promo-copy copied' : 'promo-copy'}
                        onClick={() => {
                          setCopiedCode(p.code);
                          onAction(`Código ${p.code} copiado`);
                        }}
                      >
                        {copiedCode === p.code ? (
                          <>
                            <Check size={14} /> Copiado
                          </>
                        ) : (
                          'Copiar'
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
        {tab === 'policies' && (
          <section className="visitor-section visitor-tab-content">
            <div className="visitor-section-head">
              <div>
                <p className="eyebrow">CONDICIONES DE RESERVA</p>
                <h2>
                  Políticas de cancelación
                  <br />y reserva
                </h2>
              </div>
            </div>
            <p className="visitor-section-desc">
              Conoce nuestras condiciones antes de reservar para una estancia sin sorpresas.
            </p>
            <div className="politicas-grid">
              {policies.map((p) => {
                const PolicyIcon = p.icon;
                return (
                  <div className="politica-card" key={p.title}>
                    <span className={`politica-icon ${p.tone}`}>
                      <PolicyIcon size={22} />
                    </span>
                    <strong>{p.title}</strong>
                    <p>{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
      <section className="visitor-experience">
        <div className="visitor-section-head center">
          <div>
            <p className="eyebrow">VIVE AURORA</p>
            <h2>
              Una experiencia
              <br />
              <em>en cada rincón.</em>
            </h2>
          </div>
        </div>
        <p className="visitor-section-desc center">
          Desde nuestras instalaciones hasta cada detalle de servicio, todo está diseñado para que
          tu estancia sea inolvidable.
        </p>
        <div className="experience-grid">
          {experienceImages.map((img, i) => (
            <div className="experience-tile" key={i} style={{ backgroundImage: `url(${img})` }}>
              <div className="experience-overlay" />
            </div>
          ))}
        </div>
      </section>
      <footer className="visitor-footer">
        <span>© 2024 Aurora Hotel Group</span>
        <span>Privacidad · Términos · Contacto</span>
      </footer>

      {detailRoom && (
        <div className="modal-backdrop" onMouseDown={closeDetail}>
          <div className="modal room-detail-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="room-detail-gallery">
              <div
                className="room-detail-main-img"
                style={{ backgroundImage: `url(${detailRoom.gallery[detailGalleryIdx]})` }}
              >
                <button className="icon-btn room-detail-close" onClick={closeDetail}>
                  <X size={18} />
                </button>
                <span className="room-tag">{detailRoom.tag}</span>
              </div>
              <div className="room-detail-thumbs">
                {detailRoom.gallery.map((g, i) => (
                  <button
                    key={i}
                    className={
                      i === detailGalleryIdx ? 'room-detail-thumb active' : 'room-detail-thumb'
                    }
                    style={{ backgroundImage: `url(${g})` }}
                    onClick={() => setDetailGalleryIdx(i)}
                  />
                ))}
              </div>
            </div>
            <div className="room-detail-info">
              <div className="room-detail-head">
                <div>
                  <p className="eyebrow">DETALLES DE LA HABITACIÓN</p>
                  <h2>{detailRoom.name}</h2>
                  <p className="room-detail-sub">{detailRoom.detail}</p>
                </div>
                <div className="room-detail-price-box">
                  <small>Desde</small>
                  <strong>${detailRoom.price.toLocaleString()}</strong>
                  <span>por noche</span>
                </div>
              </div>
              <div className="room-detail-meta-row">
                <span>
                  <Users size={15} /> {detailRoom.maxGuests} huéspedes
                </span>
                <span>
                  <BedDouble size={15} /> {detailRoom.bed}
                </span>
                <span>
                  <Home size={15} /> {detailRoom.size}
                </span>
              </div>
              <p className="room-detail-desc">{detailRoom.description}</p>
              <div className="room-detail-features">
                <h4>Características</h4>
                <div className="room-detail-features-grid">
                  {detailRoom.features.map((f) => (
                    <span key={f}>
                      <Check size={14} /> {f}
                    </span>
                  ))}
                </div>
              </div>
              {searched && nights > 0 && (
                <div className="room-detail-total">
                  <div>
                    <span>
                      Total · {nights} {nights === 1 ? 'noche' : 'noches'}
                    </span>
                    <strong>${(detailRoom.price * nights).toLocaleString()}</strong>
                  </div>
                  <p>
                    Check-in: {checkIn} · Check-out: {checkOut} · {guests}
                  </p>
                </div>
              )}
              <div className="room-detail-actions">
                <button className="button secondary" onClick={closeDetail}>
                  Cerrar
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    closeDetail();
                    openReservation(detailRoom);
                  }}
                >
                  Reservar esta habitación <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reservingRoom && (
        <div className="modal-backdrop" onMouseDown={closeReservation}>
          <div className="modal reservation-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">RESERVA · {reservingRoom.name.toUpperCase()}</p>
                <h2>
                  {resStep === 'guest'
                    ? 'Tus datos'
                    : resStep === 'payment'
                      ? 'Pago de reserva'
                      : 'Reserva confirmada'}
                </h2>
              </div>
              <button className="icon-btn" onClick={closeReservation}>
                <X size={18} />
              </button>
            </div>
            <div className="reservation-steps">
              <span className={resStep === 'guest' ? 'res-step active' : 'res-step done'}>
                <span className="res-step-num">
                  {resStep === 'guest' ? '1' : <Check size={12} />}
                </span>{' '}
                Datos
              </span>
              <span
                className={
                  resStep === 'payment'
                    ? 'res-step active'
                    : resStep === 'confirmation'
                      ? 'res-step done'
                      : 'res-step'
                }
              >
                <span className="res-step-num">
                  {resStep === 'payment' ? (
                    '2'
                  ) : resStep === 'confirmation' ? (
                    <Check size={12} />
                  ) : (
                    '2'
                  )}
                </span>{' '}
                Pago
              </span>
              <span className={resStep === 'confirmation' ? 'res-step active' : 'res-step'}>
                <span className="res-step-num">3</span> Confirmación
              </span>
            </div>
            <div className="reservation-summary">
              <div className="res-summary-room">
                <div
                  className="res-summary-img"
                  style={{ backgroundImage: `url(${reservingRoom.image})` }}
                />
                <div>
                  <strong>{reservingRoom.name}</strong>
                  <span>{reservingRoom.detail}</span>
                </div>
              </div>
              <div className="res-summary-details">
                <span>
                  <CalendarDays size={13} /> {checkIn} → {checkOut}
                </span>
                <span>
                  <Clock size={13} /> {Math.max(nights, 1)} {nights === 1 ? 'noche' : 'noches'}
                </span>
                <span>
                  <Users size={13} /> {guests}
                </span>
                <strong>${reservationTotal.toLocaleString()}</strong>
              </div>
            </div>

            {resStep === 'guest' && (
              <div className="reservation-form">
                <div className="res-field-group">
                  <label className="res-field">
                    <span>Nombre completo *</span>
                    <input
                      value={resData.name}
                      onChange={(e) => setResData({ ...resData, name: e.target.value })}
                      placeholder="Tu nombre completo"
                    />
                    {resErrors.name && <em className="res-error">{resErrors.name}</em>}
                  </label>
                  <label className="res-field">
                    <span>Correo electrónico *</span>
                    <input
                      value={resData.email}
                      onChange={(e) => setResData({ ...resData, email: e.target.value })}
                      placeholder="tu@correo.com"
                    />
                    {resErrors.email && <em className="res-error">{resErrors.email}</em>}
                  </label>
                  <label className="res-field">
                    <span>Teléfono *</span>
                    <input
                      value={resData.phone}
                      onChange={(e) => setResData({ ...resData, phone: e.target.value })}
                      placeholder="+52 555 123 4567"
                    />
                    {resErrors.phone && <em className="res-error">{resErrors.phone}</em>}
                  </label>
                </div>
                <p className="res-form-note">
                  <ShieldCheck size={14} /> Tus datos están protegidos y no se comparten con
                  terceros.
                </p>
              </div>
            )}

            {resStep === 'payment' && (
              <div className="reservation-form">
                <div className="res-payment-methods">
                  <button
                    className={
                      resData.paymentMethod === 'card' ? 'res-pay-method active' : 'res-pay-method'
                    }
                    onClick={() => setResData({ ...resData, paymentMethod: 'card' })}
                  >
                    <Wallet size={18} /> Tarjeta
                  </button>
                  <button
                    className={
                      resData.paymentMethod === 'transfer'
                        ? 'res-pay-method active'
                        : 'res-pay-method'
                    }
                    onClick={() => setResData({ ...resData, paymentMethod: 'transfer' })}
                  >
                    <ArrowRight size={18} /> Transferencia
                  </button>
                </div>
                {resData.paymentMethod === 'card' ? (
                  <div className="res-field-group">
                    <label className="res-field">
                      <span>Número de tarjeta *</span>
                      <input
                        value={resData.card}
                        onChange={(e) => setResData({ ...resData, card: e.target.value })}
                        placeholder="4242 4242 4242 4242"
                        maxLength={19}
                      />
                      {resErrors.card && <em className="res-error">{resErrors.card}</em>}
                    </label>
                    <label className="res-field">
                      <span>Nombre del titular *</span>
                      <input
                        value={resData.cardName}
                        onChange={(e) => setResData({ ...resData, cardName: e.target.value })}
                        placeholder="Como aparece en la tarjeta"
                      />
                      {resErrors.cardName && <em className="res-error">{resErrors.cardName}</em>}
                    </label>
                    <div className="res-field-row">
                      <label className="res-field">
                        <span>Vencimiento *</span>
                        <input
                          value={resData.cardExp}
                          onChange={(e) => setResData({ ...resData, cardExp: e.target.value })}
                          placeholder="MM/AA"
                          maxLength={5}
                        />
                        {resErrors.cardExp && <em className="res-error">{resErrors.cardExp}</em>}
                      </label>
                      <label className="res-field">
                        <span>CVC *</span>
                        <input
                          value={resData.cardCvc}
                          onChange={(e) => setResData({ ...resData, cardCvc: e.target.value })}
                          placeholder="123"
                          maxLength={4}
                        />
                        {resErrors.cardCvc && <em className="res-error">{resErrors.cardCvc}</em>}
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="res-transfer-info">
                    <p>
                      Realiza tu transferencia a la siguiente cuenta y envía el comprobante a
                      reservas@aurorahotel.com:
                    </p>
                    <div className="res-transfer-bank">
                      <span>Banco</span>
                      <strong>Banco Aurora · Cuenta 0123 4567 8901 2345</strong>
                      <span>CLABE</span>
                      <strong>012 345 678 901 234 567</strong>
                      <span>Concepto</span>
                      <strong>Reserva {reservingRoom.name}</strong>
                    </div>
                    <p className="res-transfer-note">
                      Tu reserva se confirmará al recibir el comprobante del pago.
                    </p>
                  </div>
                )}
                <div className="res-payment-total">
                  <span>Total a pagar</span>
                  <strong>${reservationTotal.toLocaleString()}</strong>
                </div>
              </div>
            )}

            {resStep === 'confirmation' && (
              <div className="reservation-confirmation">
                <div className="res-confirm-icon">
                  <Check size={40} />
                </div>
                <h3>¡Tu reserva está confirmada!</h3>
                <p>
                  Enviamos un correo de confirmación a{' '}
                  <strong>{resData.email || 'tu correo'}</strong> con todos los detalles de tu
                  reserva.
                </p>
                <div className="res-confirm-details">
                  <div className="res-confirm-row">
                    <span>Habitación</span>
                    <strong>{reservingRoom.name}</strong>
                  </div>
                  <div className="res-confirm-row">
                    <span>Check-in</span>
                    <strong>{checkIn}</strong>
                  </div>
                  <div className="res-confirm-row">
                    <span>Check-out</span>
                    <strong>{checkOut}</strong>
                  </div>
                  <div className="res-confirm-row">
                    <span>Huéspedes</span>
                    <strong>{guests}</strong>
                  </div>
                  <div className="res-confirm-row">
                    <span>Total pagado</span>
                    <strong>${reservationTotal.toLocaleString()}</strong>
                  </div>
                  <div className="res-confirm-row">
                    <span>Confirmación</span>
                    <strong>AUR-{Math.floor(Math.random() * 90000 + 10000)}</strong>
                  </div>
                </div>
                <div className="res-confirm-note">
                  <Headphones size={16} />
                  <p>
                    ¿Necesitas cambios? Llámanos al 555-123-4567 o escribe a
                    reservas@aurorahotel.com
                  </p>
                </div>
              </div>
            )}

            <div className="modal-foot">
              {resStep === 'guest' && (
                <button className="button secondary" onClick={closeReservation}>
                  Cancelar
                </button>
              )}
              {resStep === 'payment' && (
                <button className="button secondary" onClick={() => setResStep('guest')}>
                  Volver
                </button>
              )}
              {resStep === 'confirmation' ? (
                <button className="button primary" onClick={closeReservation}>
                  Listo <Check size={16} />
                </button>
              ) : (
                <button className="button primary" onClick={handleNextStep}>
                  {resStep === 'guest' ? 'Continuar al pago' : 'Confirmar reserva'}{' '}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthModal({
  mode,
  onClose,
  onLogin,
  onRegister,
}: {
  mode: 'choice' | 'guest' | 'employee';
  onClose: () => void;
  onLogin: (role: RoleId) => void;
  onRegister: () => void;
}) {
  const [view, setView] = useState(mode);
  const [selectedRole, setSelectedRole] = useState<RoleId>('reception');
  const [submitted, setSubmitted] = useState(false);
  const employeeRoles = roles.filter((role) => role.id !== 'guest');
  const selected = roles.find((role) => role.id === selectedRole) ?? roles[0];
  const SelectedIcon = selected.icon;
  if (view === 'choice')
    return (
      <div className="modal-backdrop" onMouseDown={onClose}>
        <div className="auth-choice" onMouseDown={(event) => event.stopPropagation()}>
          <button className="icon-btn auth-close" onClick={onClose}>
            <X size={18} />
          </button>
          <div className="auth-choice-head">
            <span className="brand-mark">
              <Sparkles size={19} />
            </span>
            <p className="eyebrow">ACCESO AURORA</p>
            <h2>¿Cómo quieres continuar?</h2>
            <p>Elige la experiencia que corresponde a tu visita.</p>
          </div>
          <div className="auth-choice-grid">
            <button onClick={() => setView('guest')}>
              <span className="choice-icon cream">
                <UserRound size={23} />
              </span>
              <strong>Soy huésped</strong>
              <small>Regístrate para reservar y administrar tu estancia.</small>
              <span className="choice-arrow">
                <ArrowRight size={16} />
              </span>
            </button>
            <button onClick={() => setView('employee')}>
              <span className="choice-icon brown">
                <ShieldCheck size={23} />
              </span>
              <strong>Soy empleado o administrador</strong>
              <small>Accede al PMS con tus credenciales de trabajo.</small>
              <span className="choice-arrow">
                <ArrowRight size={16} />
              </span>
            </button>
          </div>
          <p className="login-security">
            <ShieldCheck size={14} /> Tus datos están protegidos por Hotel Aurora
          </p>
        </div>
      </div>
    );
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="auth-form" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{view === 'guest' ? 'NUEVO HUÉSPED' : 'ACCESO DE PERSONAL'}</p>
            <h2>{view === 'guest' ? 'Crea tu cuenta' : 'Iniciar sesión'}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="login-helper">
          {view === 'guest'
            ? 'Regístrate para consultar tus reservas, recibir confirmaciones y disfrutar tu estancia.'
            : 'Este acceso es exclusivo para empleados y administradores registrados.'}
        </p>
        {view === 'employee' && (
          <>
            <label>Rol de trabajo</label>
            <div className="employee-role-select">
              <span className={`role-list-icon ${selected.color}`}>
                <SelectedIcon size={16} />
              </span>
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as RoleId)}
              >
                {employeeRoles.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {item.person}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
          </>
        )}
        <div className="auth-fields">
          <label>
            Usuario o correo electrónico
            <input placeholder={view === 'guest' ? 'tu@correo.com' : 'usuario@aurorahotel.com'} />
          </label>
          {view === 'guest' && (
            <label>
              Nombre completo
              <input placeholder="Tu nombre" />
            </label>
          )}
          <label>
            Contraseña
            <input type="password" placeholder="••••••••" />
          </label>
          {view === 'guest' && (
            <label>
              Confirmar contraseña
              <input type="password" placeholder="••••••••" />
            </label>
          )}
        </div>
        {view === 'employee' && (
          <button className="forgot-link" onClick={() => setSubmitted(true)}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
        <button
          className="button primary login-button"
          onClick={() => {
            if (view === 'guest') onRegister();
            else onLogin(selectedRole);
          }}
        >
          {view === 'guest' ? 'Crear cuenta de huésped' : `Ingresar como ${selected.name}`}{' '}
          <ArrowRight size={16} />
        </button>
        {submitted && (
          <div className="form-note">Te mostraremos el proceso para recuperar tu acceso.</div>
        )}
        <p className="auth-switch">
          {view === 'guest' ? (
            <>
              ¿Ya tienes cuenta? <button onClick={() => setView('employee')}>Iniciar sesión</button>
            </>
          ) : (
            <>
              ¿Quieres reservar como huésped?{' '}
              <button onClick={() => setView('guest')}>Registrarte aquí</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function TaskTable({
  tasks,
  search,
  setSearch,
  onComplete,
  onAction,
  role,
}: {
  tasks: Task[];
  search: string;
  setSearch: (value: string) => void;
  onComplete: (id: number) => void;
  onAction: (message: string) => void;
  role: RoleId;
}) {
  return (
    <>
      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              role === 'housekeeping'
                ? 'Buscar habitación o tarea...'
                : 'Buscar huésped, habitación...'
            }
          />
        </div>
        <button
          className="filter-button"
          onClick={() => onAction('Filtros disponibles próximamente')}
        >
          <span>Todos</span>
          <ChevronDown size={15} />
        </button>
        <button className="icon-btn" onClick={() => onAction('Más filtros abiertos')}>
          <Menu size={18} />
        </button>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <div className="task-row" key={task.id}>
            <div className="task-status-dot" />
            <div className="task-info">
              <strong>{task.title}</strong>
              <span>
                {task.room} · {task.guest}
              </span>
            </div>
            <span className="task-time">{task.time}</span>
            <span className={`status-pill ${task.tone}`}>{task.status}</span>
            <button
              className="row-more"
              onClick={() =>
                task.status !== 'Completada'
                  ? onComplete(task.id)
                  : onAction('Detalle de tarea abierto')
              }
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="empty-state">
            <Search size={22} />
            <p>No encontramos resultados</p>
          </div>
        )}
      </div>
    </>
  );
}

function AdminChart({ onAction }: { onAction: (message: string) => void }) {
  return (
    <div className="chart-area">
      <div className="chart-tabs">
        <button className="active">Ocupación</button>
        <button onClick={() => onAction('Gráfica de ingresos seleccionada')}>Ingresos</button>
        <button onClick={() => onAction('Gráfica de reservas seleccionada')}>Reservas</button>
        <span>
          Últimos 30 días <ChevronDown size={14} />
        </span>
      </div>
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
              <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#b88d50" stopOpacity=".32" />
                <stop offset="100%" stopColor="#b88d50" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 167 C40 153 57 151 85 159 S135 133 168 138 S216 108 247 126 S294 116 322 120 S370 93 403 104 S447 72 479 89 S520 59 549 75 S600 42 634 58 S677 32 720 39 L720 210 L0 210 Z"
              fill="url(#chartFill)"
            />
            <path
              d="M0 167 C40 153 57 151 85 159 S135 133 168 138 S216 108 247 126 S294 116 322 120 S370 93 403 104 S447 72 479 89 S520 59 549 75 S600 42 634 58 S677 32 720 39"
              fill="none"
              stroke="#b88d50"
              strokeWidth="3"
            />
          </svg>
        </div>
        <div className="chart-x">
          <span>01 ago</span>
          <span>08 ago</span>
          <span>15 ago</span>
          <span>22 ago</span>
          <span>30 ago</span>
        </div>
      </div>
      <div className="chart-footer">
        <span>
          <i className="legend-dot" /> Ocupación promedio
        </span>
        <strong>84.6%</strong>
        <span className="positive">+8.2% vs. mes anterior</span>
      </div>
    </div>
  );
}

function ActivityFeed({ items }: { items: { time: string; text: string; tone: string }[] }) {
  if (items.length === 0)
    return (
      <div className="hk-empty">
        <Activity size={20} />
        <p>Sin actividad registrada todavía</p>
      </div>
    );
  return (
    <div className="activity-list">
      {items.map((item) => (
        <div className="activity-item" key={`${item.time}-${item.text}`}>
          <span className={`activity-dot ${item.tone}`} />
          <div>
            <p>{item.text}</p>
            <small>{item.time}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function RoomStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="room-stat">
      <span className={`room-dot ${tone}`} />
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function getSubtitle(nav: string, role: string) {
  if (
    nav === 'Resumen' ||
    nav === 'Dashboard' ||
    nav === 'Mi jornada' ||
    nav === 'Mi estancia' ||
    nav === 'Inicio' ||
    nav === 'Pedidos activos' ||
    nav === 'Solicitudes'
  )
    return `Este es el resumen de tu actividad como ${role.toLowerCase()}.`;
  if (nav === 'Cerrar sesión') return 'Cierra tu sesión cuando termines de usar la aplicación.';
  return `Gestiona y consulta la información de ${nav.toLowerCase()} de tu hotel.`;
}
function getPanelTitle(role: RoleId, nav: string) {
  if (role === 'admin') return 'Rendimiento del hotel';
  if (role === 'guest') return 'Resumen de mi estancia';
  if (nav === 'Habitaciones') return 'Habitaciones pendientes';
  if (nav === 'Solicitudes') return 'Solicitudes por atender';
  if (nav === 'Pedidos activos') return 'Pedidos en curso';
  if (nav === 'Transacciones') return 'Últimas transacciones';
  return 'Actividad de hoy';
}
function getPanelDescription(role: RoleId) {
  if (role === 'admin') return 'Ocupación y rendimiento durante este periodo';
  if (role === 'guest') return 'Todo lo que necesitas para disfrutar tu visita';
  return 'Tareas que necesitan tu atención';
}

export default PrivateWorkspace;
