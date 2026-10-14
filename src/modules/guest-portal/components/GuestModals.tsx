/* eslint-disable react-refresh/only-export-components -- Helpers compartidos del prototipo Bolt migrado. */
import { useCallback, useEffect, useState } from 'react';
import type { MediaImage } from '@/shared/types/entities/media-image';
import { CatalogImage } from '@/shared/components/CatalogImage';
import { inventoryService, type GuestHousekeepingItem } from '@/services/inventoryService';
import {
  conciergeCatalogService,
  type ConciergeServiceOption,
} from '@/services/conciergeCatalogService';
import {
  housekeepingCatalogService,
  type HousekeepingServiceOption,
} from '@/services/housekeepingCatalogService';
import {
  ArrowRight,
  Ban,
  BedDouble,
  CalendarDays,
  Download,
  Minus,
  Plus,
  TriangleAlert,
  X,
} from 'lucide-react';
import type {
  Reservation,
  GuestInfo,
  ReservationStatus,
} from '@/private/workspace/PrivateWorkspace';
import { toDomainCalendarDate } from '@/shared/types/common';
import { calculateNights } from '@/shared/utils/date';

export type GuestNotification = {
  id: number;
  sourceId: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  category: 'Estancia' | 'Servicio' | 'Pedido' | 'Promoción';
};

export type GuestServiceRequest = {
  id: number;
  sourceId: string;
  /** Limpieza de estancia (`/guest/housekeeping`) o Conserjería (`/guest/concierge`). */
  kind: 'housekeeping' | 'concierge';
  type: string;
  description: string;
  time: string;
  status: 'Pendiente' | 'Aceptada' | 'En proceso' | 'Completada' | 'Cancelada';
  room: string;
};

export type GuestMenuItem = {
  id: number;
  productId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  /** Foto principal del producto (backend #82); sin foto se muestra un placeholder neutral. */
  image?: MediaImage;
};

export type GuestCartItem = {
  id: number;
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

export type GuestOrder = {
  id: number;
  sourceId: string;
  items: { name: string; quantity: number; price: number }[];
  time: string;
  status:
    'Pendiente' | 'Aceptado' | 'En preparación' | 'Listo' | 'En camino' | 'Entregado' | 'Cancelado';
  note: string;
  room: string;
};

export const money = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d: string) => {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const resStatusClass = (status: ReservationStatus): string =>
  status === 'Confirmada'
    ? 'success'
    : status === 'Pendiente'
      ? 'warning'
      : status === 'Check-in' || status === 'Check-out'
        ? 'info'
        : 'terracotta';

export const orderStatusClass = (status: string): string =>
  status === 'Pendiente'
    ? 'warning'
    : status === 'Aceptado' ||
        status === 'En preparación' ||
        status === 'Listo' ||
        status === 'En camino'
      ? 'info'
      : status === 'Entregado'
        ? 'success'
        : 'terracotta';

export const reqStatusClass = (status: string): string =>
  status === 'Pendiente'
    ? 'warning'
    : status === 'En proceso'
      ? 'info'
      : status === 'Completada'
        ? 'success'
        : 'terracotta';

export function ReservationDetailModal({
  reservation,
  onClose,
  onModify,
  onCancel,
  onReceipt,
}: {
  reservation: Reservation;
  onClose: () => void;
  /** Sin callback, la acción no tiene endpoint de huésped y se consulta en recepción (INT-12). */
  onModify?: () => void;
  onCancel?: () => void;
  onReceipt?: () => void;
}) {
  const nights = Math.max(
    1,
    calculateNights(
      toDomainCalendarDate(reservation.checkIn),
      toDomainCalendarDate(reservation.checkOut),
    ),
  );
  const total = reservation.rate * nights;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 480, maxWidth: 'calc(100vw - 32px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">DETALLE DE RESERVA</p>
            <h2>Reserva {reservation.code}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="gs-detail-status">
          <span className={`status-pill ${resStatusClass(reservation.status)}`}>
            {reservation.status}
          </span>
          <span className="gs-detail-room">
            <BedDouble size={15} /> Habitación {reservation.roomNumber} · {reservation.roomType}
          </span>
        </div>
        <div className="gs-detail-grid">
          <div>
            <small>Check-in</small>
            <strong>{fmtDate(reservation.checkIn)}</strong>
          </div>
          <div>
            <small>Check-out</small>
            <strong>{fmtDate(reservation.checkOut)}</strong>
          </div>
          <div>
            <small>Noches</small>
            <strong>{nights}</strong>
          </div>
          <div>
            <small>Huéspedes</small>
            <strong>{reservation.guestCount}</strong>
          </div>
          <div>
            <small>Tarifa/noche</small>
            <strong>
              {reservation.rate > 0 ? money(reservation.rate) : 'Consulta en recepción'}
            </strong>
          </div>
          <div>
            <small>Total estancia</small>
            <strong>{reservation.rate > 0 ? money(total) : 'Consulta en recepción'}</strong>
          </div>
        </div>
        <div className="gs-detail-section">
          <strong>Titular de la reserva</strong>
          <p>
            {reservation.guest.name} {reservation.guest.lastName}
          </p>
          <small>
            {reservation.guest.email} · {reservation.guest.phone}
          </small>
        </div>
        {reservation.companions.length > 0 && (
          <div className="gs-detail-section">
            <strong>Acompañantes</strong>
            {reservation.companions.map((c) => (
              <p key={c.id}>
                {c.name} {c.lastName} · {c.age} años
              </p>
            ))}
          </div>
        )}
        {reservation.observations && (
          <div className="gs-detail-section">
            <strong>Observaciones</strong>
            <p>{reservation.observations}</p>
          </div>
        )}
        <div className="modal-foot gs-modal-foot" style={{ flexWrap: 'wrap' }}>
          <button className="button secondary" onClick={onClose}>
            Cerrar
          </button>
          {onReceipt && (
            <button className="button secondary" onClick={onReceipt}>
              <Download size={15} /> Recibo
            </button>
          )}
          {!['Cancelada', 'Anulada', 'Check-out'].includes(reservation.status) && (
            <>
              {onModify && (
                <button className="button secondary" onClick={onModify}>
                  <CalendarDays size={15} /> Modificar
                </button>
              )}
              {onCancel && (
                <button className="button terracotta-btn" onClick={onCancel}>
                  <Ban size={15} /> Cancelar
                </button>
              )}
            </>
          )}
        </div>
        {!onReceipt && !onModify && !onCancel && (
          <p className="muted">
            Para modificar tu reserva, cancelarla o pedir tu recibo, consulta en recepción.
          </p>
        )}
      </div>
    </div>
  );
}

export function ModifyReservationModal({
  reservation,
  onClose,
  onSave,
}: {
  reservation: Reservation;
  onClose: () => void;
  onSave: (updates: {
    checkIn: string;
    checkOut: string;
    guestCount: number;
    observations: string;
  }) => void;
}) {
  const [checkIn, setCheckIn] = useState(reservation.checkIn);
  const [checkOut, setCheckOut] = useState(reservation.checkOut);
  const [guestCount, setGuestCount] = useState(reservation.guestCount);
  const [observations, setObservations] = useState(reservation.observations);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 440, maxWidth: 'calc(100vw - 32px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">MODIFICAR RESERVA</p>
            <h2>Reserva {reservation.code}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="login-helper">
          Solicita un cambio de fechas o detalles. El hotel confirmará la modificación.
        </p>
        <label className="hk-form-label">
          Fecha de check-in
          <input
            type="date"
            className="hk-form-select"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </label>
        <label className="hk-form-label">
          Fecha de check-out
          <input
            type="date"
            className="hk-form-select"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </label>
        <label className="hk-form-label">
          Número de huéspedes
          <input
            type="number"
            className="hk-form-select"
            value={guestCount}
            min={1}
            max={4}
            onChange={(e) => setGuestCount(Number(e.target.value))}
          />
        </label>
        <label className="hk-form-label">
          Observaciones
          <textarea
            className="hk-form-textarea"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Indica cualquier detalle adicional..."
          />
        </label>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            onClick={() => onSave({ checkIn, checkOut, guestCount, observations })}
          >
            Guardar cambios <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function CancelReservationModal({
  reservation,
  onClose,
  onConfirm,
}: {
  reservation: Reservation;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 420, maxWidth: 'calc(100vw - 32px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">CANCELAR RESERVA</p>
            <h2>Reserva {reservation.code}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="gs-cancel-warning">
          <TriangleAlert size={20} />
          <p>
            Esta acción no se puede deshacer. Se aplicarán las políticas de cancelación según la
            tarifa contratada.
          </p>
        </div>
        <div className="gs-cancel-summary">
          <div>
            <small>Habitación</small>
            <strong>
              {reservation.roomNumber} · {reservation.roomType}
            </strong>
          </div>
          <div>
            <small>Estancia</small>
            <strong>
              {fmtDate(reservation.checkIn)} — {fmtDate(reservation.checkOut)}
            </strong>
          </div>
        </div>
        <label className="hk-form-label">
          Motivo de cancelación
          <textarea
            className="hk-form-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Indica el motivo de tu cancelación..."
          />
        </label>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button terracotta-btn"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Confirmar cancelación
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReceiptModal({
  reservation,
  onClose,
  onDownload,
}: {
  reservation: Reservation;
  onClose: () => void;
  onDownload: () => void;
}) {
  const active = reservation.folio.filter((f) => f.status === 'Activo');
  const charges = active.filter((f) => f.type === 'Cargo').reduce((s, f) => s + f.amount, 0);
  const payments = active.filter((f) => f.type === 'Pago').reduce((s, f) => s + f.amount, 0);
  const deposits = active.filter((f) => f.type === 'Depósito').reduce((s, f) => s + f.amount, 0);
  const balance = charges - payments - deposits;
  const nights = Math.max(
    1,
    calculateNights(
      toDomainCalendarDate(reservation.checkIn),
      toDomainCalendarDate(reservation.checkOut),
    ),
  );
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal gs-receipt-modal"
        style={{ width: 460, maxWidth: 'calc(100vw - 32px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">RECIBO DE RESERVA</p>
            <h2>Reserva {reservation.code}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="gs-receipt">
          <div className="gs-receipt-head">
            <div>
              <strong>Hotel Aurora</strong>
              <small>Sede Centro · RFC AUR850101</small>
            </div>
            <div>
              <small>Recibo</small>
              <strong>#{reservation.code}</strong>
            </div>
          </div>
          <div className="gs-receipt-guest">
            <small>Titular</small>
            <strong>
              {reservation.guest.name} {reservation.guest.lastName}
            </strong>
            <span>{reservation.guest.email}</span>
          </div>
          <div className="gs-receipt-stay">
            <div>
              <small>Habitación</small>
              <strong>
                {reservation.roomNumber} · {reservation.roomType}
              </strong>
            </div>
            <div>
              <small>Estancia</small>
              <strong>{nights} noches</strong>
            </div>
            <div>
              <small>Check-in</small>
              <strong>{fmtDate(reservation.checkIn)}</strong>
            </div>
            <div>
              <small>Check-out</small>
              <strong>{fmtDate(reservation.checkOut)}</strong>
            </div>
          </div>
          <div className="gs-receipt-folio">
            <strong>Detalle de cargos</strong>
            {active.length === 0 ? (
              <p className="gs-receipt-empty">Sin movimientos registrados</p>
            ) : (
              active.map((entry) => (
                <div className="gs-receipt-row" key={entry.id}>
                  <div>
                    <span
                      className={`status-pill ${entry.type === 'Pago' || entry.type === 'Depósito' ? 'success' : 'warning'}`}
                    >
                      {entry.type}
                    </span>
                    <strong>{entry.concept}</strong>
                    <small>
                      {fmtDate(entry.date)}
                      {entry.method ? ` · ${entry.method}` : ''}
                    </small>
                  </div>
                  <span
                    className={entry.type === 'Cargo' ? 'gs-receipt-charge' : 'gs-receipt-payment'}
                  >
                    {entry.type === 'Cargo' ? '+' : '−'}
                    {money(entry.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="gs-receipt-totals">
            <div>
              <span>Cargos</span>
              <strong>{money(charges)}</strong>
            </div>
            <div>
              <span>Pagos</span>
              <strong>−{money(payments)}</strong>
            </div>
            <div>
              <span>Depósitos</span>
              <strong>−{money(deposits)}</strong>
            </div>
            <div className="gs-receipt-balance">
              <span>Saldo pendiente</span>
              <strong>{money(Math.max(0, balance))}</strong>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cerrar
          </button>
          <button className="button primary" onClick={onDownload}>
            <Download size={15} /> Descargar recibo
          </button>
        </div>
      </div>
    </div>
  );
}

export function LinkReservationModal({
  onClose,
  onLink,
}: {
  onClose: () => void;
  onLink: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 420, maxWidth: 'calc(100vw - 32px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">VINCULAR RESERVA</p>
            <h2>Ingresa tu código</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="login-helper">
          Si ya tienes una reserva hecha por otro canal, vincúlala con tu código de confirmación
          para verla en la app.
        </p>
        <label className="hk-form-label">
          Código de reserva
          <input
            className="hk-form-select"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ej. AUR-2415"
          />
        </label>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={!code.trim()}
            onClick={() => onLink(code.trim())}
          >
            Vincular reserva <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditProfileModal({
  profile,
  onClose,
  onSave,
}: {
  profile: GuestInfo;
  onClose: () => void;
  onSave: (profile: GuestInfo) => void;
}) {
  const [data, setData] = useState<GuestInfo>(profile);
  const update = (field: keyof GuestInfo, value: string) =>
    setData((prev) => ({ ...prev, [field]: value }));
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 460, maxWidth: 'calc(100vw - 32px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">EDITAR PERFIL</p>
            <h2>Mis datos personales</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="gs-form-grid">
          <label className="hk-form-label">
            Nombre
            <input
              className="hk-form-select"
              value={data.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <label className="hk-form-label">
            Apellidos
            <input
              className="hk-form-select"
              value={data.lastName}
              onChange={(e) => update('lastName', e.target.value)}
            />
          </label>
          <label className="hk-form-label">
            Teléfono
            <input
              className="hk-form-select"
              value={data.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </label>
          <label className="hk-form-label">
            Correo electrónico
            <input
              className="hk-form-select"
              value={data.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </label>
          <label className="hk-form-label">
            Tipo de documento
            <select
              className="hk-form-select"
              value={data.docType}
              onChange={(e) => update('docType', e.target.value)}
            >
              <option>INE</option>
              <option>Pasaporte</option>
              <option>Cédula</option>
              <option>Otro</option>
            </select>
          </label>
          <label className="hk-form-label">
            Número de documento
            <input
              className="hk-form-select"
              value={data.docNumber}
              onChange={(e) => update('docNumber', e.target.value)}
            />
          </label>
          <label className="hk-form-label">
            Fecha de nacimiento
            <input
              type="date"
              className="hk-form-select"
              value={data.birthDate}
              onChange={(e) => update('birthDate', e.target.value)}
            />
          </label>
          <label className="hk-form-label">
            Nacionalidad
            <input
              className="hk-form-select"
              value={data.nationality}
              onChange={(e) => update('nationality', e.target.value)}
            />
          </label>
        </div>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" onClick={() => onSave(data)}>
            Guardar cambios <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function CancelOrderModal({
  orderId,
  orderInfo,
  onClose,
  onConfirm,
}: {
  orderId: number;
  orderInfo: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 400, maxWidth: 'calc(100vw - 32px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">CANCELAR PEDIDO</p>
            <h2>Pedido #{orderId}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="gs-cancel-warning">
          <TriangleAlert size={20} />
          <p>
            Esta acción no se puede deshacer. El cargo será revertido si aún no se ha procesado.
          </p>
        </div>
        <div className="gs-cancel-summary">
          <div>
            <small>Pedido</small>
            <strong>{orderInfo}</strong>
          </div>
        </div>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button terracotta-btn" onClick={onConfirm}>
            Confirmar cancelación
          </button>
        </div>
      </div>
    </div>
  );
}

export function RequestServiceModal({
  mode,
  roomNumber,
  onClose,
  onSubmit,
}: {
  mode: 'Limpieza' | 'Articulos' | 'Conserjería';
  roomNumber?: string;
  onClose: () => void;
  onSubmit: (data: {
    type: string;
    description: string;
    time: string;
    itemId?: string;
    quantity?: number;
    conciergeServiceId?: string;
    housekeepingServiceId?: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const timeSlots = ['Lo antes posible', 'Por la mañana', 'Por la tarde', 'Esta noche'];
  const [selectedType, setSelectedType] = useState('');
  const [housekeepingItems, setHousekeepingItems] = useState<GuestHousekeepingItem[]>([]);
  const [housekeepingServices, setHousekeepingServices] = useState<HousekeepingServiceOption[]>([]);
  const [housekeepingLoading, setHousekeepingLoading] = useState(mode === 'Limpieza');
  const [housekeepingError, setHousekeepingError] = useState('');
  const [conciergeServices, setConciergeServices] = useState<ConciergeServiceOption[]>([]);
  const [conciergeLoading, setConciergeLoading] = useState(mode === 'Conserjería');
  const [conciergeError, setConciergeError] = useState('');
  const [itemsLoading, setItemsLoading] = useState(mode === 'Articulos');
  const [itemsError, setItemsError] = useState('');
  const [selectedTime, setSelectedTime] = useState(timeSlots[0]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const loadHousekeepingServices = useCallback(async () => {
    setHousekeepingLoading(true);
    setHousekeepingError('');
    try {
      const services = await housekeepingCatalogService.getGuestServices();
      setHousekeepingServices(services);
      setSelectedType((current) =>
        services.some((service) => service.id === current) ? current : (services[0]?.id ?? ''),
      );
    } catch (cause) {
      setHousekeepingError(
        cause instanceof Error ? cause.message : 'No se pudieron cargar las opciones de limpieza.',
      );
    } finally {
      setHousekeepingLoading(false);
    }
  }, []);
  const loadHousekeepingItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError('');
    try {
      const items = await inventoryService.getGuestHousekeepingItems();
      setHousekeepingItems(items);
      setSelectedType((current) =>
        items.some((item) => item.id === current) ? current : (items[0]?.id ?? ''),
      );
      setQuantity(1);
    } catch (cause) {
      setItemsError(
        cause instanceof Error ? cause.message : 'No se pudo cargar el inventario de limpieza.',
      );
    } finally {
      setItemsLoading(false);
    }
  }, []);
  const loadConciergeServices = useCallback(async () => {
    setConciergeLoading(true);
    setConciergeError('');
    try {
      const services = await conciergeCatalogService.getGuestServices();
      setConciergeServices(services);
      setSelectedType((current) =>
        services.some((service) => service.id === current) ? current : (services[0]?.id ?? ''),
      );
    } catch (cause) {
      setConciergeError(
        cause instanceof Error ? cause.message : 'No se pudieron cargar los servicios.',
      );
    } finally {
      setConciergeLoading(false);
    }
  }, []);
  useEffect(() => {
    if (mode === 'Limpieza') void loadHousekeepingServices();
  }, [loadHousekeepingServices, mode]);
  useEffect(() => {
    if (mode === 'Articulos') void loadHousekeepingItems();
  }, [loadHousekeepingItems, mode]);
  useEffect(() => {
    if (mode === 'Conserjería') void loadConciergeServices();
  }, [loadConciergeServices, mode]);
  const selectedItem = housekeepingItems.find((item) => item.id === selectedType);
  const selectedHousekeepingService = housekeepingServices.find(
    (service) => service.id === selectedType,
  );
  const selectedConciergeService = conciergeServices.find((service) => service.id === selectedType);
  const maxQuantity = Math.min(5, selectedItem?.currentQuantity ?? 0);
  const canSubmitItems =
    mode === 'Articulos'
      ? !itemsLoading && !itemsError && maxQuantity > 0 && Boolean(selectedItem)
      : mode === 'Conserjería'
        ? !conciergeLoading && !conciergeError && Boolean(selectedConciergeService)
        : !housekeepingLoading && !housekeepingError && Boolean(selectedHousekeepingService);
  const handleSubmit = async () => {
    if (submitting || !canSubmitItems) return;
    const baseDescription =
      mode === 'Articulos'
        ? `${quantity}× ${selectedItem?.name ?? ''}`
        : mode === 'Conserjería'
          ? (selectedConciergeService?.name ?? '')
          : (selectedHousekeepingService?.name ?? '');
    const description = `${baseDescription}${notes ? ` — ${notes}` : ''}`;
    setSubmitting(true);
    try {
      await onSubmit({
        type: mode === 'Limpieza' ? 'Limpieza' : mode === 'Articulos' ? 'Artículos' : 'Conserjería',
        description,
        time: selectedTime,
        itemId: mode === 'Articulos' ? selectedItem?.id : undefined,
        quantity: mode === 'Articulos' ? quantity : undefined,
        conciergeServiceId: mode === 'Conserjería' ? selectedConciergeService?.id : undefined,
        housekeepingServiceId: mode === 'Limpieza' ? selectedHousekeepingService?.id : undefined,
        notes,
      });
    } finally {
      setSubmitting(false);
    }
  };
  const title =
    mode === 'Limpieza'
      ? 'Limpieza de habitación'
      : mode === 'Articulos'
        ? 'Artículos adicionales'
        : 'Solicitar a conserjería';
  const notesPlaceholder =
    mode === 'Limpieza'
      ? 'Indica una hora o detalle importante para el equipo de limpieza.'
      : mode === 'Articulos'
        ? 'Por ejemplo, déjalo en la puerta o no tocar el timbre.'
        : selectedConciergeService?.name === 'Taxi al aeropuerto'
          ? 'Indica la hora del vuelo, pasajeros y equipaje.'
          : selectedConciergeService?.name === 'Transporte local' ||
              selectedConciergeService?.name === 'Traslado privado'
            ? 'Indica destino, hora y número de pasajeros.'
            : selectedConciergeService?.name === 'Reserva de restaurante'
              ? 'Indica restaurante, horario y número de personas.'
              : selectedConciergeService?.name === 'Tour o actividad'
                ? 'Cuéntanos qué actividad te interesa y para cuántas personas.'
                : 'Agrega los detalles para que conserjería pueda coordinar el servicio.';
  const timeField = (
    <div className="hk-form-label gs-service-time-field">
      <span>Momento preferido</span>
      <select
        className="hk-form-select gs-service-select"
        value={selectedTime}
        aria-label="Momento preferido"
        onChange={(event) => setSelectedTime(event.target.value)}
      >
        {timeSlots.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <div className="modal-backdrop" onMouseDown={() => !submitting && onClose()}>
      <div
        className={`modal gs-service-modal gs-service-form-${mode === 'Conserjería' ? 'concierge' : mode === 'Articulos' ? 'items' : 'cleaning'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gs-service-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">SOLICITAR SERVICIO</p>
            <h2 id="gs-service-title">{title}</h2>
            <p className="gs-service-subtitle">
              {roomNumber ? `Solicitud para habitación ${roomNumber}. ` : ''}
              {mode === 'Limpieza'
                ? 'Elige el tipo de limpieza y el horario que prefieres.'
                : mode === 'Articulos'
                  ? 'Selecciona lo que necesitas y la cantidad. Conserjería recibirá esta solicitud.'
                  : 'Elige el servicio y cuéntanos los detalles para que conserjería pueda ayudarte.'}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={submitting} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="hk-form-label gs-service-type-field">
          <span>
            {mode === 'Limpieza'
              ? 'Tipo de limpieza'
              : mode === 'Articulos'
                ? 'Artículo'
                : '¿Con qué necesitas ayuda?'}
          </span>
          {mode === 'Articulos' ? (
            <>
              <select
                className="hk-form-select gs-service-select"
                value={selectedType}
                aria-label="Artículo"
                disabled={itemsLoading || housekeepingItems.length === 0}
                onChange={(event) => {
                  setSelectedType(event.target.value);
                  setQuantity(1);
                }}
              >
                {housekeepingItems.map((item) => (
                  <option key={item.id} value={item.id} disabled={item.currentQuantity < 1}>
                    {item.name} ·{' '}
                    {item.currentQuantity > 0
                      ? `${item.currentQuantity} disponibles`
                      : 'No disponible'}
                  </option>
                ))}
              </select>
              {itemsLoading && <small className="gs-service-hint">Cargando artículos...</small>}
              {itemsError && (
                <div className="gs-service-load-error" role="alert">
                  <small>{itemsError}</small>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={loadHousekeepingItems}
                  >
                    Reintentar
                  </button>
                </div>
              )}
              {!itemsLoading && !itemsError && housekeepingItems.length === 0 && (
                <small className="gs-service-hint">
                  No hay artículos de limpieza en el inventario.
                </small>
              )}
              {selectedItem && (
                <CatalogImage
                  image={selectedItem.images[0]}
                  alt={selectedItem.name}
                  className="gs-request-item-image"
                />
              )}
            </>
          ) : mode === 'Conserjería' ? (
            <>
              <select
                className="hk-form-select gs-service-select"
                value={selectedType}
                aria-label="Servicio de conserjería"
                disabled={conciergeLoading || conciergeServices.length === 0}
                onChange={(event) => setSelectedType(event.target.value)}
              >
                {conciergeServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              {conciergeLoading && <small className="gs-service-hint">Cargando servicios...</small>}
              {conciergeError && (
                <div className="gs-service-load-error" role="alert">
                  <small>{conciergeError}</small>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={loadConciergeServices}
                  >
                    Reintentar
                  </button>
                </div>
              )}
              {!conciergeLoading && !conciergeError && conciergeServices.length === 0 && (
                <small className="gs-service-hint">
                  No hay servicios disponibles por el momento.
                </small>
              )}
              {selectedConciergeService?.description && (
                <small className="gs-service-hint">{selectedConciergeService.description}</small>
              )}
            </>
          ) : mode === 'Limpieza' ? (
            <select
              className="hk-form-select gs-service-select"
              value={selectedType}
              aria-label="Tipo de limpieza"
              disabled={housekeepingLoading || housekeepingServices.length === 0}
              onChange={(event) => setSelectedType(event.target.value)}
            >
              {housekeepingServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          ) : null}
          {mode === 'Limpieza' && housekeepingLoading && (
            <small className="gs-service-hint">Cargando opciones de limpieza...</small>
          )}
          {mode === 'Limpieza' && housekeepingError && (
            <div className="gs-service-load-error" role="alert">
              <small>{housekeepingError}</small>
              <button type="button" className="button secondary" onClick={loadHousekeepingServices}>
                Reintentar
              </button>
            </div>
          )}
          {mode === 'Limpieza' &&
            !housekeepingLoading &&
            !housekeepingError &&
            housekeepingServices.length === 0 && (
              <small className="gs-service-hint">
                No hay opciones de limpieza disponibles por el momento.
              </small>
            )}
          {mode === 'Limpieza' && selectedHousekeepingService?.description && (
            <small className="gs-service-hint">{selectedHousekeepingService.description}</small>
          )}
        </div>
        {mode === 'Articulos' ? (
          <div className="gs-service-side-fields">
            <div className="hk-form-label gs-service-quantity-field">
              <span>Cantidad</span>
              <div className="gs-qty-selector">
                <button
                  type="button"
                  aria-label="Disminuir cantidad"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Minus size={14} />
                </button>
                <output aria-live="polite">{quantity}</output>
                <button
                  type="button"
                  aria-label="Aumentar cantidad"
                  disabled={quantity >= maxQuantity}
                  onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                >
                  <Plus size={14} />
                </button>
              </div>
              <small className="gs-service-hint">
                Disponible: {selectedItem?.currentQuantity ?? 0}. Máximo 5 por solicitud.
              </small>
            </div>
            {timeField}
          </div>
        ) : (
          timeField
        )}
        <label className="hk-form-label gs-service-notes-field" htmlFor="gs-service-notes">
          Detalles adicionales <span className="gs-service-optional">Opcional</span>
          <textarea
            id="gs-service-notes"
            className="hk-form-textarea"
            value={notes}
            maxLength={300}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={notesPlaceholder}
          />
          <small className="gs-service-hint gs-notes-count">{notes.length}/300</small>
        </label>
        <div className="modal-foot">
          <button className="button secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            className="button primary"
            onClick={handleSubmit}
            disabled={submitting || !canSubmitItems}
          >
            {submitting ? 'Enviando…' : 'Enviar solicitud'}{' '}
            {!submitting && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateBookingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [roomTypes, setRoomTypes] = useState<
    import('@/shared/types/entities/room-type').RoomType[]
  >([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [notes, setNotes] = useState('');

  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<{
    availableRooms: number;
    totalAmountCents: number;
    rateName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadRoomTypes() {
      try {
        const types = await import('@/services/publicBookingCatalogService').then((m) =>
          m.publicBookingCatalogService.getRoomTypes(),
        );
        if (active) {
          setRoomTypes(types);
          if (types.length > 0) {
            setSelectedRoomTypeId(types[0].id);
          }
        }
      } catch {
        if (active) setError('No fue posible cargar los tipos de habitación disponibles.');
      } finally {
        if (active) setLoadingRooms(false);
      }
    }
    void loadRoomTypes();
    return () => {
      active = false;
    };
  }, []);

  const handleCheckAvailability = async () => {
    if (!checkIn || !checkOut || !selectedRoomTypeId) {
      setError('Selecciona las fechas y el tipo de habitación para consultar.');
      return;
    }
    if (checkIn >= checkOut) {
      setError('La fecha de salida debe ser posterior a la de entrada.');
      return;
    }
    setError(null);
    setCheckingAvailability(true);
    setAvailabilityResult(null);

    try {
      const results = await import('@/services/publicBookingCatalogService').then((m) =>
        m.publicBookingCatalogService.getAvailability({
          checkIn,
          checkOut,
          adults,
          children,
          roomTypeId: selectedRoomTypeId,
        }),
      );
      const match = results.find((r) => r.roomType.id === selectedRoomTypeId);
      if (match && match.availableRooms > 0) {
        setAvailabilityResult({
          availableRooms: match.availableRooms,
          totalAmountCents: match.totalAmountCents,
          rateName: match.rate.name,
        });
      } else {
        setError('No hay habitaciones disponibles para esas fechas y cantidad de huéspedes.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al consultar disponibilidad.');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomTypeId || !checkIn || !checkOut) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }
    if (checkIn >= checkOut) {
      setError('La fecha de salida debe ser posterior a la de entrada.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { guestPortalService } = await import('@/services/guestPortalService');
      const booking = await guestPortalService.createBooking({
        roomTypeId: selectedRoomTypeId,
        checkIn,
        checkOut,
        adults,
        children,
        notes: notes.trim() || undefined,
      });
      onCreated(`¡Reserva creada exitosamente! Código: ${booking.confirmationCode}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible crear la reserva.');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 520, maxWidth: 'calc(100vw - 32px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">PORTAL DEL HUÉSPED</p>
            <h2>Nueva reserva</h2>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={submitting}>
            <X size={18} />
          </button>
        </div>

        <p className="login-helper">
          Crea una nueva reserva asociada a tu cuenta. Se aplicarán las tarifas y disponibilidad
          vigentes.
        </p>

        {error && (
          <div
            className="status-banner"
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              marginBottom: '1rem',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="hk-form-label">
            Tipo de habitación *
            <select
              className="hk-form-select"
              value={selectedRoomTypeId}
              onChange={(e) => {
                setSelectedRoomTypeId(e.target.value);
                setAvailabilityResult(null);
              }}
              disabled={loadingRooms || submitting}
            >
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name} (Capacidad: {rt.capacity} huéspedes)
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label className="hk-form-label">
              Fecha de entrada (Check-in) *
              <input
                type="date"
                className="hk-form-select"
                value={checkIn}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  setAvailabilityResult(null);
                }}
                required
                disabled={submitting}
              />
            </label>
            <label className="hk-form-label">
              Fecha de salida (Check-out) *
              <input
                type="date"
                className="hk-form-select"
                value={checkOut}
                min={checkIn || new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setCheckOut(e.target.value);
                  setAvailabilityResult(null);
                }}
                required
                disabled={submitting}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label className="hk-form-label">
              Adultos *
              <input
                type="number"
                min={1}
                max={10}
                className="hk-form-select"
                value={adults}
                onChange={(e) => {
                  setAdults(Math.max(1, Number(e.target.value)));
                  setAvailabilityResult(null);
                }}
                required
                disabled={submitting}
              />
            </label>
            <label className="hk-form-label">
              Niños
              <input
                type="number"
                min={0}
                max={10}
                className="hk-form-select"
                value={children}
                onChange={(e) => {
                  setChildren(Math.max(0, Number(e.target.value)));
                  setAvailabilityResult(null);
                }}
                disabled={submitting}
              />
            </label>
          </div>

          <div style={{ margin: '0.5rem 0 1rem 0' }}>
            <button
              type="button"
              className="button secondary"
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
              onClick={handleCheckAvailability}
              disabled={checkingAvailability || submitting || !checkIn || !checkOut}
            >
              {checkingAvailability ? 'Verificando...' : 'Verificar disponibilidad y tarifa'}
            </button>

            {availabilityResult && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.6rem 0.8rem',
                  background: '#ecfdf5',
                  color: '#065f46',
                  borderRadius: 6,
                  fontSize: '0.85rem',
                }}
              >
                ✓ <strong>{availabilityResult.availableRooms}</strong> habitación(es) disponible(s).
                Tarifa: {availabilityResult.rateName} · Total:{' '}
                {money(availabilityResult.totalAmountCents / 100)}
              </div>
            )}
          </div>

          <label className="hk-form-label">
            Notas u observaciones
            <textarea
              className="hk-form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Peticiones especiales, hora estimada de llegada, etc."
              disabled={submitting}
            />
          </label>

          <div className="modal-foot">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button type="submit" className="button primary" disabled={submitting}>
              {submitting ? 'Confirmando reserva...' : 'Crear reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
