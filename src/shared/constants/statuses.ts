// Contrato compartido de estados y transiciones válidas para web y móvil.
// Fuente de verdad: la web (ver docs/CONTRATO-DATOS.md, sección "Máquinas de
// estado"). Móvil debe usar exactamente estos literales camelCase — son los
// mismos que expone el Model de cada entidad; el DTO los traduce a
// snake_case en su mapper, igual que el resto del contrato.
//
// Ningún literal se renombra en silencio: si un valor de aquí cambia, se
// anuncia a ambos lados antes de tocar el código (ver "Cómo se cambia este
// contrato" en docs/CONTRATO-DATOS.md).

// --- room: ocupación (dueño: web) ---------------------------------------
//
// Responde "¿se puede vender la habitación?". Decisión D-002
// (docs/DECISIONES.md): es una máquina distinta de la limpieza — antes
// convivían en un solo campo `status`, que por eso incluía `cleaning`
// (retirado de aquí: ese concepto es ahora un valor de
// ROOM_HOUSEKEEPING_STATUSES, no de ocupación). Los 4 literales que quedan
// son exactamente los que ya usaba la web; no se renombró ninguno.
export const ROOM_STATUSES = ['available', 'occupied', 'maintenance', 'outOfService'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const ROOM_STATUS_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  available: ['occupied', 'maintenance', 'outOfService'],
  occupied: ['available', 'maintenance', 'outOfService'],
  maintenance: ['available', 'outOfService'],
  outOfService: ['available', 'maintenance'],
};

// --- room: limpieza (dueño: móvil) --------------------------------------
//
// Responde "¿en qué paso de la limpieza está?". El personal de limpieza
// (app móvil) es quien transiciona este estado; la web solo lo lee. Ver
// D-002 (docs/DECISIONES.md) y docs/CONTRATO-DATOS.md sección 3.1.
export const ROOM_HOUSEKEEPING_STATUSES = ['dirty', 'cleaning', 'clean', 'inspected'] as const;
export type RoomHousekeepingStatus = (typeof ROOM_HOUSEKEEPING_STATUSES)[number];

export const ROOM_HOUSEKEEPING_STATUS_TRANSITIONS: Record<
  RoomHousekeepingStatus,
  readonly RoomHousekeepingStatus[]
> = {
  dirty: ['cleaning'],
  cleaning: ['clean'],
  clean: ['inspected', 'dirty'],
  inspected: ['dirty'],
};

// --- room: regla de asignabilidad ---------------------------------------
//
// Una habitación es asignable solo si está libre (ocupación `available`) Y
// su limpieza está en un estado apto (`clean` o `inspected`). Vive aquí,
// junto a las dos máquinas que la definen, para que ninguna pantalla la
// reimplemente con condicionales sueltos (`scripts/test-shared-contract.mjs`
// vigila esto de forma estática). Toma un objeto estructural en vez del
// tipo `Room` del Model para no crear un import circular entre
// `shared/constants` y `shared/types/entities/room` — cualquier objeto con
// estos dos campos (incluido un `Room` real) sirve.
export const ASSIGNABLE_HOUSEKEEPING_STATUSES: readonly RoomHousekeepingStatus[] = [
  'clean',
  'inspected',
];

export interface RoomAssignabilityInput {
  status: RoomStatus;
  housekeepingStatus: RoomHousekeepingStatus;
}

export function isRoomAssignable(room: RoomAssignabilityInput): boolean {
  return (
    room.status === 'available' &&
    ASSIGNABLE_HOUSEKEEPING_STATUSES.includes(room.housekeepingStatus)
  );
}

// --- booking -------------------------------------------------------------
//
// Literales alineados con BookingStatus en shared/types/entities/booking/.
// El backend decide las transiciones productivas; esta tabla documenta la
// interpretación compartida para que web y móvil converjan en la misma.
export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'checkedIn',
  'checkedOut',
  'cancelled',
  'noShow',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['confirmed', 'cancelled', 'noShow'],
  confirmed: ['checkedIn', 'cancelled', 'noShow'],
  checkedIn: ['checkedOut'],
  checkedOut: [],
  cancelled: [],
  noShow: [],
};

// --- order -----------------------------------------------------------------
//
// Entidad nueva (FASE 2.4): no había literales previos en la web con los que
// chocar, así que se usan exactamente los que móvil necesita.
export const ORDER_STATUSES = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'onTheWay',
  'delivered',
  'rejected',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  // Igual que RoomServiceOrderServiceImpl: se cancela hasta `ready`, no en camino.
  preparing: ['ready', 'cancelled'],
  ready: ['onTheWay', 'cancelled'],
  onTheWay: ['delivered'],
  delivered: [],
  rejected: [],
  cancelled: [],
};

// --- service_request ---------------------------------------------------
//
// Entidad nueva (FASE 2.4), mismo caso que `order`. `cancelled` se agregó en
// INT-11 para coincidir con el backend (docs/DECISIONES.md, D-013).
export const SERVICE_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'inProgress',
  'completed',
  'rejected',
  'cancelled',
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

// Flujo de Conserjería del backend. Solo referencia: el backend valida.
export const SERVICE_REQUEST_STATUS_TRANSITIONS: Record<
  ServiceRequestStatus,
  readonly ServiceRequestStatus[]
> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['inProgress', 'cancelled'],
  inProgress: ['completed', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
};

// --- guest_account (Lote C, WEB-11) -------------------------------------
//
// Folio de una estadía. `open` mientras la reserva sigue en curso y puede
// recibir cargos/pagos nuevos; `closed` al hacer check-out, con el saldo ya
// definitivo. No se reabre — un ajuste posterior es un cargo/pago nuevo,
// no reabrir el folio.
export const GUEST_ACCOUNT_STATUSES = ['open', 'closed'] as const;
export type GuestAccountStatus = (typeof GUEST_ACCOUNT_STATUSES)[number];

export const GUEST_ACCOUNT_STATUS_TRANSITIONS: Record<
  GuestAccountStatus,
  readonly GuestAccountStatus[]
> = {
  open: ['closed'],
  closed: [],
};

// --- deposit (Lote C, WEB-11) --------------------------------------------
//
// Depósito o garantía entregado al check-in. `held` mientras la estadía
// sigue activa; al check-out se decide si se `refund`ea de vuelta al
// huésped o se `apply`ica contra un cargo pendiente.
export const DEPOSIT_STATUSES = ['held', 'refunded', 'applied'] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const DEPOSIT_STATUS_TRANSITIONS: Record<DepositStatus, readonly DepositStatus[]> = {
  held: ['refunded', 'applied'],
  refunded: [],
  applied: [],
};

// --- cash_session (Lote C, WEB-11) ---------------------------------------
//
// Jornada de caja: `open` desde que se cuenta el saldo inicial hasta el
// cierre; `closed` cuando se cuenta el saldo final y se registra la
// diferencia contra lo esperado. No se reabre — un ajuste posterior es un
// movimiento en la siguiente jornada.
export const CASH_SESSION_STATUSES = ['open', 'closed'] as const;
export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];

export const CASH_SESSION_STATUS_TRANSITIONS: Record<
  CashSessionStatus,
  readonly CashSessionStatus[]
> = {
  open: ['closed'],
  closed: [],
};
