import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Ban,
  BedDouble,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  Home,
  LogOut,
  MessageSquare,
  Package,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Reservation, GuestInfo } from '@/private/workspace/PrivateWorkspace';
import { catalogService } from '@/services/catalogService';
import {
  guestPortalService,
  type GuestBooking,
  type GuestStay,
} from '@/services/guestPortalService';
import { housekeepingService } from '@/services/housekeepingService';
import { notificationService, type Notification } from '@/services/notificationService';
import { orderService } from '@/services/orderService';
import { serviceRequestService } from '@/services/serviceRequestService';
import { CatalogImage } from '@/shared/components/CatalogImage';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { findPrimaryImage, type MediaImage } from '@/shared/types/entities/media-image';
import type { Order } from '@/shared/types/entities/order';
import type { Product } from '@/shared/types/entities/product';
import type { ServiceRequest } from '@/shared/types/entities/service-request';
import { toDomainCalendarDate, toDtoCalendarDate } from '@/shared/types/common';
import { formatCurrency } from '@/shared/utils/currency';
import { calculateNights } from '@/shared/utils/date';
import './GuestContent.css';
import {
  CancelOrderModal,
  CreateBookingModal,
  RequestServiceModal,
  ReservationDetailModal,
  money,
  fmtDate,
  resStatusClass,
  orderStatusClass,
  reqStatusClass,
  type GuestNotification,
  type GuestServiceRequest,
  type GuestMenuItem,
  type GuestCartItem,
  type GuestOrder,
} from '@/modules/guest-portal/components/GuestModals';

type GuestAmenity = {
  name: string;
  description: string;
  icon: LucideIcon;
  available: boolean;
  schedule: string;
  image?: MediaImage;
};

const AMENITY_ICONS: LucideIcon[] = [
  Sparkles,
  Activity,
  ShieldCheck,
  BedDouble,
  Home,
  Package,
  FileText,
  Clock,
];

function centsToAmount(cents: number) {
  return Math.round(cents / 100);
}

function formatDbTime(value?: Date) {
  if (!value) return '';
  return value.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Estado de la reserva tal como lo devuelve `/guest/stay` (literales del backend).
function mapStayStatus(status: string): Reservation['status'] {
  if (status === 'checked_in') return 'Check-in';
  if (status === 'checked_out') return 'Check-out';
  if (status === 'confirmed') return 'Confirmada';
  if (status === 'cancelled') return 'Cancelada';
  if (status === 'no_show') return 'Anulada';
  return 'Pendiente';
}

function roomTypeLabel(name?: string): Reservation['roomType'] {
  const normalized = name?.toLowerCase() ?? '';
  if (normalized.includes('suite')) return 'Suite';
  if (normalized.includes('deluxe')) return 'Deluxe';
  return 'Estándar';
}

const PRODUCT_CATEGORY_LABELS: Record<Product['category'], string> = {
  foodAndBeverage: 'Alimentos y bebidas',
  minibar: 'Minibar',
  shop: 'Tienda',
  other: 'Otros',
};

function mapOrderStatus(status: string): GuestOrder['status'] {
  if (status === 'accepted') return 'Aceptado';
  if (status === 'preparing') return 'En preparación';
  if (status === 'ready') return 'Listo';
  if (status === 'onTheWay') return 'En camino';
  if (status === 'delivered') return 'Entregado';
  if (status === 'cancelled' || status === 'rejected') return 'Cancelado';
  return 'Pendiente';
}

function mapRequestStatus(status: string): GuestServiceRequest['status'] {
  if (status === 'completed') return 'Completada';
  if (status === 'cancelled' || status === 'rejected') return 'Cancelada';
  if (status === 'accepted') return 'Aceptada';
  if (status === 'inProgress') return 'En proceso';
  return 'Pendiente';
}

const CANCELLABLE_GUEST_ORDER_STATUSES: readonly GuestOrder['status'][] = [
  'Pendiente',
  'Aceptado',
  'En preparación',
  'Listo',
];

const CANCELLABLE_CONCIERGE_STATUSES: readonly GuestServiceRequest['status'][] = [
  'Pendiente',
  'Aceptada',
  'En proceso',
];

function canCancelGuestOrder(order: GuestOrder): boolean {
  return CANCELLABLE_GUEST_ORDER_STATUSES.includes(order.status);
}

function canCancelGuestRequest(request: GuestServiceRequest): boolean {
  if (request.kind === 'housekeeping') return request.status === 'Pendiente';
  return CANCELLABLE_CONCIERGE_STATUSES.includes(request.status);
}

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      stay: GuestStay;
      profile: GuestInfo;
      reservations: PortalReservation[];
      notifications: GuestNotification[];
      unreadCount: number;
      serviceRequests: GuestServiceRequest[];
      menu: GuestMenuItem[];
      orders: GuestOrder[];
      amenities: GuestAmenity[];
    };

/** Las reservas visibles vienen del endpoint autenticado del huésped. */
type PortalReservation = Reservation & {
  bookingId: string;
  guestId: string;
  roomId?: string;
  balanceCents: number;
};

function toPortalReservationFromBooking(
  booking: GuestBooking,
  index: number,
  profile: GuestInfo,
  roomTypeName?: string,
  roomNumber?: string,
  balanceCents = 0,
): PortalReservation {
  const nights = Math.max(1, calculateNights(booking.checkIn, booking.checkOut));
  return {
    id: index,
    bookingId: booking.id,
    guestId: booking.guestId,
    roomId: booking.roomId,
    balanceCents,
    code: booking.confirmationCode,
    guestLinkCode: booking.guestLinkCode,
    checkIn: toDtoCalendarDate(booking.checkIn),
    checkOut: toDtoCalendarDate(booking.checkOut),
    roomNumber: roomNumber ?? (booking.roomId ? 'Asignada' : 'Sin asignar'),
    roomType: roomTypeLabel(roomTypeName),
    rate: booking.totalAmountCents > 0 ? Math.round(booking.totalAmountCents / (100 * nights)) : 0,
    guestCount: booking.adults + booking.children,
    status: mapStayStatus(booking.status),
    origin: 'Portal del Huésped',
    observations: booking.notes ?? '',
    checkInTime: null,
    checkOutTime: null,
    cancelReason: booking.cancellationReason ?? '',
    voidReason: '',
    guest: profile,
    companions: [],
    folio: [],
  };
}

function toGuestOrder(order: Order, id: number, fallbackRoom: string): GuestOrder {
  return {
    id,
    sourceId: order.id,
    items: order.items.map((item) => ({
      name: item.productName ?? item.productId,
      quantity: item.quantity,
      price: centsToAmount(item.unitPriceCents),
    })),
    time: formatDbTime(order.requestedAt),
    status: mapOrderStatus(order.status),
    note: order.notes ?? '',
    room: order.roomNumber ?? fallbackRoom,
  };
}

function toGuestRequest(
  request: ServiceRequest,
  id: number,
  kind: GuestServiceRequest['kind'],
  fallbackRoom: string,
): GuestServiceRequest {
  return {
    id,
    sourceId: request.id,
    kind,
    type: kind === 'housekeeping' ? 'Limpieza' : 'Servicio',
    description: request.description,
    time: formatDbTime(request.requestedAt),
    status: mapRequestStatus(request.status),
    room: request.roomNumber ?? fallbackRoom,
  };
}

function toGuestNotification(notification: Notification, id: number): GuestNotification {
  return {
    id,
    sourceId: notification.id,
    title: notification.title,
    message: notification.message,
    time: formatDbTime(notification.createdAt),
    read: notification.read,
    category: notification.type.startsWith('room_service') ? 'Pedido' : 'Servicio',
  };
}

function toGuestMenuItem(product: Product, id: number): GuestMenuItem {
  return {
    id,
    productId: product.id,
    name: product.name,
    description: product.description ?? product.sku,
    price: centsToAmount(product.priceCents),
    category: PRODUCT_CATEGORY_LABELS[product.category] ?? product.category,
    available: product.active,
    image: findPrimaryImage(product.images),
  };
}

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'No fue posible cargar tu portal de huésped.';
}

function GuestMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={19} />
      </div>
      <div>
        <p>{label}</p>
        <h2>{value}</h2>
        <span>{detail}</span>
      </div>
    </article>
  );
}

export function GuestContent({
  nav,
  onAction,
  onNavigate,
  onLogout,
}: {
  nav: string;
  onAction: (message: string) => void;
  onNavigate: (nav: string) => void;
  onLogout: () => void;
  // La identidad sale del JWT de huésped; estas props de sesión ya no se usan para buscarla.
  sessionUserId?: string;
  sessionName?: string;
  sessionEmail?: string;
}) {
  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setScreen({ status: 'loading' });
      try {
        const [
          stay,
          amenitiesData,
          products,
          ordersRaw,
          stayovers,
          concierge,
          notificationsRaw,
          bookingsRaw,
        ] = await Promise.all([
          guestPortalService.getStay(),
          catalogService.getGuestAmenities(),
          catalogService.getGuestProducts(),
          orderService.getGuestOrders(),
          housekeepingService.getGuestStayoverRequests(),
          serviceRequestService.getGuestConciergeRequests(),
          notificationService.getGuestNotifications(),
          guestPortalService.getBookings(),
        ]);
        const unreadCount = await notificationService.getGuestUnreadCount();

        // Perfil: `/guest/stay` solo trae el nombre; el resto se consulta en recepción.
        const profile: GuestInfo = {
          name: stay.guestFirstName,
          lastName: stay.guestLastName,
          phone: '',
          email: '',
          docType: '',
          docNumber: '',
          birthDate: '',
          nationality: '',
        };

        const reservations = bookingsRaw.map((booking, index) => {
          const isCurrentStay = booking.id === stay.bookingId;
          return toPortalReservationFromBooking(
            booking,
            index + 1,
            profile,
            isCurrentStay ? stay.roomTypeName : undefined,
            isCurrentStay ? stay.roomNumber : undefined,
            isCurrentStay ? stay.balanceCents : 0,
          );
        });

        const roomNumber = stay.roomNumber ?? 'Sin asignar';

        const serviceRequests: GuestServiceRequest[] = [
          ...stayovers.map((request) => ({ request, kind: 'housekeeping' as const })),
          ...concierge.map((request) => ({ request, kind: 'concierge' as const })),
        ]
          .sort(
            (left, right) =>
              right.request.requestedAt.getTime() - left.request.requestedAt.getTime(),
          )
          .map(({ request, kind }, index) => toGuestRequest(request, index + 1, kind, roomNumber));
        const orders = ordersRaw.map((order, index) => toGuestOrder(order, index + 1, roomNumber));
        const notifications = notificationsRaw.map((item, index) =>
          toGuestNotification(item, index + 1),
        );
        const menu = products.map((product, index) => toGuestMenuItem(product, index + 1));

        const amenities: GuestAmenity[] = amenitiesData.map((amenity, index) => ({
          name: amenity.name,
          description: amenity.description ?? '',
          icon: AMENITY_ICONS[index % AMENITY_ICONS.length],
          available: amenity.active,
          image: findPrimaryImage(amenity.images),
          schedule:
            amenity.opensAt && amenity.closesAt
              ? `${amenity.opensAt} — ${amenity.closesAt}`
              : 'Disponible',
        }));

        if (active) {
          setScreen({
            status: 'ready',
            stay,
            profile,
            reservations,
            notifications,
            unreadCount,
            serviceRequests,
            menu,
            orders,
            amenities,
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
  }, [reloadToken]);

  if (screen.status === 'loading') {
    return <LoadingState label="Cargando tu portal de huésped..." />;
  }

  if (screen.status === 'error') {
    return (
      <ErrorState
        title="No pudimos cargar tu portal de huésped"
        description={screen.message}
        onRetry={() => setReloadToken((value) => value + 1)}
      />
    );
  }

  return (
    <GuestContentReady
      nav={nav}
      onAction={onAction}
      onNavigate={onNavigate}
      onLogout={onLogout}
      onReload={() => setReloadToken((value) => value + 1)}
      initialProfile={screen.profile}
      initialStay={screen.stay}
      initialReservations={screen.reservations}
      initialNotifications={screen.notifications}
      initialUnreadCount={screen.unreadCount}
      initialServiceRequests={screen.serviceRequests}
      initialMenu={screen.menu}
      initialOrders={screen.orders}
      amenities={screen.amenities}
    />
  );
}

function GuestContentReady({
  nav,
  onAction,
  onNavigate,
  onLogout,
  onReload,
  initialProfile,
  initialStay,
  initialReservations,
  initialNotifications,
  initialUnreadCount,
  initialServiceRequests,
  initialMenu,
  initialOrders,
  amenities,
}: {
  nav: string;
  onAction: (message: string) => void;
  onNavigate: (nav: string) => void;
  onLogout: () => void;
  onReload: () => void;
  initialProfile: GuestInfo;
  initialStay: GuestStay;
  initialReservations: PortalReservation[];
  initialNotifications: GuestNotification[];
  initialUnreadCount: number;
  initialServiceRequests: GuestServiceRequest[];
  initialMenu: GuestMenuItem[];
  initialOrders: GuestOrder[];
  amenities: GuestAmenity[];
}) {
  const reservations = initialReservations;
  const profile = initialProfile;
  const [notifications, setNotifications] = useState<GuestNotification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [serviceRequests, setServiceRequests] =
    useState<GuestServiceRequest[]>(initialServiceRequests);
  const [orders, setOrders] = useState<GuestOrder[]>(initialOrders);
  const [cart, setCart] = useState<GuestCartItem[]>([]);
  const [orderNote, setOrderNote] = useState('');

  const [detailResId, setDetailResId] = useState<number | null>(null);
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [showRequestService, setShowRequestService] = useState<
    'Limpieza' | 'Articulos' | 'Conserjería' | null
  >(null);

  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null);
  const [resFilter, setResFilter] = useState<'Todas' | 'Activas' | 'Pasadas' | 'Canceladas'>(
    'Todas',
  );
  const [menuCat, setMenuCat] = useState('Todos');

  const detailRes =
    detailResId !== null ? (reservations.find((r) => r.id === detailResId) ?? null) : null;

  const activeReservations = reservations.filter(
    (r) => !['Cancelada', 'Anulada', 'Check-out'].includes(r.status),
  );
  const pastReservations = reservations.filter((r) => ['Check-out'].includes(r.status));
  const cancelledReservations = reservations.filter((r) =>
    ['Cancelada', 'Anulada'].includes(r.status),
  );
  const currentStay =
    reservations.find((r) => r.status === 'Check-in') ?? activeReservations[0] ?? null;
  const today = toDtoCalendarDate(new Date());
  const checkout = toDtoCalendarDate(initialStay.checkOut);
  const nightsRemaining =
    initialStay.status === 'checked_in' && checkout > today
      ? calculateNights(toDomainCalendarDate(today), initialStay.checkOut)
      : 0;
  const activeRequestCount = serviceRequests.filter(
    (request) => !['Completada', 'Cancelada'].includes(request.status),
  ).length;
  const activeOrderCount = orders.filter(
    (order) => !['Entregado', 'Cancelado'].includes(order.status),
  ).length;

  const filteredReservations =
    resFilter === 'Todas'
      ? reservations
      : resFilter === 'Activas'
        ? activeReservations
        : resFilter === 'Pasadas'
          ? pastReservations
          : cancelledReservations;

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addToCart = (item: GuestMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing)
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      return [
        ...prev,
        {
          id: item.id,
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: 1,
        },
      ];
    });
  };
  const removeFromCart = (id: number) => setCart((prev) => prev.filter((c) => c.id !== id));
  const updateCartQty = (id: number, delta: number) =>
    setCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)),
    );

  // Portal del huésped: el backend toma la reserva del JWT; ninguna acción envía bookingId.
  const submitOrder = async () => {
    if (cart.length === 0) return;
    try {
      const order = await orderService.createGuestOrder({
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        notes: orderNote,
      });
      const newOrder = toGuestOrder(order, orders.length + 1, currentStay?.roomNumber ?? '');
      setOrders((prev) => [newOrder, ...prev]);
      setCart([]);
      setOrderNote('');
      onAction(`Pedido #${newOrder.id} enviado a la habitación ${newOrder.room}`);
    } catch (cause) {
      onAction(getErrorMessage(cause));
    }
  };

  const cancelOrder = async (orderId: number) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    try {
      const updated = await orderService.cancelGuestOrder(order.sourceId);
      setOrders((prev) =>
        prev.map((item) =>
          item.id === orderId ? { ...item, status: mapOrderStatus(updated.status) } : item,
        ),
      );
      setCancelOrderId(null);
      onAction(`Pedido #${orderId} cancelado correctamente`);
    } catch (cause) {
      onAction(getErrorMessage(cause));
    }
  };

  const submitServiceRequest = async (data: {
    type: string;
    description: string;
    time: string;
    itemId?: string;
    quantity?: number;
    conciergeServiceId?: string;
    housekeepingServiceId?: string;
    notes?: string;
  }) => {
    // Limpieza y artículos se atienden desde Housekeeping; otros pedidos van a Conserjería.
    const kind: GuestServiceRequest['kind'] =
      data.type === 'Limpieza' || data.type === 'Artículos' ? 'housekeeping' : 'concierge';
    const payload = {
      description: data.description,
      notes: `${data.time}${data.notes ? ` · ${data.notes}` : ''}`,
    };
    try {
      const request =
        kind === 'housekeeping'
          ? data.type === 'Artículos' && data.itemId && data.quantity
            ? await housekeepingService.createGuestHousekeepingItemRequest({
                itemId: data.itemId,
                quantity: data.quantity,
                notes: `${data.time}${data.notes ? ` · ${data.notes}` : ''}`,
              })
            : await housekeepingService.createGuestStayoverRequest({
                ...payload,
                serviceId: data.housekeepingServiceId,
              })
          : await serviceRequestService.createGuestConciergeRequest({
              ...payload,
              serviceId: data.conciergeServiceId!,
            });
      const newReq = toGuestRequest(
        request,
        serviceRequests.length + 1,
        kind,
        currentStay?.roomNumber ?? '',
      );
      setServiceRequests((prev) => [newReq, ...prev]);
      setShowRequestService(null);
      onAction(
        kind === 'housekeeping'
          ? data.type === 'Artículos'
            ? 'Solicitud de artículos enviada al equipo de limpieza'
            : 'Solicitud enviada al equipo de limpieza'
          : 'Solicitud enviada a conserjería',
      );
    } catch (cause) {
      onAction(getErrorMessage(cause));
    }
  };

  const cancelServiceRequest = async (reqId: number) => {
    const request = serviceRequests.find((item) => item.id === reqId);
    if (!request) return;
    try {
      const updated =
        request.kind === 'housekeeping'
          ? await housekeepingService.cancelGuestStayoverRequest(request.sourceId)
          : await serviceRequestService.cancelGuestConciergeRequest(request.sourceId);
      setServiceRequests((prev) =>
        prev.map((item) =>
          item.id === reqId ? { ...item, status: mapRequestStatus(updated.status) } : item,
        ),
      );
      onAction('Solicitud cancelada');
    } catch (cause) {
      onAction(getErrorMessage(cause));
    }
  };

  // El contador sale del backend; se vuelve a pedir después de cada cambio.
  const refreshUnreadCount = async () => {
    try {
      setUnreadCount(await notificationService.getGuestUnreadCount());
    } catch {
      setUnreadCount(notifications.filter((item) => !item.read).length);
    }
  };

  const markNotificationRead = async (id: number) => {
    const notification = notifications.find((item) => item.id === id);
    if (!notification || notification.read) return;
    try {
      await notificationService.markGuestNotificationRead(notification.sourceId);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
      await refreshUnreadCount();
    } catch (cause) {
      onAction(getErrorMessage(cause));
    }
  };
  const markAllRead = async () => {
    try {
      const updated = await notificationService.markAllGuestNotificationsRead();
      setNotifications(updated.map((item, index) => toGuestNotification(item, index + 1)));
      await refreshUnreadCount();
      onAction('Todas las notificaciones marcadas como leídas');
    } catch (cause) {
      onAction(getErrorMessage(cause));
    }
  };

  // ─── HOME / OVERVIEW ───────────────────────────────────────────
  if (nav === 'Inicio') {
    return (
      <>
        <section className="metric-grid" aria-label="Resumen de tu estancia">
          <GuestMetric
            label="Noches restantes"
            value={
              initialStay.status === 'checked_in' ? String(nightsRemaining).padStart(2, '0') : '—'
            }
            detail={
              initialStay.status === 'checked_in'
                ? `Check-out: ${fmtDate(checkout)}`
                : 'Sin estancia activa'
            }
            icon={CalendarDays}
            tone="sage"
          />
          <GuestMetric
            label="Saldo pendiente"
            value={formatCurrency(Math.max(0, initialStay.balanceCents), initialStay.currency)}
            detail="Saldo actual de tu estancia"
            icon={Wallet}
            tone="gold"
          />
          <GuestMetric
            label="Servicios activos"
            value={String(activeRequestCount + activeOrderCount).padStart(2, '0')}
            detail={`${activeRequestCount} solicitudes · ${activeOrderCount} pedidos`}
            icon={Sparkles}
            tone="terracotta"
          />
          <GuestMetric
            label="Reservas"
            value={String(reservations.length).padStart(2, '0')}
            detail={`${activeReservations.length} activas`}
            icon={Activity}
            tone="blue"
          />
        </section>
        <div className="gs-overview">
          <div className="gs-overview-main">
            <div className="gs-overview-hero">
              <div>
                {currentStay ? (
                  <>
                    <span className={`status-pill ${resStatusClass(currentStay.status)}`}>
                      {currentStay.status}
                    </span>
                    <h4>
                      {currentStay.roomType} · Habitacion {currentStay.roomNumber}
                    </h4>
                    <p>
                      {fmtDate(currentStay.checkIn)} — {fmtDate(currentStay.checkOut)}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="status-pill warning">Sin estancia activa</span>
                    <h4>Tu estancia no está activa</h4>
                    <p>El portal funciona desde el check-in hasta el check-out.</p>
                  </>
                )}
              </div>
              <div className="stay-art">
                <BedDouble size={48} strokeWidth={1.2} />
              </div>
            </div>
            <div className="gs-overview-details">
              <div>
                <span>Proximo evento</span>
                <strong>{currentStay ? 'Check-out' : 'Reserva'}</strong>
                <small>{currentStay ? fmtDate(currentStay.checkOut) : 'Pendiente'}</small>
              </div>
              <div>
                <span>Saldo pendiente</span>
                <strong>{formatCurrency(Math.max(0, currentStay?.balanceCents ?? 0))}</strong>
                <small>Se carga al finalizar tu estancia</small>
              </div>
            </div>
            <div className="gs-overview-quick">
              <button onClick={() => setShowRequestService('Limpieza')}>
                <span className="gs-quick-icon sage">
                  <Sparkles size={18} />
                </span>
                <strong>Limpieza</strong>
                <small>Solicitar servicio</small>
              </button>
              <button onClick={() => setShowRequestService('Articulos')}>
                <span className="gs-quick-icon gold">
                  <Package size={18} />
                </span>
                <strong>Artículos</strong>
                <small>Toallas, almohadas</small>
              </button>
              <button onClick={() => onNavigate('Room service')}>
                <span className="gs-quick-icon terracotta">
                  <ClipboardList size={18} />
                </span>
                <strong>Room Service</strong>
                <small>Pide a tu cuarto</small>
              </button>
              <button onClick={() => onNavigate('Amenidades')}>
                <span className="gs-quick-icon blue">
                  <Activity size={18} />
                </span>
                <strong>Amenidades</strong>
                <small>Ver disponibles</small>
              </button>
            </div>
          </div>
          <div className="gs-overview-notif">
            <div className="gs-overview-notif-head">
              <div>
                <h3>Actividad reciente</h3>
                <p>Últimos movimientos de tu estancia</p>
              </div>
              {unreadCount > 0 && (
                <span className="status-pill warning">{unreadCount} sin leer</span>
              )}
            </div>
            <div className="activity-list">
              {notifications.slice(0, 3).map((n) => (
                <div className="activity-item" key={n.id}>
                  <span className={`activity-dot ${n.read ? 'info' : 'success'}`} />
                  <div>
                    <p>{n.title}</p>
                    <small>{n.time}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {showRequestService && (
          <RequestServiceModal
            mode={showRequestService}
            roomNumber={currentStay?.roomNumber}
            onClose={() => setShowRequestService(null)}
            onSubmit={submitServiceRequest}
          />
        )}
      </>
    );
  }

  // ─── MY RESERVATIONS ───────────────────────────────────────────
  if (nav === 'Mis reservas') {
    return (
      <>
        <div className="panel">
          <div
            className="panel-heading"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              <h3>Mis reservas</h3>
              <p>Historial y reservas activas asociadas a tu cuenta de huésped.</p>
            </div>
            <button
              type="button"
              className="button primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}
              onClick={() => setShowCreateBooking(true)}
            >
              <Plus size={16} /> Nueva reserva
            </button>
          </div>
          <div className="toolbar">
            <div className="filter-dropdown">
              <button className="filter-button">
                <span>{resFilter}</span>
                <ChevronDown size={15} />
              </button>

              <div className="filter-menu">
                <button
                  className={resFilter === 'Todas' ? 'active' : ''}
                  onClick={() => setResFilter('Todas')}
                >
                  Todas
                </button>
                <button
                  className={resFilter === 'Activas' ? 'active' : ''}
                  onClick={() => setResFilter('Activas')}
                >
                  Activas
                </button>
                <button
                  className={resFilter === 'Pasadas' ? 'active' : ''}
                  onClick={() => setResFilter('Pasadas')}
                >
                  Pasadas
                </button>
                <button
                  className={resFilter === 'Canceladas' ? 'active' : ''}
                  onClick={() => setResFilter('Canceladas')}
                >
                  Canceladas
                </button>
              </div>
            </div>
          </div>
          <div className="gs-res-list">
            {filteredReservations.length === 0 ? (
              <div className="hk-empty">
                <CalendarDays size={22} />
                <p>No tienes reservas en esta categoría</p>
              </div>
            ) : (
              filteredReservations.map((res) => {
                const nights = Math.max(
                  1,
                  calculateNights(
                    toDomainCalendarDate(res.checkIn),
                    toDomainCalendarDate(res.checkOut),
                  ),
                );
                return (
                  <article
                    className="gs-res-card"
                    key={res.id}
                    onClick={() => setDetailResId(res.id)}
                  >
                    <div className="gs-res-card-head">
                      <div>
                        <span className="gs-res-code">{res.code}</span>
                        <strong>
                          Habitación {res.roomNumber} · {res.roomType}
                        </strong>
                        <small>
                          {fmtDate(res.checkIn)} — {fmtDate(res.checkOut)} · {nights} noches
                        </small>
                      </div>
                      <span className={`status-pill ${resStatusClass(res.status)}`}>
                        {res.status}
                      </span>
                    </div>
                    <div className="gs-res-card-meta">
                      {res.guestCount > 0 && (
                        <span>
                          <BedDouble size={14} /> {res.guestCount} huéspedes
                        </span>
                      )}
                      <span>
                        <Wallet size={14} />{' '}
                        {res.rate > 0 ? money(res.rate * nights) : 'Consulta en recepción'}
                      </span>
                      <span>
                        <CalendarDays size={14} /> {res.origin}
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
        {detailRes && (
          <ReservationDetailModal reservation={detailRes} onClose={() => setDetailResId(null)} />
        )}
        {showCreateBooking && (
          <CreateBookingModal
            onClose={() => setShowCreateBooking(false)}
            onCreated={(msg) => {
              setShowCreateBooking(false);
              onAction(msg);
              onReload();
            }}
          />
        )}
      </>
    );
  }

  // ─── MY STAY ───────────────────────────────────────────────────
  if (nav === 'Mi estancia') {
    if (!currentStay) {
      return (
        <div className="panel">
          <div className="hk-empty">
            <BedDouble size={22} />
            <p>No tienes una estancia activa en este momento</p>
            <small>El portal funciona desde el check-in hasta el check-out.</small>
          </div>
        </div>
      );
    }
    const nights = Math.max(
      1,
      calculateNights(
        toDomainCalendarDate(currentStay.checkIn),
        toDomainCalendarDate(currentStay.checkOut),
      ),
    );
    return (
      <>
        <div className="gs-stay-layout">
          <div className="panel gs-stay-main">
            <div className="panel-heading">
              <div>
                <h3>Mi estancia</h3>
                <p>Detalles de tu estancia actual</p>
              </div>
              <span className={`status-pill ${resStatusClass(currentStay.status)}`}>
                {currentStay.status}
              </span>
            </div>
            <div className="gs-stay-hero">
              <div className="stay-art">
                <BedDouble size={48} strokeWidth={1.2} />
              </div>
              <div>
                <h4>
                  {currentStay.roomType} · Habitacion {currentStay.roomNumber}
                </h4>
                <p>
                  {fmtDate(currentStay.checkIn)} — {fmtDate(currentStay.checkOut)}
                </p>
                <small>{nights} noches</small>
              </div>
            </div>
            <div className="gs-stay-info">
              <div>
                <small>Check-in</small>
                <strong>{fmtDate(currentStay.checkIn)}</strong>
                {currentStay.checkInTime && <span>{currentStay.checkInTime} hrs</span>}
              </div>
              <div>
                <small>Check-out</small>
                <strong>{fmtDate(currentStay.checkOut)}</strong>
                <span>12:00 hrs</span>
              </div>
              <div>
                <small>Tarifa/noche</small>
                <strong>
                  {currentStay.rate > 0 ? money(currentStay.rate) : 'Consulta en recepción'}
                </strong>
              </div>
              <div>
                <small>Total estancia</small>
                <strong>
                  {currentStay.rate > 0
                    ? money(currentStay.rate * nights)
                    : 'Consulta en recepción'}
                </strong>
              </div>
            </div>
            <div className="gs-stay-services">
              <h4>Servicios contratados</h4>
              <div className="gs-stay-service-list">
                <div className="gs-stay-service-item">
                  <span className="gs-quick-icon sage">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <strong>Desayuno incluido</strong>
                    <small>Servicio diario de 7:00 a 11:00</small>
                  </div>
                  <Check size={16} />
                </div>
                <div className="gs-stay-service-item">
                  <span className="gs-quick-icon blue">
                    <Activity size={16} />
                  </span>
                  <div>
                    <strong>Wi-Fi de alta velocidad</strong>
                    <small>Conexión gratuita en todo el hotel</small>
                  </div>
                  <Check size={16} />
                </div>
                <div className="gs-stay-service-item">
                  <span className="gs-quick-icon gold">
                    <ShieldCheck size={16} />
                  </span>
                  <div>
                    <strong>Acceso a gimnasio y spa</strong>
                    <small>Incluido en tu tarifa</small>
                  </div>
                  <Check size={16} />
                </div>
                {currentStay.observations && (
                  <div className="gs-stay-obs">
                    <FileText size={14} />
                    <p>{currentStay.observations}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <aside className="panel gs-stay-side">
            <div className="panel-heading">
              <div>
                <h3>Acciones rápidas</h3>
              </div>
            </div>
            <div className="gs-stay-actions">
              <button
                className="button secondary"
                onClick={() => setShowRequestService('Limpieza')}
              >
                <Sparkles size={15} /> Solicitar limpieza
              </button>
              <button
                className="button secondary"
                onClick={() => setShowRequestService('Articulos')}
              >
                <Package size={15} /> Pedir artículos
              </button>
              <button className="button secondary" onClick={() => onNavigate('Room service')}>
                <ClipboardList size={15} /> Room Service
              </button>
              <button className="button secondary" onClick={() => setDetailResId(currentStay.id)}>
                <FileText size={15} /> Ver mi reserva
              </button>
            </div>
            <div className="gs-stay-side-info">
              <strong>Saldo pendiente</strong>
              <span className="gs-stay-balance">
                {money(Math.max(0, currentStay.balanceCents / 100))}
              </span>
              <small>Se carga al finalizar tu estancia</small>
            </div>
          </aside>
        </div>
        {showRequestService && (
          <RequestServiceModal
            mode={showRequestService}
            roomNumber={currentStay?.roomNumber}
            onClose={() => setShowRequestService(null)}
            onSubmit={submitServiceRequest}
          />
        )}
        {detailRes && (
          <ReservationDetailModal reservation={detailRes} onClose={() => setDetailResId(null)} />
        )}
      </>
    );
  }

  // ─── AMENITIES ─────────────────────────────────────────────────
  if (nav === 'Amenidades') {
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Amenidades del hotel</h3>
            <p>Todo lo que puedes disfrutar durante tu estancia</p>
          </div>
        </div>
        <div className="gs-amenities-grid">
          {amenities.map((am) => {
            const Icon = am.icon;
            return (
              <div
                className={`gs-amenity-card ${!am.available ? 'unavailable' : ''}`}
                key={am.name}
              >
                {am.image ? (
                  <div className="gs-amenity-photo">
                    <CatalogImage image={am.image} variant="thumb" alt={`Foto de ${am.name}`} />
                  </div>
                ) : (
                  <div className="gs-amenity-icon">
                    <Icon size={22} />
                  </div>
                )}
                <div className="gs-amenity-body">
                  <div>
                    <strong>{am.name}</strong>
                    {am.available ? (
                      <span className="status-pill success">Disponible</span>
                    ) : (
                      <span className="status-pill terracotta">No disponible</span>
                    )}
                  </div>
                  <p>{am.description}</p>
                  <small>
                    <Clock size={12} /> {am.schedule}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (nav === 'Conserjería') {
    const conciergeRequests = serviceRequests.filter((request) => request.kind === 'concierge');
    return (
      <>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Conserjería</h3>
              <p>Traslados, reservas y ayuda personalizada durante tu estancia.</p>
            </div>
            <button
              className="button small primary"
              onClick={() => setShowRequestService('Conserjería')}
            >
              <MessageSquare size={15} /> Solicitar asistencia
            </button>
          </div>
          <div className="gs-req-summary">
            <div>
              <span className="status-pill warning">Pendientes</span>
              <strong>{conciergeRequests.filter((r) => r.status === 'Pendiente').length}</strong>
            </div>
            <div>
              <span className="status-pill info">En proceso</span>
              <strong>{conciergeRequests.filter((r) => r.status === 'En proceso').length}</strong>
            </div>
            <div>
              <span className="status-pill success">Completadas</span>
              <strong>{conciergeRequests.filter((r) => r.status === 'Completada').length}</strong>
            </div>
          </div>
          <div className="gs-req-list">
            {conciergeRequests.length === 0 ? (
              <div className="hk-empty">
                <MessageSquare size={22} />
                <p>Aún no tienes solicitudes de conserjería</p>
              </div>
            ) : (
              conciergeRequests.map((req) => (
                <div className="gs-req-row" key={req.id}>
                  <div className="gs-req-info">
                    <span className="gs-req-type">
                      <MessageSquare size={15} />
                    </span>
                    <div>
                      <small className="gs-req-category">Conserjería</small>
                      <strong>{req.description}</strong>
                      <small>
                        Solicitada: {req.time} · Habitación {req.room}
                      </small>
                    </div>
                  </div>
                  <div className="gs-req-actions">
                    <span className={`status-pill ${reqStatusClass(req.status)}`}>
                      {req.status}
                    </span>
                    {canCancelGuestRequest(req) && (
                      <button
                        className="button small terracotta-btn"
                        onClick={() => cancelServiceRequest(req.id)}
                      >
                        <Ban size={14} /> Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {showRequestService === 'Conserjería' && (
          <RequestServiceModal
            mode="Conserjería"
            roomNumber={currentStay?.roomNumber}
            onClose={() => setShowRequestService(null)}
            onSubmit={submitServiceRequest}
          />
        )}
      </>
    );
  }

  // ─── ROOM SERVICES (Cleaning + Items) ──────────────────────────
  if (nav === 'Limpieza y artículos') {
    const roomRequests = serviceRequests.filter((request) => request.kind === 'housekeeping');
    return (
      <>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Limpieza y artículos</h3>
              <p>Solicita limpieza o pide artículos disponibles para tu habitación.</p>
            </div>
            <div className="gs-heading-actions">
              <button
                className="button small primary"
                onClick={() => setShowRequestService('Limpieza')}
              >
                <Sparkles size={15} /> Solicitar limpieza
              </button>
              <button
                className="button small secondary"
                onClick={() => setShowRequestService('Articulos')}
              >
                <Package size={15} /> Pedir artículos
              </button>
            </div>
          </div>
          <div className="gs-req-summary">
            <div>
              <span className="status-pill warning">Pendientes</span>
              <strong>{roomRequests.filter((r) => r.status === 'Pendiente').length}</strong>
            </div>
            <div>
              <span className="status-pill info">En proceso</span>
              <strong>{roomRequests.filter((r) => r.status === 'En proceso').length}</strong>
            </div>
            <div>
              <span className="status-pill success">Completadas</span>
              <strong>{roomRequests.filter((r) => r.status === 'Completada').length}</strong>
            </div>
          </div>
          <div className="gs-req-list">
            {roomRequests.length === 0 ? (
              <div className="hk-empty">
                <ClipboardList size={22} />
                <p>No tienes solicitudes de limpieza</p>
              </div>
            ) : (
              roomRequests.map((req) => (
                <div className="gs-req-row" key={req.id}>
                  <div className="gs-req-info">
                    <span className="gs-req-type">
                      <Sparkles size={15} />
                    </span>
                    <div>
                      <strong>{req.description}</strong>
                      <small>
                        Solicitada: {req.time} · Habitación {req.room}
                      </small>
                    </div>
                  </div>
                  <div className="gs-req-actions">
                    <span className={`status-pill ${reqStatusClass(req.status)}`}>
                      {req.status}
                    </span>
                    {canCancelGuestRequest(req) && (
                      <button
                        className="button small terracotta-btn"
                        onClick={() => cancelServiceRequest(req.id)}
                      >
                        <Ban size={14} /> Cancelar
                      </button>
                    )}
                    {req.status === 'En proceso' && (
                      <span className="gs-req-progress">
                        <Clock size={14} /> En atención
                      </span>
                    )}
                    {req.status === 'Completada' && <Check size={16} className="gs-req-done" />}
                    {req.status === 'Cancelada' && (
                      <span className="gs-req-cancelled">Cancelada</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {showRequestService && (
          <RequestServiceModal
            mode={showRequestService}
            roomNumber={currentStay?.roomNumber}
            onClose={() => setShowRequestService(null)}
            onSubmit={submitServiceRequest}
          />
        )}
      </>
    );
  }

  // ─── ROOM SERVICE (Food & Beverage) ────────────────────────────
  if (nav === 'Room service') {
    const categories = [...new Set(initialMenu.map((m) => m.category))];
    const filteredMenu =
      menuCat === 'Todos' ? initialMenu : initialMenu.filter((m) => m.category === menuCat);
    return (
      <>
        <div className="gs-rs-layout">
          <div className="panel gs-rs-menu">
            <div className="panel-heading">
              <div>
                <h3>Menú de Room Service</h3>
                <p>Selecciona productos y envía tu pedido</p>
              </div>
            </div>
            <div className="toolbar">
              <div className="filter-dropdown">
                <button className="filter-button">
                  <span>{menuCat}</span>
                  <ChevronDown size={15} />
                </button>
                <div className="filter-menu">
                  <button
                    className={menuCat === 'Todos' ? 'active' : ''}
                    onClick={() => setMenuCat('Todos')}
                  >
                    Todos
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      className={menuCat === cat ? 'active' : ''}
                      onClick={() => setMenuCat(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="gs-menu-grid">
              {filteredMenu.map((item) => (
                <div
                  className={`gs-menu-card ${!item.available ? 'unavailable' : ''}`}
                  key={item.id}
                >
                  <div className="gs-menu-card-photo">
                    <CatalogImage image={item.image} variant="thumb" alt={`Foto de ${item.name}`} />
                  </div>
                  <div className="gs-menu-card-body">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.description}</p>
                      <span className="gs-menu-price">{money(item.price)}</span>
                    </div>
                    {item.available ? (
                      <button className="button small primary" onClick={() => addToCart(item)}>
                        <Plus size={14} /> Agregar
                      </button>
                    ) : (
                      <span className="status-pill terracotta">No disponible</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <aside className="panel gs-rs-cart">
            <div className="panel-heading">
              <div>
                <h3>Mi pedido</h3>
                <p>Habitacion {currentStay?.roomNumber ?? 'Sin asignar'}</p>
              </div>
              {cart.length > 0 && <span className="status-pill warning">{cart.length} items</span>}
            </div>
            {cart.length === 0 ? (
              <div className="hk-empty">
                <ClipboardList size={22} />
                <p>Tu pedido está vacío</p>
                <small>Selecciona productos del menú para agregarlos</small>
              </div>
            ) : (
              <>
                <div className="gs-cart-list">
                  {cart.map((item) => (
                    <div className="gs-cart-row" key={item.id}>
                      <div className="gs-cart-info">
                        <strong>{item.name}</strong>
                        <small>{money(item.price)} c/u</small>
                      </div>
                      <div className="gs-cart-controls">
                        <button onClick={() => updateCartQty(item.id, -1)}>
                          <X size={12} />
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateCartQty(item.id, 1)}>
                          <Plus size={12} />
                        </button>
                        <strong className="gs-cart-subtotal">
                          {money(item.price * item.quantity)}
                        </strong>
                        <button className="gs-cart-remove" onClick={() => removeFromCart(item.id)}>
                          <Ban size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <label className="hk-form-label">
                  Notas del pedido
                  <textarea
                    className="hk-form-textarea"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Indica preferencias o alergias..."
                  />
                </label>
                <div className="gs-cart-total">
                  <span>Total</span>
                  <strong>{money(cartTotal)}</strong>
                </div>
                <button className="button primary gs-cart-submit" onClick={submitOrder}>
                  <ClipboardList size={16} /> Enviar pedido a habitacion{' '}
                  {currentStay?.roomNumber ?? 'Sin asignar'} <ArrowRight size={16} />
                </button>
              </>
            )}
          </aside>
        </div>
      </>
    );
  }

  // ─── MY REQUESTS & ORDERS ───────────────────────────────────────
  if (nav === 'Mis solicitudes y pedidos') {
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Mis solicitudes y pedidos</h3>
            <p>Estado de tus solicitudes de servicio y pedidos de Room Service</p>
          </div>
        </div>
        <div className="gs-orders-section">
          <h4>Pedidos de Room Service</h4>
          <div className="gs-orders-list">
            {orders.length === 0 ? (
              <div className="hk-empty">
                <ClipboardList size={22} />
                <p>No tienes pedidos de Room Service</p>
              </div>
            ) : (
              orders.map((order) => {
                const total = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
                const canCancel = canCancelGuestOrder(order);
                return (
                  <div className="gs-order-card" key={order.id}>
                    <div className="gs-order-head">
                      <div>
                        <span className="gs-order-num">Pedido #{order.id}</span>
                        <strong>
                          {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                        </strong>
                        <small>
                          {order.time} · Habitación {order.room}
                        </small>
                      </div>
                      <span className={`status-pill ${orderStatusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    {order.note && (
                      <div className="gs-order-note">
                        <FileText size={13} /> {order.note}
                      </div>
                    )}
                    <div className="gs-order-foot">
                      <span className="gs-order-total">{money(total)}</span>
                      {canCancel ? (
                        <button
                          className="button small terracotta-btn"
                          onClick={() => setCancelOrderId(order.id)}
                        >
                          <Ban size={14} /> Cancelar
                        </button>
                      ) : order.status === 'Cancelado' ? (
                        <span className="gs-order-cancelled">Pedido cancelado</span>
                      ) : order.status === 'Entregado' ? (
                        <span className="gs-order-delivered">
                          <Check size={15} /> Entregado
                        </span>
                      ) : (
                        <button className="button small secondary" disabled>
                          <Ban size={14} /> Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="gs-orders-section">
          <h4>Solicitudes de servicio</h4>
          <div className="gs-req-list">
            {serviceRequests.length === 0 ? (
              <div className="hk-empty">
                <Sparkles size={22} />
                <p>No tienes solicitudes de servicio</p>
              </div>
            ) : (
              serviceRequests.map((req) => (
                <div className="gs-req-row" key={req.id}>
                  <div className="gs-req-info">
                    <span className="gs-req-type">
                      {req.kind === 'housekeeping' ? <Sparkles size={15} /> : <Package size={15} />}
                    </span>
                    <div>
                      <small className="gs-req-category">
                        {req.kind === 'housekeeping' ? 'Limpieza de habitación' : 'Conserjería'}
                      </small>
                      <strong>{req.description}</strong>
                      <small>
                        Solicitada: {req.time} · Habitación {req.room}
                      </small>
                    </div>
                  </div>
                  <div className="gs-req-actions">
                    <span className={`status-pill ${reqStatusClass(req.status)}`}>
                      {req.status}
                    </span>
                    {canCancelGuestRequest(req) && (
                      <button
                        className="button small terracotta-btn"
                        onClick={() => cancelServiceRequest(req.id)}
                      >
                        <Ban size={14} /> Cancelar
                      </button>
                    )}
                    {req.status === 'En proceso' && (
                      <span className="gs-req-progress">
                        <Clock size={14} /> En atención
                      </span>
                    )}
                    {req.status === 'Completada' && <Check size={16} className="gs-req-done" />}
                    {req.status === 'Cancelada' && (
                      <span className="gs-req-cancelled">Cancelada</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {cancelOrderId !== null && (
          <CancelOrderModal
            orderId={cancelOrderId}
            orderInfo={
              orders
                .find((o) => o.id === cancelOrderId)
                ?.items.map((i) => `${i.quantity}× ${i.name}`)
                .join(', ') ?? ''
            }
            onClose={() => setCancelOrderId(null)}
            onConfirm={() => cancelOrder(cancelOrderId)}
          />
        )}
      </div>
    );
  }

  // ─── NOTIFICATIONS ─────────────────────────────────────────────
  if (nav === 'Notificaciones') {
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Notificaciones</h3>
            <p>
              {unreadCount > 0
                ? `${unreadCount} notificaciones sin leer`
                : 'Todas tus notificaciones están leídas'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button className="button small secondary" onClick={markAllRead}>
              <Check size={14} /> Marcar todas como leídas
            </button>
          )}
        </div>
        <div className="gs-notif-list">
          {notifications.length === 0 ? (
            <div className="hk-empty">
              <Bell size={22} />
              <p>No tienes notificaciones</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                className={`gs-notif-card ${!n.read ? 'unread' : ''}`}
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
              >
                <div className="gs-notif-dot">
                  {!n.read && <span className="gs-notif-unread-dot" />}
                </div>
                <div className="gs-notif-body">
                  <div className="gs-notif-head">
                    <strong>{n.title}</strong>
                    <span
                      className={`status-pill ${n.category === 'Promoción' ? 'gold' : n.category === 'Pedido' ? 'info' : n.category === 'Servicio' ? 'terracotta' : 'success'}`}
                    >
                      {n.category}
                    </span>
                  </div>
                  <p>{n.message}</p>
                  <small>{n.time}</small>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ─── MY PROFILE ────────────────────────────────────────────────
  if (nav === 'Mi perfil') {
    return (
      <>
        <div className="panel" style={{ maxWidth: 580, margin: '0 auto' }}>
          <div className="panel-heading">
            <div>
              <h3>Mi perfil</h3>
              <p>Para actualizar tus datos, consulta en recepción.</p>
            </div>
          </div>
          <div className="hk-profile">
            <div className="hk-profile-avatar cream">MC</div>
            <div className="hk-profile-info">
              <h4>
                {profile.name} {profile.lastName}
              </h4>
              <p>Huésped · Hotel Aurora</p>
            </div>
          </div>
          <div className="gs-profile-detail">
            <div>
              <span>Nombre</span>
              <strong>{profile.name}</strong>
            </div>
            <div>
              <span>Apellidos</span>
              <strong>{profile.lastName}</strong>
            </div>
            <div>
              <span>Teléfono</span>
              <strong>{profile.phone || 'Consulta en recepción'}</strong>
            </div>
            <div>
              <span>Correo electrónico</span>
              <strong>{profile.email || 'Consulta en recepción'}</strong>
            </div>
            <div>
              <span>Tipo de documento</span>
              <strong>{profile.docType || 'Consulta en recepción'}</strong>
            </div>
            <div>
              <span>Número de documento</span>
              <strong>{profile.docNumber || 'Consulta en recepción'}</strong>
            </div>
            <div>
              <span>Fecha de nacimiento</span>
              <strong>
                {profile.birthDate ? fmtDate(profile.birthDate) : 'Consulta en recepción'}
              </strong>
            </div>
            <div>
              <span>Nacionalidad</span>
              <strong>{profile.nationality || 'Consulta en recepción'}</strong>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── LOG OUT ───────────────────────────────────────────────────
  if (nav === 'Cerrar sesión') {
    return (
      <div className="panel" style={{ maxWidth: 420, margin: '0 auto' }}>
        <div className="hk-empty">
          <UserRound size={22} />
          <p>¿Seguro que deseas cerrar sesión?</p>
          <small>Puedes volver a iniciar sesión cuando quieras.</small>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button className="button secondary" onClick={() => onAction('Cancelado')}>
            Cancelar
          </button>
          <button className="button terracotta-btn" onClick={onLogout}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="hk-empty">
        <Home size={22} />
        <p>Selecciona una opción del menú</p>
      </div>
    </div>
  );
}
