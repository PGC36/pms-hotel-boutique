/* eslint-disable @typescript-eslint/no-unused-vars -- Migracion controlada del prototipo Bolt; se conserva la logica original para portarla incrementalmente. */
import { useState } from 'react';
import {
  ArrowRight,
  Ban,
  BedDouble,
  CalendarDays,
  Check,
  ClipboardList,
  DoorOpen,
  Eye,
  FileText,
  LoaderCircle,
  Plus,
  Search,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Companion,
  FolioEntry,
  PaymentMethod,
  RecRoom,
  Reservation,
  ReservationStatus,
  RoomBlock,
} from '@/private/workspace/PrivateWorkspace';
import { toDtoCalendarDate } from '@/shared/types/common';
import { ReservationDetail } from './ReservationDetail';
import {
  BlockModal,
  ChargeModal,
  CheckinModal,
  CheckoutModal,
  InvoiceModal,
  PaymentModal,
  ReasonModal,
  ReservationFormModal,
  RoomChangeModal,
} from './ReceptionModals';

const money = (n: number) => `$${n.toLocaleString('es-MX')}`;
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

type Totals = { charges: number; deposits: number; payments: number; balance: number };

const statusClass = (status: ReservationStatus): string =>
  status === 'Pendiente'
    ? 'warning'
    : status === 'Confirmada'
      ? 'info'
      : status === 'Check-in'
        ? 'gold'
        : status === 'Check-out'
          ? 'success'
          : 'terracotta';

type CalFilter = { room: string; type: string; status: string };

export function ReceptionContent({
  nav,
  reservations,
  rooms,
  blocks,
  selectedRes,
  onSelectRes,
  onCloseRes,
  onUpdateRes,
  onAddReservation,
  nextCode,
  nights,
  folioTotals,
  isRoomBlocked,
  hasConflict,
  showNewRes,
  setShowNewRes,
  showWalkin,
  setShowWalkin,
  showCheckin,
  setShowCheckin,
  onCheckin,
  showCheckout,
  setShowCheckout,
  onCheckout,
  showCancel,
  setShowCancel,
  onCancel,
  showVoid,
  setShowVoid,
  onVoid,
  showCharge,
  setShowCharge,
  onAddCharge,
  showVoidCharge,
  setShowVoidCharge,
  onVoidCharge,
  showPayment,
  setShowPayment,
  onAddPayment,
  showDeposit,
  setShowDeposit,
  onAddDeposit,
  showRoomChange,
  setShowRoomChange,
  onRoomChange,
  showBlock,
  setShowBlock,
  onAddBlock,
  onRemoveBlock,
  showInvoice,
  setShowInvoice,
  cashAction,
  setCashAction,
  calFilter,
  setCalFilter,
  search,
  setSearch,
  onAction,
  onNavigate,
  onRefresh,
}: {
  nav: string;
  reservations: Reservation[];
  rooms: RecRoom[];
  blocks: RoomBlock[];
  selectedRes: Reservation | null;
  onSelectRes: (id: number) => void;
  onCloseRes: () => void;
  onUpdateRes: (id: number, updates: Partial<Reservation>) => void;
  onAddReservation: (res: Reservation) => Promise<Reservation>;
  nextCode: string;
  nights: (ci: string, co: string) => number;
  folioTotals: (f: FolioEntry[]) => Totals;
  isRoomBlocked: (room: string, ci: string, co: string) => boolean;
  hasConflict: (room: string, ci: string, co: string, excludeId?: number) => boolean;
  showNewRes: boolean;
  setShowNewRes: (v: boolean) => void;
  showWalkin: boolean;
  setShowWalkin: (v: boolean) => void;
  showCheckin: number | null;
  setShowCheckin: (v: number | null) => void;
  onCheckin: (
    id: number,
    updates: Partial<{
      name: string;
      lastName: string;
      phone: string;
      email: string;
      docType: string;
      docNumber: string;
      birthDate: string;
      nationality: string;
    }>,
    companions: Companion[],
    res: Reservation,
  ) => void;
  showCheckout: number | null;
  setShowCheckout: (v: number | null) => void;
  onCheckout: (id: number) => void;
  showCancel: number | null;
  setShowCancel: (v: number | null) => void;
  onCancel: (id: number, reason: string) => void;
  showVoid: number | null;
  setShowVoid: (v: number | null) => void;
  onVoid: (id: number, reason: string) => void;
  showCharge: number | null;
  setShowCharge: (v: number | null) => void;
  onAddCharge: (
    resId: number,
    concept: string,
    category: string,
    amount: number,
    observation: string,
  ) => void;
  showVoidCharge: { resId: number; entryId: number } | null;
  setShowVoidCharge: (v: { resId: number; entryId: number } | null) => void;
  onVoidCharge: (resId: number, entryId: number, reason: string) => void;
  showPayment: number | null;
  setShowPayment: (v: number | null) => void;
  onAddPayment: (resId: number, amount: number, method: PaymentMethod, reference: string) => void;
  showDeposit: number | null;
  setShowDeposit: (v: number | null) => void;
  onAddDeposit: (resId: number, amount: number, method: PaymentMethod, reference: string) => void;
  showRoomChange: number | null;
  setShowRoomChange: (v: number | null) => void;
  onRoomChange: (id: number, room: string) => void;
  showBlock: boolean;
  setShowBlock: (v: boolean) => void;
  onAddBlock: (
    room: string,
    start: string,
    end: string,
    reason: string,
    observation: string,
  ) => void;
  onRemoveBlock: (id: number) => void;
  showInvoice: number | null;
  setShowInvoice: (v: number | null) => void;
  cashAction: 'payment' | 'charge' | null;
  setCashAction: (v: 'payment' | 'charge' | null) => void;
  calFilter: CalFilter;
  setCalFilter: (f: CalFilter) => void;
  search: string;
  setSearch: (v: string) => void;
  onAction: (msg: string) => void;
  onNavigate: (nav: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [refreshingCalendar, setRefreshingCalendar] = useState(false);
  const [availCheckIn, setAvailCheckIn] = useState('2024-08-31');
  const [availCheckOut, setAvailCheckOut] = useState('2024-09-02');
  const [availGuests, setAvailGuests] = useState(2);
  const [availType, setAvailType] = useState('Todos');

  const refreshCalendar = async () => {
    if (refreshingCalendar) return;
    setRefreshingCalendar(true);
    try {
      await onRefresh();
    } finally {
      setRefreshingCalendar(false);
    }
  };

  /* ---------- Dashboard / Resumen ---------- */
  if (nav === 'Resumen') {
    const today = toDtoCalendarDate(new Date());
    const arrivals = reservations.filter(
      (r) => r.checkIn === today && !['Cancelada', 'Anulada'].includes(r.status),
    );
    const departures = reservations.filter(
      (r) => r.checkOut === today && !['Cancelada', 'Anulada'].includes(r.status),
    );
    const inHouse = reservations.filter((r) => r.status === 'Check-in');
    const available = rooms.filter((r) => r.status === 'Disponible');
    const occupied = rooms.filter((r) => r.status === 'Ocupada');
    const blockedRooms = rooms.filter(
      (r) => r.status === 'Bloqueada' || r.status === 'Mantenimiento',
    );
    const pending = reservations.filter(
      (r) => r.status === 'Pendiente' || r.status === 'Confirmada',
    );

    return (
      <>
        <section className="dashboard-grid">
          <div className="panel main-panel">
            <div className="panel-heading">
              <div>
                <h3>Operación de recepción</h3>
                <p>Resumen del día · Hotel Aurora</p>
              </div>
            </div>
            <div className="rc-stats-grid">
              <div className="rc-stat-card">
                <span className="rc-stat-icon gold">
                  <CalendarDays size={18} />
                </span>
                <div>
                  <strong>{arrivals.length}</strong>
                  <small>Llegadas hoy</small>
                </div>
              </div>
              <div className="rc-stat-card">
                <span className="rc-stat-icon info">
                  <DoorOpen size={18} />
                </span>
                <div>
                  <strong>{departures.length}</strong>
                  <small>Salidas hoy</small>
                </div>
              </div>
              <div className="rc-stat-card">
                <span className="rc-stat-icon success">
                  <Users size={18} />
                </span>
                <div>
                  <strong>{inHouse.length}</strong>
                  <small>Hospedados</small>
                </div>
              </div>
              <div className="rc-stat-card">
                <span className="rc-stat-icon warning">
                  <BedDouble size={18} />
                </span>
                <div>
                  <strong>{available.length}</strong>
                  <small>Disponibles</small>
                </div>
              </div>
              <div className="rc-stat-card">
                <span className="rc-stat-icon occupied">
                  <BedDouble size={18} />
                </span>
                <div>
                  <strong>{occupied.length}</strong>
                  <small>Ocupadas</small>
                </div>
              </div>
              <div className="rc-stat-card">
                <span className="rc-stat-icon terracotta">
                  <Ban size={18} />
                </span>
                <div>
                  <strong>{blockedRooms.length}</strong>
                  <small>Bloqueadas</small>
                </div>
              </div>
            </div>

            <div className="rc-dashboard-cols">
              <div className="rc-dash-col">
                <h4>Llegadas de hoy</h4>
                <div className="rc-dash-list">
                  {arrivals.length === 0 && (
                    <div className="hk-empty">
                      <CalendarDays size={20} />
                      <p>Sin llegadas programadas</p>
                    </div>
                  )}
                  {arrivals.map((r) => (
                    <div className="rc-dash-row" key={r.id} onClick={() => onSelectRes(r.id)}>
                      <div>
                        <strong>
                          {r.guest.name} {r.guest.lastName}
                        </strong>
                        <span>
                          Hab. {r.roomNumber} · {r.code}
                        </span>
                      </div>
                      <span className={`status-pill ${statusClass(r.status)}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rc-dash-col">
                <h4>Salidas de hoy</h4>
                <div className="rc-dash-list">
                  {departures.length === 0 && (
                    <div className="hk-empty">
                      <DoorOpen size={20} />
                      <p>Sin salidas programadas</p>
                    </div>
                  )}
                  {departures.map((r) => (
                    <div className="rc-dash-row" key={r.id} onClick={() => onSelectRes(r.id)}>
                      <div>
                        <strong>
                          {r.guest.name} {r.guest.lastName}
                        </strong>
                        <span>
                          Hab. {r.roomNumber} · {r.code}
                        </span>
                      </div>
                      <span className={`status-pill ${statusClass(r.status)}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rc-dash-col">
                <h4>Reservas pendientes</h4>
                <div className="rc-dash-list">
                  {pending.length === 0 && (
                    <div className="hk-empty">
                      <ClipboardList size={20} />
                      <p>Sin reservas pendientes</p>
                    </div>
                  )}
                  {pending.map((r) => (
                    <div className="rc-dash-row" key={r.id} onClick={() => onSelectRes(r.id)}>
                      <div>
                        <strong>
                          {r.guest.name} {r.guest.lastName}
                        </strong>
                        <span>
                          {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)}
                        </span>
                      </div>
                      <span className={`status-pill ${statusClass(r.status)}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="panel side-panel">
            <div className="panel-heading">
              <div>
                <h3>Estado del hotel</h3>
                <p>Inventario de habitaciones</p>
              </div>
            </div>
            <div className="rc-occupancy-block">
              <div className="rc-occ-item">
                <span className="room-dot available" />
                <strong>{available.length}</strong>
                <small>Disponibles</small>
              </div>
              <div className="rc-occ-item">
                <span className="room-dot occupied" />
                <strong>{occupied.length}</strong>
                <small>Ocupadas</small>
              </div>
              <div className="rc-occ-item">
                <span className="room-dot cleaning" />
                <strong>{rooms.filter((r) => r.status === 'Limpieza').length}</strong>
                <small>Limpieza</small>
              </div>
              <div className="rc-occ-item">
                <span className="room-dot maintenance" />
                <strong>{blockedRooms.length}</strong>
                <small>Bloqueadas</small>
              </div>
            </div>
            <div className="rc-progress-block">
              <span>Ocupación general</span>
              <strong>{Math.round((occupied.length / rooms.length) * 100)}%</strong>
              <div className="progress-line">
                <i style={{ width: `${Math.round((occupied.length / rooms.length) * 100)}%` }} />
              </div>
            </div>
            <div className="rc-quick-actions">
              <button onClick={() => setShowBlock(true)}>
                <Ban size={16} /> Bloquear habitación
              </button>
              <button onClick={() => onNavigate('Caja')}>
                <Wallet size={16} /> Caja
              </button>
            </div>
          </div>
        </section>

        {showNewRes && (
          <ReservationFormModal
            nextCode={nextCode}
            rooms={rooms}
            hasConflict={hasConflict}
            isRoomBlocked={isRoomBlocked}
            nights={nights}
            folioTotals={folioTotals}
            onClose={() => setShowNewRes(false)}
            onSave={async (res) => {
              const saved = await onAddReservation(res);
              setShowNewRes(false);
              onAction(`Reserva ${saved.code} creada`);
            }}
          />
        )}
        {showWalkin && (
          <ReservationFormModal
            walkin
            nextCode={nextCode}
            rooms={rooms}
            hasConflict={hasConflict}
            isRoomBlocked={isRoomBlocked}
            nights={nights}
            folioTotals={folioTotals}
            onClose={() => setShowWalkin(false)}
            onSave={async (res) => {
              const saved = await onAddReservation(res);
              setShowWalkin(false);
              setShowCheckin(saved.id);
              onAction(`Walk-in ${saved.code} registrado`);
            }}
          />
        )}
        {showBlock && (
          <BlockModal rooms={rooms} onClose={() => setShowBlock(false)} onAdd={onAddBlock} />
        )}
        {selectedRes && (
          <ReservationDetail
            reservation={selectedRes}
            rooms={rooms}
            blocks={blocks}
            onClose={onCloseRes}
            onCheckin={() => setShowCheckin(selectedRes.id)}
            onCheckout={() => setShowCheckout(selectedRes.id)}
            onCancel={() => setShowCancel(selectedRes.id)}
            onVoid={() => setShowVoid(selectedRes.id)}
            onRoomChange={() => setShowRoomChange(selectedRes.id)}
            onAddCharge={() => setShowCharge(selectedRes.id)}
            onVoidCharge={(eid) => setShowVoidCharge({ resId: selectedRes.id, entryId: eid })}
            onAddPayment={() => setShowPayment(selectedRes.id)}
            onAddDeposit={() => setShowDeposit(selectedRes.id)}
            onShowInvoice={() => setShowInvoice(selectedRes.id)}
            hasConflict={hasConflict}
            isRoomBlocked={isRoomBlocked}
            folioTotals={folioTotals}
            onRefresh={onRefresh}
          />
        )}
        {RenderActionModals({ ...argumentsForModals() })}
      </>
    );

    function argumentsForModals() {
      return {
        showCheckin,
        setShowCheckin,
        showCheckout,
        setShowCheckout,
        showCancel,
        setShowCancel,
        showVoid,
        setShowVoid,
        showCharge,
        setShowCharge,
        showVoidCharge,
        setShowVoidCharge,
        showPayment,
        setShowPayment,
        showDeposit,
        setShowDeposit,
        showRoomChange,
        setShowRoomChange,
        showInvoice,
        setShowInvoice,
        reservations,
        rooms,
        hasConflict,
        isRoomBlocked,
        onCheckin,
        onCheckout,
        onCancel,
        onVoid,
        onAddCharge,
        onVoidCharge,
        onAddPayment,
        onAddDeposit,
        onRoomChange,
        folioTotals,
      };
    }
  }

  /* ---------- Calendario Gantt ---------- */
  if (nav === 'Calendario') {
    const calendarStart = new Date();
    calendarStart.setHours(12, 0, 0, 0);
    calendarStart.setDate(calendarStart.getDate() - ((calendarStart.getDay() + 6) % 7));
    const calStart = toDtoCalendarDate(calendarStart);
    const days = Array.from({ length: 10 }, (_, index) => {
      const day = new Date(calendarStart);
      day.setDate(day.getDate() + index);
      return toDtoCalendarDate(day);
    });
    const filteredRooms = rooms.filter(
      (r) =>
        (calFilter.room === 'Todos' || r.number === calFilter.room) &&
        (calFilter.type === 'Todos' || r.type === calFilter.type),
    );
    const filteredRes = (r: RecRoom) =>
      reservations.filter(
        (res) =>
          res.roomNumber === r.number &&
          !['Cancelada', 'Anulada'].includes(res.status) &&
          (calFilter.status === 'Todos' || res.status === calFilter.status) &&
          res.checkOut > calStart &&
          res.checkIn < days[days.length - 1],
      );

    const clearFilters = () => setCalFilter({ room: 'Todos', type: 'Todos', status: 'Todos' });
    const hasFilters =
      calFilter.room !== 'Todos' || calFilter.type !== 'Todos' || calFilter.status !== 'Todos';

    return (
      <div className="panel rc-cal-panel">
        <div className="panel-heading">
          <div>
            <h3>Calendario de reservas</h3>
            <p>Vista tipo Gantt · habitaciones y ocupación</p>
          </div>
          <button
            className="button small secondary"
            onClick={() => void refreshCalendar()}
            disabled={refreshingCalendar}
            aria-busy={refreshingCalendar}
          >
            {refreshingCalendar ? (
              <LoaderCircle size={14} className="rc-refresh-spinner" />
            ) : (
              <CalendarDays size={14} />
            )}
            {refreshingCalendar ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
        <div className="toolbar rc-cal-toolbar">
          <div className="rc-cal-filters">
            <select
              value={calFilter.type}
              onChange={(e) => setCalFilter({ ...calFilter, type: e.target.value })}
            >
              <option>Todos</option>
              <option>Estándar</option>
              <option>Deluxe</option>
              <option>Suite</option>
            </select>
            <select
              value={calFilter.status}
              onChange={(e) => setCalFilter({ ...calFilter, status: e.target.value })}
            >
              <option>Todos</option>
              <option>Pendiente</option>
              <option>Confirmada</option>
              <option>Check-in</option>
              <option>Check-out</option>
            </select>
            <select
              value={calFilter.room}
              onChange={(e) => setCalFilter({ ...calFilter, room: e.target.value })}
            >
              <option>Todos</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.number}>
                  Hab. {r.number}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button className="rc-clear-filters" onClick={clearFilters}>
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
        <div className="rc-gantt-scroll">
          <div className="rc-gantt">
            <div className="rc-gantt-header">
              <div className="rc-gantt-room-col">Habitación</div>
              {days.map((d) => (
                <div className="rc-gantt-day" key={d}>
                  {new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
                    weekday: 'short',
                    day: 'numeric',
                  })}
                </div>
              ))}
            </div>
            {filteredRooms.map((room) => {
              const res = filteredRes(room);
              const blocked = blocks.filter((b) => b.active && b.roomNumber === room.number);
              return (
                <div className="rc-gantt-row" key={room.id}>
                  <div className="rc-gantt-room-col">
                    <strong>Hab. {room.number}</strong>
                    <span>
                      {room.type} · {room.status}
                    </span>
                  </div>
                  <div className="rc-gantt-track">
                    {days.map((d) => (
                      <div className="rc-gantt-cell" key={d} />
                    ))}
                    {blocked.map((b) => {
                      const startIdx = Math.max(0, days.indexOf(b.startDate));
                      const endIdx = Math.min(days.length - 1, days.indexOf(b.endDate));
                      if (startIdx > days.length - 1 || endIdx < 0) return null;
                      const left = startIdx * 100;
                      const width = Math.max(1, endIdx - startIdx + 1) * 100;
                      return (
                        <div
                          className="rc-gantt-block"
                          key={`b-${b.id}`}
                          style={{
                            left: `${left / days.length}%`,
                            width: `${width / days.length}%`,
                          }}
                          title={`${b.reason}: ${b.observation}`}
                        >
                          Bloqueo
                        </div>
                      );
                    })}
                    {res.map((r) => {
                      const startIdx = Math.max(0, days.indexOf(r.checkIn));
                      const endIdx = Math.min(days.length - 1, days.indexOf(r.checkOut));
                      if (startIdx > days.length - 1 || endIdx < 0) return null;
                      const left = startIdx * 100;
                      const width = Math.max(1, endIdx - startIdx) * 100;
                      return (
                        <button
                          className={`rc-gantt-res ${statusClass(r.status)}`}
                          key={r.id}
                          style={{
                            left: `${left / days.length}%`,
                            width: `${width / days.length}%`,
                          }}
                          onClick={() => onSelectRes(r.id)}
                          title={`${r.code} · ${r.guest.name}`}
                        >
                          <span>{r.guest.name}</span>
                          <small>{r.code}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rc-gantt-legend">
          <span>
            <i className="status-pill warning" /> Pendiente
          </span>
          <span>
            <i className="status-pill info" /> Confirmada
          </span>
          <span>
            <i className="status-pill gold" /> Check-in
          </span>
          <span>
            <i className="status-pill success" /> Check-out
          </span>
          <span>
            <i className="rc-gantt-block-pill" /> Bloqueo
          </span>
        </div>
        {showNewRes && (
          <ReservationFormModal
            nextCode={nextCode}
            rooms={rooms}
            hasConflict={hasConflict}
            isRoomBlocked={isRoomBlocked}
            nights={nights}
            folioTotals={folioTotals}
            onClose={() => setShowNewRes(false)}
            onSave={async (res) => {
              const saved = await onAddReservation(res);
              setShowNewRes(false);
              onAction(`Reserva ${saved.code} creada`);
            }}
          />
        )}
        {selectedRes && (
          <ReservationDetail
            reservation={selectedRes}
            rooms={rooms}
            blocks={blocks}
            onClose={onCloseRes}
            onCheckin={() => setShowCheckin(selectedRes.id)}
            onCheckout={() => setShowCheckout(selectedRes.id)}
            onCancel={() => setShowCancel(selectedRes.id)}
            onVoid={() => setShowVoid(selectedRes.id)}
            onRoomChange={() => setShowRoomChange(selectedRes.id)}
            onAddCharge={() => setShowCharge(selectedRes.id)}
            onVoidCharge={(eid) => setShowVoidCharge({ resId: selectedRes.id, entryId: eid })}
            onAddPayment={() => setShowPayment(selectedRes.id)}
            onAddDeposit={() => setShowDeposit(selectedRes.id)}
            onShowInvoice={() => setShowInvoice(selectedRes.id)}
            hasConflict={hasConflict}
            isRoomBlocked={isRoomBlocked}
            folioTotals={folioTotals}
            onRefresh={onRefresh}
          />
        )}
        {RenderActionModals({
          showCheckin,
          setShowCheckin,
          showCheckout,
          setShowCheckout,
          showCancel,
          setShowCancel,
          showVoid,
          setShowVoid,
          showCharge,
          setShowCharge,
          showVoidCharge,
          setShowVoidCharge,
          showPayment,
          setShowPayment,
          showDeposit,
          setShowDeposit,
          showRoomChange,
          setShowRoomChange,
          showInvoice,
          setShowInvoice,
          reservations,
          rooms,
          hasConflict,
          isRoomBlocked,
          onCheckin,
          onCheckout,
          onCancel,
          onVoid,
          onAddCharge,
          onVoidCharge,
          onAddPayment,
          onAddDeposit,
          onRoomChange,
          folioTotals,
        })}
      </div>
    );
  }

  /* ---------- Reservas ---------- */
  if (nav === 'Reservas') {
    const filtered = reservations.filter((r) =>
      `${r.code} ${r.guest.name} ${r.guest.lastName} ${r.guest.phone} ${r.guest.email} ${r.roomNumber}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
    const byStatus = (s: ReservationStatus) => filtered.filter((r) => r.status === s);
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Reservas</h3>
            <p>Gestiona todas las reservas del hotel</p>
          </div>
        </div>
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, huésped, habitación..."
            />
          </div>
        </div>
        <div className="rc-res-tabs">
          <span className="status-pill warning">Pendientes: {byStatus('Pendiente').length}</span>
          <span className="status-pill info">Confirmadas: {byStatus('Confirmada').length}</span>
          <span className="status-pill gold">Check-in: {byStatus('Check-in').length}</span>
          <span className="status-pill success">Check-out: {byStatus('Check-out').length}</span>
          <span className="status-pill terracotta">
            Canceladas/Anuladas: {byStatus('Cancelada').length + byStatus('Anulada').length}
          </span>
        </div>
        <div className="rc-res-list">
          {filtered.length === 0 && (
            <div className="hk-empty">
              <ClipboardList size={22} />
              <p>No se encontraron reservas</p>
            </div>
          )}
          {filtered.map((r) => {
            const t = folioTotals(r.folio);
            const n = nights(r.checkIn, r.checkOut);
            return (
              <div className="rc-res-card" key={r.id} onClick={() => onSelectRes(r.id)}>
                <div className="rc-res-card-head">
                  <div>
                    <strong>{r.code}</strong>
                    <span>
                      {r.guest.name} {r.guest.lastName}
                    </span>
                  </div>
                  <span className={`status-pill ${statusClass(r.status)}`}>{r.status}</span>
                </div>
                <div className="rc-res-card-meta">
                  <div>
                    <small>Habitación</small>
                    <span>
                      {r.roomNumber} · {r.roomType}
                    </span>
                  </div>
                  <div>
                    <small>Estadía</small>
                    <span>
                      {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)} · {n}{' '}
                      {n === 1 ? 'noche' : 'noches'}
                    </span>
                  </div>
                  <div>
                    <small>Origen</small>
                    <span>{r.origin}</span>
                  </div>
                  <div>
                    <small>Saldo</small>
                    <span className={t.balance > 0 ? 'terracotta-text' : 'success-text'}>
                      {money(t.balance)}
                    </span>
                  </div>
                </div>
                <div className="rc-res-card-foot">
                  <Eye size={14} /> Ver detalle
                </div>
              </div>
            );
          })}
        </div>
        {showNewRes && (
          <ReservationFormModal
            nextCode={nextCode}
            rooms={rooms}
            hasConflict={hasConflict}
            isRoomBlocked={isRoomBlocked}
            nights={nights}
            folioTotals={folioTotals}
            onClose={() => setShowNewRes(false)}
            onSave={async (res) => {
              const saved = await onAddReservation(res);
              setShowNewRes(false);
              onAction(`Reserva ${saved.code} creada`);
            }}
          />
        )}
        {showWalkin && (
          <ReservationFormModal
            walkin
            nextCode={nextCode}
            rooms={rooms}
            hasConflict={hasConflict}
            isRoomBlocked={isRoomBlocked}
            nights={nights}
            folioTotals={folioTotals}
            onClose={() => setShowWalkin(false)}
            onSave={async (res) => {
              const saved = await onAddReservation(res);
              setShowWalkin(false);
              setShowCheckin(saved.id);
              onAction(`Walk-in ${saved.code} registrado`);
            }}
          />
        )}
        {selectedRes && (
          <ReservationDetail
            reservation={selectedRes}
            rooms={rooms}
            blocks={blocks}
            onClose={onCloseRes}
            onCheckin={() => setShowCheckin(selectedRes.id)}
            onCheckout={() => setShowCheckout(selectedRes.id)}
            onCancel={() => setShowCancel(selectedRes.id)}
            onVoid={() => setShowVoid(selectedRes.id)}
            onRoomChange={() => setShowRoomChange(selectedRes.id)}
            onAddCharge={() => setShowCharge(selectedRes.id)}
            onVoidCharge={(eid) => setShowVoidCharge({ resId: selectedRes.id, entryId: eid })}
            onAddPayment={() => setShowPayment(selectedRes.id)}
            onAddDeposit={() => setShowDeposit(selectedRes.id)}
            onShowInvoice={() => setShowInvoice(selectedRes.id)}
            hasConflict={hasConflict}
            isRoomBlocked={isRoomBlocked}
            folioTotals={folioTotals}
            onRefresh={onRefresh}
          />
        )}
        {RenderActionModals({
          showCheckin,
          setShowCheckin,
          showCheckout,
          setShowCheckout,
          showCancel,
          setShowCancel,
          showVoid,
          setShowVoid,
          showCharge,
          setShowCharge,
          showVoidCharge,
          setShowVoidCharge,
          showPayment,
          setShowPayment,
          showDeposit,
          setShowDeposit,
          showRoomChange,
          setShowRoomChange,
          showInvoice,
          setShowInvoice,
          reservations,
          rooms,
          hasConflict,
          isRoomBlocked,
          onCheckin,
          onCheckout,
          onCancel,
          onVoid,
          onAddCharge,
          onVoidCharge,
          onAddPayment,
          onAddDeposit,
          onRoomChange,
          folioTotals,
        })}
      </div>
    );
  }

  /* ---------- Huéspedes (búsqueda) ---------- */
  if (nav === 'Huéspedes') {
    const results = search.trim()
      ? reservations.filter((r) =>
          `${r.guest.name} ${r.guest.lastName} ${r.guest.phone} ${r.guest.email} ${r.code}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
      : reservations.slice(0, 5);
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Búsqueda de huéspedes</h3>
            <p>Busca por nombre, teléfono, correo o código de reserva</p>
          </div>
        </div>
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, teléfono, correo o código de reserva..."
            />
          </div>
        </div>
        <div className="rc-guest-results">
          {search.trim() && results.length === 0 && (
            <div className="hk-empty">
              <Search size={22} />
              <p>No se encontraron huéspedes</p>
            </div>
          )}
          {results.map((r) => {
            const t = folioTotals(r.folio);
            return (
              <div className="rc-guest-card" key={r.id} onClick={() => onSelectRes(r.id)}>
                <div className="rc-guest-avatar">
                  <Users size={20} />
                </div>
                <div className="rc-guest-info">
                  <strong>
                    {r.guest.name} {r.guest.lastName}
                  </strong>
                  <span>
                    {r.guest.phone} · {r.guest.email}
                  </span>
                  <small>
                    {r.code} · Hab. {r.roomNumber} · {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)}
                  </small>
                </div>
                <div className="rc-guest-side">
                  <span className={`status-pill ${statusClass(r.status)}`}>{r.status}</span>
                  {t.balance > 0 && (
                    <span className="rc-guest-balance">Saldo: {money(t.balance)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {selectedRes && (
          <ReservationDetail
            reservation={selectedRes}
            rooms={rooms}
            blocks={blocks}
            onClose={onCloseRes}
            onCheckin={() => setShowCheckin(selectedRes.id)}
            onCheckout={() => setShowCheckout(selectedRes.id)}
            onCancel={() => setShowCancel(selectedRes.id)}
            onVoid={() => setShowVoid(selectedRes.id)}
            onRoomChange={() => setShowRoomChange(selectedRes.id)}
            onAddCharge={() => setShowCharge(selectedRes.id)}
            onVoidCharge={(eid) => setShowVoidCharge({ resId: selectedRes.id, entryId: eid })}
            onAddPayment={() => setShowPayment(selectedRes.id)}
            onAddDeposit={() => setShowDeposit(selectedRes.id)}
            onShowInvoice={() => setShowInvoice(selectedRes.id)}
            hasConflict={hasConflict}
            isRoomBlocked={isRoomBlocked}
            folioTotals={folioTotals}
            onRefresh={onRefresh}
          />
        )}
        {RenderActionModals({
          showCheckin,
          setShowCheckin,
          showCheckout,
          setShowCheckout,
          showCancel,
          setShowCancel,
          showVoid,
          setShowVoid,
          showCharge,
          setShowCharge,
          showVoidCharge,
          setShowVoidCharge,
          showPayment,
          setShowPayment,
          showDeposit,
          setShowDeposit,
          showRoomChange,
          setShowRoomChange,
          showInvoice,
          setShowInvoice,
          reservations,
          rooms,
          hasConflict,
          isRoomBlocked,
          onCheckin,
          onCheckout,
          onCancel,
          onVoid,
          onAddCharge,
          onVoidCharge,
          onAddPayment,
          onAddDeposit,
          onRoomChange,
          folioTotals,
        })}
      </div>
    );
  }

  /* ---------- Disponibilidad ---------- */
  if (nav === 'Disponibilidad') {
    const available = rooms.filter((r) => {
      if (r.status !== 'Disponible') return false;
      if (availType !== 'Todos' && r.type !== availType) return false;
      if (r.capacity < availGuests) return false;
      if (hasConflict(r.number, availCheckIn, availCheckOut)) return false;
      if (isRoomBlocked(r.number, availCheckIn, availCheckOut)) return false;
      return true;
    });

    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Consultar disponibilidad</h3>
            <p>Busca habitaciones disponibles para un rango de fechas</p>
          </div>
        </div>
        <div className="rc-avail-form">
          <label className="rc-field">
            <span>Entrada</span>
            <input
              type="date"
              value={availCheckIn}
              onChange={(e) => setAvailCheckIn(e.target.value)}
            />
          </label>
          <label className="rc-field">
            <span>Salida</span>
            <input
              type="date"
              value={availCheckOut}
              onChange={(e) => setAvailCheckOut(e.target.value)}
            />
          </label>
          <label className="rc-field">
            <span>Huéspedes</span>
            <input
              type="number"
              min={1}
              value={availGuests}
              onChange={(e) => setAvailGuests(Number(e.target.value) || 1)}
            />
          </label>
          <label className="rc-field">
            <span>Tipo</span>
            <select value={availType} onChange={(e) => setAvailType(e.target.value)}>
              <option>Todos</option>
              <option>Estándar</option>
              <option>Deluxe</option>
              <option>Suite</option>
            </select>
          </label>
          <button
            className="button primary"
            onClick={() =>
              onAction(`Disponibilidad consultada del ${availCheckIn} al ${availCheckOut}`)
            }
          >
            <Search size={16} /> Buscar
          </button>
        </div>
        <div className="rc-avail-results">
          <div className="rc-avail-count">
            {available.length}{' '}
            {available.length === 1 ? 'habitación disponible' : 'habitaciones disponibles'}
          </div>
          {available.length === 0 ? (
            <div className="hk-empty">
              <BedDouble size={22} />
              <p>No hay habitaciones disponibles para esas fechas</p>
            </div>
          ) : (
            available.map((r) => (
              <div className="rc-avail-card" key={r.id}>
                <div className="rc-avail-head">
                  <div>
                    <strong>Hab. {r.number}</strong>
                    <span>
                      {r.type} · Piso {r.floor}
                    </span>
                  </div>
                  <span className="status-pill success">Disponible</span>
                </div>
                <div className="rc-avail-meta">
                  <div>
                    <small>Capacidad</small>
                    <span>{r.capacity} huéspedes</span>
                  </div>
                  <div>
                    <small>Tarifa</small>
                    <span>{money(r.rate)}/noche</span>
                  </div>
                </div>
                <div className="rc-avail-features">
                  {r.features.map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                </div>
                <button
                  className="button small primary"
                  onClick={() => {
                    setShowNewRes(true);
                    onAction(`Reserva iniciada para Hab. ${r.number}`);
                  }}
                >
                  <Plus size={14} /> Reservar
                </button>
              </div>
            ))
          )}
        </div>
        {showNewRes && (
          <ReservationFormModal
            nextCode={nextCode}
            rooms={rooms}
            hasConflict={hasConflict}
            isRoomBlocked={isRoomBlocked}
            nights={nights}
            folioTotals={folioTotals}
            onClose={() => setShowNewRes(false)}
            onSave={async (res) => {
              const saved = await onAddReservation(res);
              setShowNewRes(false);
              onAction(`Reserva ${saved.code} creada`);
            }}
          />
        )}
        {RenderActionModals({
          showCheckin,
          setShowCheckin,
          showCheckout,
          setShowCheckout,
          showCancel,
          setShowCancel,
          showVoid,
          setShowVoid,
          showCharge,
          setShowCharge,
          showVoidCharge,
          setShowVoidCharge,
          showPayment,
          setShowPayment,
          showDeposit,
          setShowDeposit,
          showRoomChange,
          setShowRoomChange,
          showInvoice,
          setShowInvoice,
          reservations,
          rooms,
          hasConflict,
          isRoomBlocked,
          onCheckin,
          onCheckout,
          onCancel,
          onVoid,
          onAddCharge,
          onVoidCharge,
          onAddPayment,
          onAddDeposit,
          onRoomChange,
          folioTotals,
        })}
      </div>
    );
  }

  /* ---------- Habitaciones ---------- */
  if (nav === 'Habitaciones') {
    const activeBlocks = blocks.filter((b) => b.active);
    return (
      <>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Estado de habitaciones</h3>
              <p>Inventario y bloqueos</p>
            </div>
            <button className="button small secondary" onClick={() => setShowBlock(true)}>
              <Ban size={14} /> Bloquear habitación
            </button>
          </div>
          <div className="rc-room-grid">
            {rooms.map((r) => (
              <div className={`rc-room-card rc-room-${r.status.toLowerCase()}`} key={r.id}>
                <div className="rc-room-head">
                  <div>
                    <strong>Hab. {r.number}</strong>
                    <span>
                      {r.type} · {r.floor}
                    </span>
                  </div>
                  <span
                    className={`status-pill ${r.status === 'Disponible' ? 'success' : r.status === 'Ocupada' ? 'gold' : r.status === 'Limpieza' ? 'info' : 'terracotta'}`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="rc-room-meta">
                  <div>
                    <small>Capacidad</small>
                    <span>{r.capacity}</span>
                  </div>
                  <div>
                    <small>Tarifa</small>
                    <span>{money(r.rate)}</span>
                  </div>
                </div>
                <div className="rc-room-features">
                  {r.features.slice(0, 3).map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Bloqueos activos</h3>
              <p>Habitaciones temporalmente fuera de servicio</p>
            </div>
          </div>
          <div className="rc-block-list">
            {activeBlocks.length === 0 && (
              <div className="hk-empty">
                <Ban size={22} />
                <p>No hay bloqueos activos</p>
              </div>
            )}
            {activeBlocks.map((b) => (
              <div className="rc-block-row" key={b.id}>
                <div className="rc-block-info">
                  <strong>Hab. {b.roomNumber}</strong>
                  <span>
                    {b.reason} · {fmtDate(b.startDate)} → {fmtDate(b.endDate)}
                  </span>
                  {b.observation && <small>{b.observation}</small>}
                </div>
                <button className="button small secondary" onClick={() => onRemoveBlock(b.id)}>
                  <Check size={14} /> Finalizar bloqueo
                </button>
              </div>
            ))}
          </div>
        </div>
        {showBlock && (
          <BlockModal rooms={rooms} onClose={() => setShowBlock(false)} onAdd={onAddBlock} />
        )}
        {RenderActionModals({
          showCheckin,
          setShowCheckin,
          showCheckout,
          setShowCheckout,
          showCancel,
          setShowCancel,
          showVoid,
          setShowVoid,
          showCharge,
          setShowCharge,
          showVoidCharge,
          setShowVoidCharge,
          showPayment,
          setShowPayment,
          showDeposit,
          setShowDeposit,
          showRoomChange,
          setShowRoomChange,
          showInvoice,
          setShowInvoice,
          reservations,
          rooms,
          hasConflict,
          isRoomBlocked,
          onCheckin,
          onCheckout,
          onCancel,
          onVoid,
          onAddCharge,
          onVoidCharge,
          onAddPayment,
          onAddDeposit,
          onRoomChange,
          folioTotals,
        })}
      </>
    );
  }

  /* ---------- Caja ---------- */
  if (nav === 'Caja') {
    const activeRes = reservations.filter((r) =>
      ['Check-in', 'Confirmada', 'Pendiente'].includes(r.status),
    );
    const totals = activeRes.reduce(
      (acc, r) => {
        const t = folioTotals(r.folio);
        acc.charges += t.charges;
        acc.payments += t.payments;
        acc.deposits += t.deposits;
        acc.balance += t.balance;
        return acc;
      },
      { charges: 0, payments: 0, deposits: 0, balance: 0 },
    );
    return (
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Caja · Cobranza</h3>
            <p>Movimientos financieros de reservas activas</p>
          </div>
          <div className="rc-quick-row">
            <button
              className="button small secondary"
              onClick={() => {
                if (activeRes.length === 0) {
                  onAction('No hay reservas activas');
                  return;
                }
                setCashAction('payment');
              }}
            >
              <Wallet size={14} /> Registrar pago
            </button>
            <button
              className="button small primary"
              onClick={() => {
                if (activeRes.length === 0) {
                  onAction('No hay reservas activas');
                  return;
                }
                setCashAction('charge');
              }}
            >
              <Plus size={14} /> Agregar cargo
            </button>
          </div>
        </div>
        <div className="rc-cash-stats">
          <div className="rc-stat-card">
            <span className="rc-stat-icon terracotta">
              <FileText size={18} />
            </span>
            <div>
              <strong>{money(totals.charges)}</strong>
              <small>Total cargos</small>
            </div>
          </div>
          <div className="rc-stat-card">
            <span className="rc-stat-icon success">
              <Check size={18} />
            </span>
            <div>
              <strong>{money(totals.payments)}</strong>
              <small>Pagos recibidos</small>
            </div>
          </div>
          <div className="rc-stat-card">
            <span className="rc-stat-icon info">
              <Wallet size={18} />
            </span>
            <div>
              <strong>{money(totals.deposits)}</strong>
              <small>Depósitos</small>
            </div>
          </div>
          <div className="rc-stat-card">
            <span className="rc-stat-icon warning">
              <Wallet size={18} />
            </span>
            <div>
              <strong className={totals.balance > 0 ? 'terracotta-text' : ''}>
                {money(totals.balance)}
              </strong>
              <small>Saldo pendiente</small>
            </div>
          </div>
        </div>
        <div className="rc-cash-list">
          {activeRes.map((r) => {
            const t = folioTotals(r.folio);
            return (
              <div className="rc-cash-row" key={r.id} onClick={() => onSelectRes(r.id)}>
                <div>
                  <strong>{r.code}</strong>
                  <span>
                    {r.guest.name} {r.guest.lastName} · Hab. {r.roomNumber}
                  </span>
                </div>
                <div className="rc-cash-amounts">
                  <span>Cargos: {money(t.charges)}</span>
                  <span>Pagos: {money(t.payments)}</span>
                </div>
                <div className="rc-cash-balance">
                  <small>Saldo</small>
                  <strong className={t.balance > 0 ? 'terracotta-text' : 'success-text'}>
                    {money(t.balance)}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
        {selectedRes && (
          <ReservationDetail
            reservation={selectedRes}
            rooms={rooms}
            blocks={blocks}
            onClose={onCloseRes}
            onCheckin={() => setShowCheckin(selectedRes.id)}
            onCheckout={() => setShowCheckout(selectedRes.id)}
            onCancel={() => setShowCancel(selectedRes.id)}
            onVoid={() => setShowVoid(selectedRes.id)}
            onRoomChange={() => setShowRoomChange(selectedRes.id)}
            onAddCharge={() => setShowCharge(selectedRes.id)}
            onVoidCharge={(eid) => setShowVoidCharge({ resId: selectedRes.id, entryId: eid })}
            onAddPayment={() => setShowPayment(selectedRes.id)}
            onAddDeposit={() => setShowDeposit(selectedRes.id)}
            onShowInvoice={() => setShowInvoice(selectedRes.id)}
            hasConflict={hasConflict}
            isRoomBlocked={isRoomBlocked}
            folioTotals={folioTotals}
            onRefresh={onRefresh}
          />
        )}
        {RenderActionModals({
          showCheckin,
          setShowCheckin,
          showCheckout,
          setShowCheckout,
          showCancel,
          setShowCancel,
          showVoid,
          setShowVoid,
          showCharge,
          setShowCharge,
          showVoidCharge,
          setShowVoidCharge,
          showPayment,
          setShowPayment,
          showDeposit,
          setShowDeposit,
          showRoomChange,
          setShowRoomChange,
          showInvoice,
          setShowInvoice,
          reservations,
          rooms,
          hasConflict,
          isRoomBlocked,
          onCheckin,
          onCheckout,
          onCancel,
          onVoid,
          onAddCharge,
          onVoidCharge,
          onAddPayment,
          onAddDeposit,
          onRoomChange,
          folioTotals,
        })}
        {cashAction && (
          <CashResSelectorModal
            reservations={activeRes}
            folioTotals={folioTotals}
            title={cashAction === 'payment' ? 'Registrar pago' : 'Agregar cargo'}
            onClose={() => setCashAction(null)}
            onSelect={(id) => {
              setCashAction(null);
              if (cashAction === 'payment') setShowPayment(id);
              else setShowCharge(id);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="hk-empty">
        <ClipboardList size={22} />
        <p>Selecciona una opción del menú</p>
      </div>
    </div>
  );
}

/* ---------- Shared action modal renderer ---------- */
type ModalsArgs = {
  showCheckin: number | null;
  setShowCheckin: (v: number | null) => void;
  showCheckout: number | null;
  setShowCheckout: (v: number | null) => void;
  showCancel: number | null;
  setShowCancel: (v: number | null) => void;
  showVoid: number | null;
  setShowVoid: (v: number | null) => void;
  showCharge: number | null;
  setShowCharge: (v: number | null) => void;
  showVoidCharge: { resId: number; entryId: number } | null;
  setShowVoidCharge: (v: { resId: number; entryId: number } | null) => void;
  showPayment: number | null;
  setShowPayment: (v: number | null) => void;
  showDeposit: number | null;
  setShowDeposit: (v: number | null) => void;
  showRoomChange: number | null;
  setShowRoomChange: (v: number | null) => void;
  showInvoice: number | null;
  setShowInvoice: (v: number | null) => void;
  reservations: Reservation[];
  rooms: RecRoom[];
  hasConflict: (room: string, ci: string, co: string, excludeId?: number) => boolean;
  isRoomBlocked: (room: string, ci: string, co: string) => boolean;
  onCheckin: (
    id: number,
    updates: Partial<{
      name: string;
      lastName: string;
      phone: string;
      email: string;
      docType: string;
      docNumber: string;
      birthDate: string;
      nationality: string;
    }>,
    companions: Companion[],
    res: Reservation,
  ) => void;
  onCheckout: (id: number) => void;
  onCancel: (id: number, reason: string) => void;
  onVoid: (id: number, reason: string) => void;
  onAddCharge: (
    resId: number,
    concept: string,
    category: string,
    amount: number,
    observation: string,
  ) => void;
  onVoidCharge: (resId: number, entryId: number, reason: string) => void;
  onAddPayment: (resId: number, amount: number, method: PaymentMethod, reference: string) => void;
  onAddDeposit: (resId: number, amount: number, method: PaymentMethod, reference: string) => void;
  onRoomChange: (id: number, room: string) => void;
  folioTotals: (f: FolioEntry[]) => Totals;
};

function RenderActionModals(a: ModalsArgs) {
  const checkinRes =
    a.showCheckin !== null ? a.reservations.find((r) => r.id === a.showCheckin) : null;
  const checkoutRes =
    a.showCheckout !== null ? a.reservations.find((r) => r.id === a.showCheckout) : null;
  const cancelRes =
    a.showCancel !== null ? a.reservations.find((r) => r.id === a.showCancel) : null;
  const voidRes = a.showVoid !== null ? a.reservations.find((r) => r.id === a.showVoid) : null;
  const chargeRes =
    a.showCharge !== null ? a.reservations.find((r) => r.id === a.showCharge) : null;
  const payRes = a.showPayment !== null ? a.reservations.find((r) => r.id === a.showPayment) : null;
  const depRes = a.showDeposit !== null ? a.reservations.find((r) => r.id === a.showDeposit) : null;
  const roomChangeRes =
    a.showRoomChange !== null ? a.reservations.find((r) => r.id === a.showRoomChange) : null;
  const invoiceRes =
    a.showInvoice !== null ? a.reservations.find((r) => r.id === a.showInvoice) : null;

  return (
    <>
      {checkinRes && (
        <CheckinModal
          reservation={checkinRes}
          rooms={a.rooms}
          onClose={() => a.setShowCheckin(null)}
          onCheckin={a.onCheckin}
        />
      )}
      {checkoutRes && (
        <CheckoutModal
          reservation={checkoutRes}
          folioTotals={a.folioTotals}
          onClose={() => a.setShowCheckout(null)}
          onCheckout={a.onCheckout}
        />
      )}
      {cancelRes && (
        <ReasonModal
          title="CANCELAR RESERVA"
          label={`Cancelar ${cancelRes.code}`}
          tone="warning"
          onClose={() => a.setShowCancel(null)}
          onConfirm={(reason) => a.onCancel(cancelRes.id, reason)}
        />
      )}
      {voidRes && (
        <ReasonModal
          title="ANULAR RESERVA"
          label={`Anular ${voidRes.code}`}
          tone="terracotta"
          onClose={() => a.setShowVoid(null)}
          onConfirm={(reason) => a.onVoid(voidRes.id, reason)}
        />
      )}
      {chargeRes && (
        <ChargeModal
          onClose={() => a.setShowCharge(null)}
          onAdd={(concept, category, amount, obs) =>
            a.onAddCharge(chargeRes.id, concept, category, amount, obs)
          }
        />
      )}
      {a.showVoidCharge && (
        <ReasonModal
          title="ANULAR CARGO"
          label="Anular cargo"
          tone="terracotta"
          onClose={() => a.setShowVoidCharge(null)}
          onConfirm={(reason) =>
            a.onVoidCharge(a.showVoidCharge!.resId, a.showVoidCharge!.entryId, reason)
          }
        />
      )}
      {payRes && (
        <PaymentModal
          title="REGISTRAR PAGO"
          onClose={() => a.setShowPayment(null)}
          onSubmit={(amt, method, ref) => a.onAddPayment(payRes.id, amt, method, ref)}
        />
      )}
      {depRes && (
        <PaymentModal
          title="REGISTRAR DEPÓSITO"
          isDeposit
          onClose={() => a.setShowDeposit(null)}
          onSubmit={(amt, method, ref) => a.onAddDeposit(depRes.id, amt, method, ref)}
        />
      )}
      {roomChangeRes && (
        <RoomChangeModal
          reservation={roomChangeRes}
          rooms={a.rooms}
          hasConflict={a.hasConflict}
          isRoomBlocked={a.isRoomBlocked}
          onClose={() => a.setShowRoomChange(null)}
          onConfirm={a.onRoomChange}
        />
      )}
      {invoiceRes && (
        <InvoiceModal
          reservation={invoiceRes}
          folioTotals={a.folioTotals}
          onClose={() => a.setShowInvoice(null)}
        />
      )}
    </>
  );
}

/* ---------- Cash reservation selector ---------- */
function CashResSelectorModal({
  reservations,
  folioTotals,
  title,
  onClose,
  onSelect,
}: {
  reservations: Reservation[];
  folioTotals: (f: FolioEntry[]) => Totals;
  title: string;
  onClose: () => void;
  onSelect: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = reservations.filter((r) =>
    `${r.code} ${r.guest.name} ${r.guest.lastName} ${r.roomNumber}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 460 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">SELECCIONAR RESERVA</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="login-helper">
          Busca por nombre del huésped o código de reserva para aplicar el movimiento a la cuenta
          correcta.
        </p>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <div className="search-box">
            <Search size={17} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre o código de reserva..."
            />
          </div>
        </div>
        <div className="rc-res-list" style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div className="hk-empty">
              <Search size={22} />
              <p>No se encontraron reservas</p>
            </div>
          )}
          {filtered.map((r) => {
            const t = folioTotals(r.folio);
            return (
              <div
                className="rc-res-card"
                key={r.id}
                onClick={() => onSelect(r.id)}
                style={{ padding: '12px 14px' }}
              >
                <div className="rc-res-card-head" style={{ marginBottom: 8 }}>
                  <div>
                    <strong>{r.code}</strong>
                    <span>
                      {r.guest.name} {r.guest.lastName} · Hab. {r.roomNumber}
                    </span>
                  </div>
                  <span className={`status-pill ${statusClass(r.status)}`}>{r.status}</span>
                </div>
                <div className="rc-res-card-meta" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <small>Saldo</small>
                    <span className={t.balance > 0 ? 'terracotta-text' : 'success-text'}>
                      {money(t.balance)}
                    </span>
                  </div>
                  <div>
                    <small>Estadía</small>
                    <span>
                      {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
