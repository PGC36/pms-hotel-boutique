import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable';
import { ErrorState } from '@/shared/components/ErrorState';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/LoadingState';
import { Modal } from '@/shared/components/Modal';
import { bookingService } from '@/services/bookingService';
import { guestAccountService } from '@/services/guestAccountService';
import { guestService } from '@/services/guestService';
import type {
  Booking,
  Charge,
  Deposit,
  Guest,
  GuestAccount,
  Payment,
} from '@/shared/types/entities';
import { formatCurrency } from '@/shared/utils/currency';
import { formatDateGT, formatTimeGT } from '@/shared/utils/date';

type FormErrors = { description?: string; amount?: string };

const CHARGE_STATUS_LABELS: Record<Charge['status'], string> = {
  pending: 'Pendiente',
  posted: 'Aplicado',
  voided: 'Anulado',
};

const CHARGE_STATUS_TONES: Record<Charge['status'], BadgeTone> = {
  pending: 'warning',
  posted: 'success',
  voided: 'danger',
};

function formatDate(value: Date) {
  return `${formatDateGT(value)} ${formatTimeGT(value)}`;
}

function amountToCents(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function GuestAccountScreen() {
  const navigate = useNavigate();
  const { accountId } = useParams<'accountId'>();
  const [account, setAccount] = useState<GuestAccount | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadFinancials = useCallback(async (bookingId: string) => {
    const [selectedAccount, selectedCharges, selectedPayments, selectedDeposits] =
      await Promise.all([
        guestAccountService.getAccountByBookingId(bookingId),
        guestAccountService.getChargesByBookingId(bookingId),
        guestAccountService.getPaymentsByBookingId(bookingId),
        guestAccountService.getDepositsByBookingId(bookingId),
      ]);
    if (!selectedAccount) throw new Error('No encontramos la cuenta asociada a esta reserva.');

    setAccount(selectedAccount);
    setCharges(selectedCharges);
    setPayments(selectedPayments);
    setDeposits(selectedDeposits);
    return selectedAccount;
  }, []);

  const loadAccount = useCallback(async () => {
    if (!accountId) {
      setError('No se indicó la cuenta de la estadía.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let selectedAccount: GuestAccount;
      if (isUuid(accountId)) {
        selectedAccount = await loadFinancials(accountId);
      } else {
        const accounts = await guestAccountService.getAccounts();
        const legacyAccount = accounts.find(
          (item) => item.id === accountId || item.bookingId === accountId,
        );
        if (!legacyAccount) {
          throw new Error('No encontramos una cuenta para la estadía seleccionada.');
        }
        selectedAccount = await loadFinancials(legacyAccount.bookingId);
      }

      const selectedBooking = await bookingService.getBookingById(selectedAccount.bookingId);
      const selectedGuest = selectedBooking
        ? await guestService.getGuestById(selectedBooking.guestId)
        : undefined;
      setBooking(selectedBooking ?? null);
      setGuest(selectedGuest ?? null);
    } catch (cause: unknown) {
      setAccount(null);
      setBooking(null);
      setGuest(null);
      setCharges([]);
      setPayments([]);
      setDeposits([]);
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar la cuenta.');
    } finally {
      setLoading(false);
    }
  }, [accountId, loadFinancials]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const chargeColumns = useMemo<DataTableColumn<Charge>[]>(
    () => [
      {
        id: 'description',
        header: 'Concepto',
        cell: (charge) => <strong>{charge.description}</strong>,
        sortValue: (charge) => charge.description,
      },
      {
        id: 'date',
        header: 'Fecha',
        cell: (charge) => formatDate(charge.chargedAt),
        sortValue: (charge) => charge.chargedAt.getTime(),
      },
      {
        id: 'status',
        header: 'Estado',
        cell: (charge) => (
          <Badge tone={CHARGE_STATUS_TONES[charge.status]}>
            {CHARGE_STATUS_LABELS[charge.status]}
          </Badge>
        ),
        sortValue: (charge) => charge.status,
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

  function openChargeModal() {
    setDescription('');
    setAmount('');
    setFormErrors({});
    setSaveError(null);
    setFeedback(null);
    setIsModalOpen(true);
  }

  function openPaymentModal() {
    setPaymentAmount(
      account?.balanceCents && account.balanceCents > 0 ? String(account.balanceCents / 100) : '',
    );
    setPaymentReference('');
    setFormErrors({});
    setSaveError(null);
    setFeedback(null);
    setIsPaymentModalOpen(true);
  }

  function closeChargeModal() {
    if (!isSaving) setIsModalOpen(false);
  }

  function closePaymentModal() {
    if (!isSaving) setIsPaymentModalOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;

    const nextErrors: FormErrors = {};
    const trimmedDescription = description.trim();
    const amountCents = amountToCents(amount);
    if (!trimmedDescription) nextErrors.description = 'Ingresa el concepto del consumo.';
    if (amountCents === null || amountCents < 1) nextErrors.amount = 'Ingresa un monto mayor a 0.';
    setFormErrors(nextErrors);
    setSaveError(null);
    if (Object.keys(nextErrors).length > 0 || amountCents === null) return;

    setIsSaving(true);
    try {
      const charge = await guestAccountService.createCharge({
        booking_id: account.bookingId,
        description: trimmedDescription,
        quantity: 1,
        unit_price_cents: amountCents,
        currency: account.currency,
      });
      await loadFinancials(account.bookingId);
      setFeedback(`Consumo de ${formatCurrency(charge.amountCents, charge.currency)} agregado.`);
      setIsModalOpen(false);
    } catch (cause: unknown) {
      setSaveError(cause instanceof Error ? cause.message : 'No fue posible registrar el consumo.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;

    const nextErrors: FormErrors = {};
    const amountCents = amountToCents(paymentAmount);
    if (amountCents === null || amountCents < 1) nextErrors.amount = 'Ingresa un monto mayor a 0.';
    setFormErrors(nextErrors);
    setSaveError(null);
    if (Object.keys(nextErrors).length > 0 || amountCents === null) return;

    setIsSaving(true);
    try {
      const payment = await guestAccountService.createPayment({
        booking_id: account.bookingId,
        amount_cents: amountCents,
        currency: account.currency,
        method: 'cash',
        transaction_reference: paymentReference.trim() || undefined,
      });
      await loadFinancials(account.bookingId);
      setFeedback(`Pago de ${formatCurrency(payment.amountCents, payment.currency)} aplicado.`);
      setIsPaymentModalOpen(false);
    } catch (cause: unknown) {
      setSaveError(cause instanceof Error ? cause.message : 'No fue posible registrar el pago.');
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="content">
        <LoadingState label="Cargando la cuenta de la estadía…" />
      </section>
    );
  }

  if (error || !account) {
    return (
      <section className="content">
        <ErrorState
          title="No pudimos cargar la cuenta"
          description={error ?? 'La cuenta no está disponible.'}
          onRetry={loadAccount}
        />
      </section>
    );
  }

  const guestName = guest ? `${guest.firstName} ${guest.lastName}` : booking?.guestId;

  return (
    <section className="content">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">Front desk · Cuenta de estadía</span>
          <h1>Cuenta del huésped</h1>
          <p className="muted">
            {guestName ? `${guestName} · ` : ''}Reserva {account.bookingId}
          </p>
        </div>
        <div className="welcome-actions">
          <button
            className="button secondary"
            type="button"
            onClick={() =>
              navigate(routePaths.pms.checkOut.replace(':bookingId', account.bookingId))
            }
          >
            Ir a check-out
          </button>
          <button
            className="button primary"
            type="button"
            onClick={openChargeModal}
            disabled={account.status !== 'open'}
          >
            Registrar consumo
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={openPaymentModal}
            disabled={account.status !== 'open'}
          >
            Registrar pago
          </button>
        </div>
      </div>

      {feedback && (
        <p className="status-pill success" role="status">
          {feedback}
        </p>
      )}

      <div className="metric-grid">
        {guestName && (
          <article className="metric-card">
            <div>
              <p>Huésped</p>
              <h2>{guestName}</h2>
              {guest && <span>Referencia {guest.id}</span>}
            </div>
          </article>
        )}
        <article className="metric-card">
          <div>
            <p>Saldo actual</p>
            <h2>{formatCurrency(account.balanceCents, account.currency)}</h2>
            <span>Cuenta {account.status === 'open' ? 'abierta' : 'cerrada'}</span>
          </div>
        </article>
        <article className="metric-card">
          <div>
            <p>Cargos registrados</p>
            <h2>{charges.length}</h2>
            <span>Desde {formatDate(account.openedAt)}</span>
          </div>
        </article>
        <article className="metric-card">
          <div>
            <p>Créditos aplicados</p>
            <h2>
              {formatCurrency(
                payments.reduce((total, payment) => total + payment.amountCents, 0) +
                  deposits
                    .filter((deposit) => deposit.status !== 'refunded')
                    .reduce((total, deposit) => total + deposit.amountCents, 0),
                account.currency,
              )}
            </h2>
            <span>
              {payments.length} pago(s) · {deposits.length} depósito(s)
            </span>
          </div>
        </article>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Desglose de cargos</h3>
            <p>Consumos y servicios aplicados a esta estadía.</p>
          </div>
        </div>
        <DataTable
          columns={chargeColumns}
          data={charges}
          getRowId={(charge) => charge.id}
          caption="Cargos de la estadía"
          emptyMessage="Todavía no hay cargos registrados para esta estadía."
        />
      </div>

      <Modal open={isModalOpen} onClose={closeChargeModal} title="Registrar consumo">
        <form onSubmit={handleSubmit} noValidate>
          <Input
            label="Concepto del consumo"
            placeholder="Ej. Minibar, restaurante o spa"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            error={formErrors.description}
            required
            autoFocus
            disabled={isSaving}
          />
          <Input
            label="Monto (GTQ)"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={formErrors.amount}
            required
            disabled={isSaving}
          />
          {saveError && (
            <div className="ui-state ui-state--error" role="alert">
              <p className="ui-state__description">{saveError}</p>
            </div>
          )}
          <div className="modal-foot">
            <button
              className="button secondary"
              type="button"
              onClick={closeChargeModal}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button className="button primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando…' : 'Agregar a la cuenta'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={isPaymentModalOpen} onClose={closePaymentModal} title="Registrar pago">
        <form onSubmit={handlePaymentSubmit} noValidate>
          <Input
            label="Monto (GTQ)"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(event.target.value)}
            error={formErrors.amount}
            required
            autoFocus
            disabled={isSaving}
          />
          <Input
            label="Referencia"
            placeholder="Ej. recibo, autorización o nota de caja"
            value={paymentReference}
            onChange={(event) => setPaymentReference(event.target.value)}
            disabled={isSaving}
          />
          {saveError && (
            <div className="ui-state ui-state--error" role="alert">
              <p className="ui-state__description">{saveError}</p>
            </div>
          )}
          <div className="modal-foot">
            <button
              className="button secondary"
              type="button"
              onClick={closePaymentModal}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button className="button primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando…' : 'Aplicar pago'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
