import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { bookingService } from '@/services/bookingService';
import { guestAccountService } from '@/services/guestAccountService';
import { guestService } from '@/services/guestService';
import { roomService } from '@/services/roomService';
import { BOOKING_STATUS_TRANSITIONS } from '@/shared/constants/statuses';
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { Modal } from '@/shared/components/Modal';
import type {
  Booking,
  Charge,
  Deposit,
  Guest,
  GuestAccount,
  Payment,
} from '@/shared/types/entities';
import { formatCurrency } from '@/shared/utils/currency';
import { formatDateGT } from '@/shared/utils/date';

type CheckOutStatus = 'loading' | 'ready' | 'error' | 'completed';

export function CheckOutScreen() {
  const { bookingId } = useParams<'bookingId'>();
  const [status, setStatus] = useState<CheckOutStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [account, setAccount] = useState<GuestAccount | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const loadCheckOut = useCallback(async () => {
    if (!bookingId) {
      setError('No se indicó la reserva para realizar el check-out.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      const selectedBooking = await bookingService.getBookingById(bookingId);
      if (!selectedBooking) throw new Error('No encontramos la reserva seleccionada.');

      const [selectedGuest, selectedAccount] = await Promise.all([
        guestService.getGuestById(selectedBooking.guestId),
        guestAccountService.getAccountByBookingId(selectedBooking.id),
      ]);
      if (!selectedAccount) throw new Error('No encontramos la cuenta asociada a esta reserva.');

      const [selectedCharges, selectedPayments, selectedDeposits] = await Promise.all([
        guestAccountService.getChargesByBookingId(selectedBooking.id),
        guestAccountService.getPaymentsByBookingId(selectedBooking.id),
        guestAccountService.getDepositsByBookingId(selectedBooking.id),
      ]);
      setBooking(selectedBooking);
      setGuest(selectedGuest ?? null);
      setAccount(selectedAccount);
      setCharges(selectedCharges);
      setPayments(selectedPayments);
      setDeposits(selectedDeposits);
      setStatus(selectedBooking.status === 'checkedOut' ? 'completed' : 'ready');
    } catch (cause: unknown) {
      setBooking(null);
      setGuest(null);
      setAccount(null);
      setCharges([]);
      setPayments([]);
      setDeposits([]);
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el check-out.');
      setStatus('error');
    }
  }, [bookingId]);

  useEffect(() => {
    void loadCheckOut();
  }, [loadCheckOut]);

  const chargeColumns = useMemo<DataTableColumn<Charge>[]>(
    () => [
      {
        id: 'date',
        header: 'Fecha',
        cell: (charge) => formatDateGT(charge.chargedAt),
        sortValue: (charge) => charge.chargedAt.getTime(),
      },
      {
        id: 'description',
        header: 'Concepto',
        cell: (charge) => <strong>{charge.description}</strong>,
        sortValue: (charge) => charge.description,
      },
      {
        id: 'quantity',
        header: 'Cantidad',
        cell: (charge) => charge.quantity,
        sortValue: (charge) => charge.quantity,
      },
      {
        id: 'amount',
        header: 'Importe',
        cell: (charge) => <strong>{formatCurrency(charge.amountCents, charge.currency)}</strong>,
        sortValue: (charge) => charge.amountCents,
      },
    ],
    [],
  );

  function openConfirm() {
    if (!canCheckOut || isCheckingOut) return;
    setError(null);
    setIsConfirmOpen(true);
  }

  function closeConfirm() {
    if (!isCheckingOut) setIsConfirmOpen(false);
  }

  async function handleCheckOut() {
    if (!booking || !canCheckOut || isCheckingOut) return;

    setIsCheckingOut(true);
    setError(null);
    try {
      const checkedOutBooking = await bookingService.checkOut(booking.id);
      const [
        refreshedBooking,
        refreshedAccount,
        refreshedCharges,
        refreshedPayments,
        refreshedDeposits,
        refreshedRooms,
      ] = await Promise.all([
        bookingService.getBookingById(booking.id),
        guestAccountService.getAccountByBookingId(booking.id),
        guestAccountService.getChargesByBookingId(booking.id),
        guestAccountService.getPaymentsByBookingId(booking.id),
        guestAccountService.getDepositsByBookingId(booking.id),
        roomService.getRooms(),
      ]);
      const nextBooking = refreshedBooking ?? checkedOutBooking;
      void refreshedRooms;
      setBooking(nextBooking);
      if (refreshedAccount) setAccount(refreshedAccount);
      setCharges(refreshedCharges);
      setPayments(refreshedPayments);
      setDeposits(refreshedDeposits);
      setStatus(nextBooking.status === 'checkedOut' ? 'completed' : 'ready');
      setIsConfirmOpen(false);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No fue posible confirmar el check-out.');
    } finally {
      setIsCheckingOut(false);
    }
  }

  const canTransitionToCheckedOut = booking
    ? BOOKING_STATUS_TRANSITIONS[booking.status].includes('checkedOut')
    : false;
  const hasNonZeroBalance = account ? account.balanceCents !== 0 : true;
  const canCheckOut = canTransitionToCheckedOut;
  const chargesTotalCents = charges.reduce((total, charge) => total + charge.amountCents, 0);
  const paymentsTotalCents = payments.reduce((total, payment) => total + payment.amountCents, 0);
  const depositsTotalCents = deposits
    .filter((deposit) => deposit.status !== 'refunded')
    .reduce((total, deposit) => total + deposit.amountCents, 0);
  const guestName = guest ? `${guest.firstName} ${guest.lastName}` : booking?.guestId;

  if (status === 'loading') {
    return (
      <section className="content">
        <LoadingState label="Cargando el comprobante de salida…" />
      </section>
    );
  }

  if (status === 'error' || !booking || !account) {
    return (
      <section className="content">
        <ErrorState
          title="No pudimos cargar el check-out"
          description={error ?? 'La reserva o su cuenta no están disponibles.'}
          onRetry={loadCheckOut}
        />
      </section>
    );
  }

  return (
    <section className="content">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">Front desk · Comprobante de salida</span>
          <h1>Check-out</h1>
          <p className="muted">
            {guestName ? `${guestName} · ` : ''}Reserva {booking.id} · Confirmación{' '}
            {booking.confirmationCode}
          </p>
        </div>
        <div className="welcome-actions">
          <button
            className="button primary"
            type="button"
            onClick={openConfirm}
            disabled={!canCheckOut || isCheckingOut}
          >
            {isCheckingOut
              ? 'Confirmando…'
              : status === 'completed'
                ? 'Check-out confirmado'
                : 'Confirmar check-out'}
          </button>
        </div>
      </div>

      {status === 'completed' && (
        <p className="status-pill success" role="status">
          Check-out registrado correctamente. La reserva quedó cerrada.
        </p>
      )}

      {error && (
        <div className="ui-state ui-state--error" role="alert">
          <p className="ui-state__description">{error}</p>
        </div>
      )}

      {account.balanceCents !== 0 && (
        <div className="ui-state ui-state--warning" role="alert">
          <p className="ui-state__description">
            El saldo debe quedar exactamente en {formatCurrency(0, account.currency)} antes de
            cerrar la estancia. Saldo actual:{' '}
            {formatCurrency(account.balanceCents, account.currency)}.
          </p>
        </div>
      )}

      <div className="metric-grid">
        <article className="metric-card">
          <div>
            <p>Saldo pendiente</p>
            <h2>{formatCurrency(account.balanceCents, account.currency)}</h2>
            <span>Cuenta {account.status === 'open' ? 'abierta' : 'cerrada'}</span>
          </div>
        </article>
        <article className="metric-card">
          <div>
            <p>Cargos registrados</p>
            <h2>{charges.length}</h2>
            <span>Total de cargos: {formatCurrency(chargesTotalCents, account.currency)}</span>
          </div>
        </article>
        <article className="metric-card">
          <div>
            <p>Pagos y depósitos</p>
            <h2>{formatCurrency(paymentsTotalCents + depositsTotalCents, account.currency)}</h2>
            <span>
              Pagos {formatCurrency(paymentsTotalCents, account.currency)} · Depósitos{' '}
              {formatCurrency(depositsTotalCents, account.currency)}
            </span>
          </div>
        </article>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Resumen de la estadía</h3>
              <p>Comprobante de fechas y total final de la cuenta.</p>
            </div>
          </div>
          <div className="metric-grid">
            <article className="metric-card">
              <div>
                <p>Huésped</p>
                <h2>{guestName ?? booking.guestId}</h2>
                {guest && <span>Referencia {guest.id}</span>}
              </div>
            </article>
            <article className="metric-card">
              <div>
                <p>Entrada</p>
                <h2>{formatDateGT(booking.checkIn)}</h2>
              </div>
            </article>
            <article className="metric-card">
              <div>
                <p>Salida</p>
                <h2>{formatDateGT(booking.checkOut)}</h2>
              </div>
            </article>
            <article className="metric-card">
              <div>
                <p>Estancia base</p>
                <h2>{formatCurrency(booking.totalAmountCents, booking.currency)}</h2>
              </div>
            </article>
            <article className="metric-card">
              <div>
                <p>Total final</p>
                <h2>{formatCurrency(account.balanceCents, account.currency)}</h2>
              </div>
            </article>
          </div>
        </div>

        <aside className="panel">
          <div className="panel-heading">
            <div>
              <h3>Estado de la reserva</h3>
              <p>
                {canCheckOut
                  ? 'Lista para confirmar la salida.'
                  : hasNonZeroBalance
                    ? 'El saldo debe quedar exactamente en cero.'
                    : 'Esta reserva no permite check-out.'}
              </p>
            </div>
          </div>
          <span className={`status-pill ${canCheckOut ? 'info' : 'success'}`}>
            {booking.status === 'checkedIn'
              ? 'Hospedado'
              : booking.status === 'checkedOut'
                ? 'Check-out realizado'
                : booking.status}
          </span>
        </aside>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Desglose de cargos</h3>
            <p>Cargos realizados durante la estadía.</p>
          </div>
        </div>
        <DataTable
          columns={chargeColumns}
          data={charges}
          getRowId={(charge) => charge.id}
          caption="Cargos del comprobante de salida"
          emptyMessage="No hay cargos registrados para esta estadía."
        />
      </div>

      <Modal open={isConfirmOpen} onClose={closeConfirm} title="Confirmar salida del huésped">
        <p>
          Vas a cerrar la estadía de {guestName ?? 'este huésped'} y la cuenta de la reserva{' '}
          {booking.confirmationCode}. Esta acción no se puede deshacer.
        </p>
        <p>
          <strong>Saldo a liquidar:</strong>{' '}
          {formatCurrency(account.balanceCents, account.currency)}
        </p>
        {error && (
          <div className="ui-state ui-state--error" role="alert">
            <p className="ui-state__description">{error}</p>
          </div>
        )}
        <div className="modal-foot">
          <button
            className="button secondary"
            type="button"
            onClick={closeConfirm}
            disabled={isCheckingOut}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            type="button"
            onClick={handleCheckOut}
            disabled={isCheckingOut}
          >
            {isCheckingOut ? 'Confirmando…' : 'Confirmar check-out'}
          </button>
        </div>
      </Modal>
    </section>
  );
}
