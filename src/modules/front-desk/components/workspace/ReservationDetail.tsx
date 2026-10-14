/* eslint-disable @typescript-eslint/no-unused-vars -- Migracion controlada del prototipo Bolt; se conserva la logica original para portarla incrementalmente. */
import { useState } from 'react';
import {
  Ban,
  BedDouble,
  Check,
  DoorOpen,
  FileText,
  Pencil,
  Plus,
  Printer,
  TriangleAlert,
  Wallet,
  X,
} from 'lucide-react';
import type {
  FolioEntry,
  RecRoom,
  Reservation,
  ReservationStatus,
  RoomBlock,
} from '@/private/workspace/PrivateWorkspace';
import { ReservationEditModal } from './ReceptionModals';

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

const money = (n: number) => `$${n.toLocaleString('es-MX')}`;

const formatDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

type Totals = { charges: number; deposits: number; payments: number; balance: number };

export function ReservationDetail({
  reservation,
  rooms,
  blocks,
  onClose,
  onCheckin,
  onCheckout,
  onCancel,
  onVoid,
  onRoomChange,
  onAddCharge,
  onVoidCharge,
  onAddPayment,
  onAddDeposit,
  onShowInvoice,
  hasConflict,
  isRoomBlocked,
  folioTotals,
  onRefresh,
}: {
  reservation: Reservation;
  rooms: RecRoom[];
  blocks: RoomBlock[];
  onClose: () => void;
  onCheckin: () => void;
  onCheckout: () => void;
  onCancel: () => void;
  onVoid: () => void;
  onRoomChange: () => void;
  onAddCharge: () => void;
  onVoidCharge: (entryId: number) => void;
  onAddPayment: () => void;
  onAddDeposit: () => void;
  onShowInvoice: () => void;
  hasConflict: (room: string, ci: string, co: string, excludeId?: number) => boolean;
  isRoomBlocked: (room: string, ci: string, co: string) => boolean;
  folioTotals: (folio: FolioEntry[]) => Totals;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState<'info' | 'folio'>('info');
  const [editing, setEditing] = useState(false);
  const t = folioTotals(reservation.folio);
  const nights = Math.max(
    1,
    Math.round(
      (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) /
        86400000,
    ),
  );
  const canCheckin = reservation.status === 'Confirmada' || reservation.status === 'Pendiente';
  const canCheckout = reservation.status === 'Check-in';
  const isActive = !['Cancelada', 'Anulada', 'Check-out'].includes(reservation.status);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal rc-detail-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">DETALLE DE RESERVA</p>
            <h2>{reservation.code}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="rc-detail-statusbar">
          <span className={`status-pill ${statusClass(reservation.status)}`}>
            {reservation.status}
          </span>
          <span className="rc-detail-origin">Origen: {reservation.origin}</span>
          {reservation.checkInTime && (
            <span className="rc-detail-meta">Check-in: {reservation.checkInTime}</span>
          )}
          {reservation.checkOutTime && (
            <span className="rc-detail-meta">Check-out: {reservation.checkOutTime}</span>
          )}
        </div>

        {reservation.status === 'Cancelada' && reservation.cancelReason && (
          <div className="rc-alert warning">
            <TriangleAlert size={15} />
            <div>
              <strong>Reserva cancelada</strong>
              <p>{reservation.cancelReason}</p>
            </div>
          </div>
        )}
        {reservation.status === 'Anulada' && reservation.voidReason && (
          <div className="rc-alert terracotta">
            <Ban size={15} />
            <div>
              <strong>Reserva anulada</strong>
              <p>{reservation.voidReason}</p>
            </div>
          </div>
        )}

        <div className="rc-tabs">
          <button className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>
            Información
          </button>
          <button className={tab === 'folio' ? 'active' : ''} onClick={() => setTab('folio')}>
            Cuenta / Folio
          </button>
        </div>

        {tab === 'info' && (
          <>
            <div className="rc-detail-grid">
              <div className="rc-detail-section">
                <h4>Huésped titular</h4>
                <div className="rc-detail-fields">
                  <div>
                    <small>Nombre</small>
                    <span>
                      {reservation.guest.name} {reservation.guest.lastName}
                    </span>
                  </div>
                  <div>
                    <small>Teléfono</small>
                    <span>{reservation.guest.phone}</span>
                  </div>
                  <div>
                    <small>Correo</small>
                    <span>{reservation.guest.email}</span>
                  </div>
                  <div>
                    <small>Documento</small>
                    <span>
                      {reservation.guest.docType} · {reservation.guest.docNumber}
                    </span>
                  </div>
                  <div>
                    <small>Nacionalidad</small>
                    <span>{reservation.guest.nationality}</span>
                  </div>
                </div>
              </div>

              <div className="rc-detail-section">
                <h4>Estadía</h4>
                <div className="rc-detail-fields">
                  <div>
                    <small>Entrada</small>
                    <span>{formatDate(reservation.checkIn)}</span>
                  </div>
                  <div>
                    <small>Salida</small>
                    <span>{formatDate(reservation.checkOut)}</span>
                  </div>
                  <div>
                    <small>Noches</small>
                    <span>{nights}</span>
                  </div>
                  <div>
                    <small>Habitación</small>
                    <span>
                      {reservation.roomNumber} · {reservation.roomType}
                    </span>
                  </div>
                  <div>
                    <small>Tarifa / noche</small>
                    <span>{money(reservation.rate)}</span>
                  </div>
                  <div>
                    <small>Huéspedes</small>
                    <span>{reservation.guestCount}</span>
                  </div>
                  {/* El backend solo acepta el código mientras la reserva está en check-in. */}
                  {reservation.status === 'Check-in' && reservation.guestLinkCode && (
                    <div>
                      <small>Código de acceso del huésped</small>
                      <span>
                        <strong>{reservation.guestLinkCode}</strong>
                      </span>
                      <small>Entrégalo al huésped para su portal (Acceso de huésped).</small>
                    </div>
                  )}
                </div>
              </div>

              {reservation.companions.length > 0 && (
                <div className="rc-detail-section">
                  <h4>Acompañantes</h4>
                  <div className="rc-companion-list">
                    {reservation.companions.map((c) => (
                      <div className="rc-companion-row" key={c.id}>
                        <span>
                          <strong>
                            {c.name} {c.lastName}
                          </strong>
                        </span>
                        <span>{c.document}</span>
                        <span>{c.age} años</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reservation.observations && (
                <div className="rc-detail-section">
                  <h4>Observaciones</h4>
                  <p className="rc-observations-text">{reservation.observations}</p>
                </div>
              )}
            </div>

            <div className="rc-detail-actions">
              {isActive && (
                <button
                  className="button small secondary rc-action-icon-btn"
                  onClick={() => setEditing(true)}
                  aria-label="Editar"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
              )}
              {canCheckin && (
                <button
                  className="button small primary rc-action-icon-btn"
                  onClick={onCheckin}
                  aria-label="Realizar check-in"
                  title="Realizar check-in"
                >
                  <Check size={16} />
                </button>
              )}
              {canCheckout && (
                <button
                  className="button small primary rc-action-icon-btn"
                  onClick={onCheckout}
                  aria-label="Check-out"
                  title="Check-out"
                >
                  <DoorOpen size={16} />
                </button>
              )}
              {isActive && (
                <button
                  className="button small secondary rc-action-icon-btn"
                  onClick={onRoomChange}
                  aria-label="Cambiar habitación"
                  title="Cambiar habitación"
                >
                  <BedDouble size={16} />
                </button>
              )}
              {isActive && (
                <button
                  className="button small secondary rc-action-icon-btn"
                  onClick={onAddDeposit}
                  aria-label="Depósito"
                  title="Depósito"
                >
                  <Wallet size={16} />
                </button>
              )}
              {isActive && (
                <button
                  className="button small secondary rc-action-icon-btn"
                  onClick={onCancel}
                  aria-label="Cancelar"
                  title="Cancelar"
                >
                  <Ban size={16} />
                </button>
              )}
              {isActive && (
                <button
                  className="button small secondary rc-action-icon-btn"
                  onClick={onVoid}
                  aria-label="Anular"
                  title="Anular"
                >
                  <TriangleAlert size={16} />
                </button>
              )}
              {reservation.status === 'Check-out' && (
                <button
                  className="button small secondary rc-action-icon-btn"
                  onClick={onShowInvoice}
                  aria-label="Comprobante"
                  title="Comprobante"
                >
                  <Printer size={16} />
                </button>
              )}
            </div>
          </>
        )}

        {tab === 'folio' && (
          <>
            <div className="rc-folio-list">
              {reservation.folio.length === 0 && (
                <div className="hk-empty">
                  <FileText size={22} />
                  <p>Sin movimientos registrados</p>
                </div>
              )}
              {reservation.folio.map((entry) => (
                <div
                  className={`rc-folio-row ${entry.status === 'Anulado' ? 'voided' : ''}`}
                  key={entry.id}
                >
                  <div className="rc-folio-info">
                    <strong>{entry.concept}</strong>
                    <span>
                      {entry.category} · {formatDate(entry.date)}
                      {entry.method ? ` · ${entry.method}` : ''}
                      {entry.reference ? ` · ${entry.reference}` : ''}
                    </span>
                    {entry.status === 'Anulado' && entry.voidReason && (
                      <small className="rc-void-reason">Anulado: {entry.voidReason}</small>
                    )}
                  </div>
                  <div className="rc-folio-right">
                    <span
                      className={`rc-folio-amount ${entry.type === 'Cargo' ? 'charge' : 'credit'}`}
                    >
                      {entry.type === 'Cargo' ? '+' : '−'}
                      {money(entry.amount)}
                    </span>
                    <span
                      className={`status-pill ${entry.type === 'Cargo' ? 'terracotta' : 'success'}`}
                    >
                      {entry.type}
                    </span>
                    {entry.status === 'Anulado' ? (
                      <span className="status-pill warning">Anulado</span>
                    ) : entry.type === 'Cargo' && isActive ? (
                      <button
                        className="button small secondary"
                        onClick={() => onVoidCharge(entry.id)}
                      >
                        <Ban size={13} />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rc-folio-summary">
              <div>
                <span>Total cargos</span>
                <strong>{money(t.charges)}</strong>
              </div>
              <div>
                <span>Pagos</span>
                <strong>−{money(t.payments)}</strong>
              </div>
              <div>
                <span>Depósitos</span>
                <strong>−{money(t.deposits)}</strong>
              </div>
              <div className="rc-folio-balance">
                <span>Saldo pendiente</span>
                <strong className={t.balance > 0 ? 'terracotta-text' : ''}>
                  {money(t.balance)}
                </strong>
              </div>
            </div>

            {isActive && (
              <div className="rc-detail-actions">
                <button
                  className="button small secondary rc-action-icon-btn"
                  onClick={onAddCharge}
                  aria-label="Agregar cargo"
                  title="Agregar cargo"
                >
                  <Plus size={16} />
                </button>
                <button
                  className="button small secondary rc-action-icon-btn"
                  onClick={onAddPayment}
                  aria-label="Registrar pago"
                  title="Registrar pago"
                >
                  <Wallet size={16} />
                </button>
                <button
                  className="button small secondary rc-action-icon-btn"
                  onClick={onAddDeposit}
                  aria-label="Depósito"
                  title="Depósito"
                >
                  <Wallet size={16} />
                </button>
              </div>
            )}
          </>
        )}
        {editing && (
          <ReservationEditModal
            reservation={reservation}
            onClose={() => setEditing(false)}
            onSaved={onRefresh}
          />
        )}
      </div>
    </div>
  );
}
