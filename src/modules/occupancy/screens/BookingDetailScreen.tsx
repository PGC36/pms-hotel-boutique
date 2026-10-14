import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { bookingService } from '@/services/bookingService';
import { guestService } from '@/services/guestService';
import { roomService } from '@/services/roomService';
import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/LoadingState';
import { Modal } from '@/shared/components/Modal';
import { Select } from '@/shared/components/Select';
import { BOOKING_STATUS_TRANSITIONS } from '@/shared/constants/statuses';
import type { Booking } from '@/shared/types/entities/booking';
import type { Guest } from '@/shared/types/entities/guest';
import type { Room } from '@/shared/types/entities/room';
import type { RoomType } from '@/shared/types/entities/room-type';
import { formatCurrency } from '@/shared/utils/currency';
import { formatDateGT } from '@/shared/utils/date';
import { validateBookingCapacity } from '@/shared/utils/bookingCapacity';
import './occupancy.css';

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'notFound' }
  | {
      status: 'ready';
      booking: Booking;
      guest?: Guest;
      room?: Room;
      roomTypes: RoomType[];
    };

type FormState = {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: string;
  children: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const BOOKING_STATUS_LABELS: Record<Booking['status'], string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  checkedIn: 'Hospedaje activo',
  checkedOut: 'Check-out realizado',
  cancelled: 'Cancelada',
  noShow: 'No-show',
};

const BOOKING_STATUS_TONES: Record<Booking['status'], BadgeTone> = {
  pending: 'warning',
  confirmed: 'info',
  checkedIn: 'success',
  checkedOut: 'neutral',
  cancelled: 'danger',
  noShow: 'danger',
};

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Error inesperado.';
}

function toCalendarTime(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function toDateInputValue(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validateForm(form: FormState, roomTypes: RoomType[]): FormErrors {
  const errors: FormErrors = {};
  const selectedRoomType = roomTypes.find((roomType) => roomType.id === form.roomTypeId);
  if (!form.roomTypeId) errors.roomTypeId = 'Selecciona un tipo de habitación.';
  if (!form.checkIn) errors.checkIn = 'Ingresa la fecha de entrada.';
  if (!form.checkOut) errors.checkOut = 'Ingresa la fecha de salida.';
  if (
    form.checkIn &&
    form.checkOut &&
    toCalendarTime(form.checkOut) <= toCalendarTime(form.checkIn)
  ) {
    errors.checkOut = 'La salida debe ser posterior a la entrada.';
  }
  if (!Number.isInteger(Number(form.adults)) || Number(form.adults) < 1) {
    errors.adults = 'Ingresa al menos un adulto.';
  }
  if (!Number.isInteger(Number(form.children)) || Number(form.children) < 0) {
    errors.children = 'Ingresa cero o más menores.';
  }
  const capacityError = selectedRoomType
    ? validateBookingCapacity({
        adults: Number(form.adults),
        children: Number(form.children),
        capacity: selectedRoomType.capacity,
        roomTypeName: selectedRoomType.name,
      })
    : undefined;
  if (!errors.adults && !errors.children && capacityError) errors.children = capacityError;
  return errors;
}

export function BookingDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingId } = useParams<'bookingId'>();

  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });
  const [isEditing, setIsEditing] = useState(() => location.pathname.endsWith('/edit'));
  const [form, setForm] = useState<FormState>({
    roomTypeId: '',
    checkIn: '',
    checkOut: '',
    adults: '1',
    children: '0',
    notes: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadData = useCallback(async () => {
    if (!bookingId) {
      setScreen({ status: 'notFound' });
      return;
    }

    setScreen({ status: 'loading' });
    try {
      const booking = await bookingService.getBookingById(bookingId);
      if (!booking) {
        setScreen({ status: 'notFound' });
        return;
      }

      const [guest, room, roomTypes] = await Promise.all([
        guestService.getGuestById(booking.guestId),
        booking.roomId ? roomService.getRoomById(booking.roomId) : Promise.resolve(undefined),
        roomService.getRoomTypes(),
      ]);

      setScreen({
        status: 'ready',
        booking,
        guest,
        room,
        roomTypes: roomTypes.filter((rt) => rt.active),
      });
      setForm({
        roomTypeId: booking.roomTypeId,
        checkIn: toDateInputValue(booking.checkIn),
        checkOut: toDateInputValue(booking.checkOut),
        adults: String(booking.adults),
        children: String(booking.children),
        notes: booking.notes ?? '',
      });
    } catch (cause) {
      setScreen({ status: 'error', message: getErrorMessage(cause) });
    }
  }, [bookingId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setIsEditing(location.pathname.endsWith('/edit'));
  }, [location.pathname]);

  const canEdit = useMemo(() => {
    if (screen.status !== 'ready') return false;
    return screen.booking.status === 'pending' || screen.booking.status === 'confirmed';
  }, [screen]);

  const canConfirm = useMemo(() => {
    if (screen.status !== 'ready') return false;
    return BOOKING_STATUS_TRANSITIONS[screen.booking.status].includes('confirmed');
  }, [screen]);

  const canCancel = useMemo(() => {
    if (screen.status !== 'ready') return false;
    return BOOKING_STATUS_TRANSITIONS[screen.booking.status].includes('cancelled');
  }, [screen]);
  const selectedRoomType =
    screen.status === 'ready'
      ? screen.roomTypes.find((roomType) => roomType.id === form.roomTypeId)
      : undefined;
  const liveCapacityError = selectedRoomType
    ? validateBookingCapacity({
        adults: Number(form.adults),
        children: Number(form.children),
        capacity: selectedRoomType.capacity,
        roomTypeName: selectedRoomType.name,
      })
    : undefined;

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError(null);
  }

  function startEditing() {
    setTransitionError(null);
    setIsEditing(true);
    navigate(routePaths.pms.bookingEdit.replace(':bookingId', bookingId ?? ''), {
      replace: true,
    });
  }

  function stopEditing() {
    setIsEditing(false);
    navigate(routePaths.pms.bookingDetail.replace(':bookingId', bookingId ?? ''), {
      replace: true,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (screen.status !== 'ready') return;
    const nextErrors = validateForm(form, screen.roomTypes);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await bookingService.updateBooking(screen.booking.id, {
        room_type_id: form.roomTypeId,
        check_in: form.checkIn,
        check_out: form.checkOut,
        adults: Number(form.adults),
        children: Number(form.children),
        notes: form.notes || undefined,
      });
      setIsEditing(false);
      navigate(routePaths.pms.bookingDetail.replace(':bookingId', screen.booking.id), {
        replace: true,
      });
      await loadData();
    } catch (cause) {
      setSubmitError(getErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (screen.status !== 'ready' || !canConfirm) return;
    setConfirming(true);
    setTransitionError(null);
    try {
      await bookingService.confirmBooking(screen.booking.id);
      await loadData();
    } catch (cause) {
      setTransitionError(getErrorMessage(cause));
    } finally {
      setConfirming(false);
    }
  }

  function openCancelModal() {
    setCancelReason('');
    setTransitionError(null);
    setIsCancelOpen(true);
  }

  function closeCancelModal() {
    if (!cancelling) setIsCancelOpen(false);
  }

  async function handleCancel() {
    if (screen.status !== 'ready' || !canCancel) return;
    if (!cancelReason.trim()) return;

    setCancelling(true);
    setTransitionError(null);
    try {
      await bookingService.cancelBooking(screen.booking.id, cancelReason.trim());
      setIsCancelOpen(false);
      await loadData();
    } catch (cause) {
      setTransitionError(getErrorMessage(cause));
    } finally {
      setCancelling(false);
    }
  }

  if (screen.status === 'loading') {
    return (
      <section className="content">
        <LoadingState label="Cargando reserva..." />
      </section>
    );
  }

  if (screen.status === 'error') {
    return (
      <section className="content">
        <ErrorState
          title="No pudimos cargar la reserva"
          description={screen.message}
          onRetry={loadData}
        />
      </section>
    );
  }

  if (screen.status === 'notFound') {
    return (
      <section className="content">
        <EmptyState
          title="Reserva no encontrada"
          description={
            bookingId
              ? `No existe una reserva con el identificador ${bookingId}.`
              : 'No se recibió un identificador de reserva en la ruta.'
          }
        />
      </section>
    );
  }

  const { booking, guest, room } = screen;

  return (
    <section className="content" aria-labelledby="booking-detail-title">
      <div className="occupancy-header">
        <div>
          <h1 id="booking-detail-title">Reserva {booking.confirmationCode}</h1>
          <p className="occupancy-muted">
            {guest ? `${guest.firstName} ${guest.lastName}` : booking.guestId}
          </p>
        </div>
        <Badge tone={BOOKING_STATUS_TONES[booking.status]}>
          {BOOKING_STATUS_LABELS[booking.status]}
        </Badge>
      </div>

      {!isEditing && (
        <section className="occupancy-panel" aria-labelledby="booking-detail-summary-title">
          <h2 id="booking-detail-summary-title">Datos de la reserva</h2>
          <dl className="occupancy-detail">
            <div>
              <dt>Tipo de habitación</dt>
              <dd>
                {screen.roomTypes.find((rt) => rt.id === booking.roomTypeId)?.name ??
                  booking.roomTypeId}
              </dd>
            </div>
            <div>
              <dt>Habitación asignada</dt>
              <dd>{room ? room.roomNumber : 'Sin asignar'}</dd>
            </div>
            <div>
              <dt>Entrada</dt>
              <dd>{formatDateGT(booking.checkIn)}</dd>
            </div>
            <div>
              <dt>Salida</dt>
              <dd>{formatDateGT(booking.checkOut)}</dd>
            </div>
            <div>
              <dt>Huéspedes</dt>
              <dd>
                {booking.adults} adultos · {booking.children} menores
              </dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatCurrency(booking.totalAmountCents, booking.currency)}</dd>
            </div>
            {booking.notes && (
              <div className="occupancy-detail-full">
                <dt>Notas</dt>
                <dd>{booking.notes}</dd>
              </div>
            )}
          </dl>

          {transitionError && (
            <p className="occupancy-error" role="alert">
              {transitionError}
            </p>
          )}

          <div className="occupancy-actions">
            {canCancel && (
              <Button type="button" variant="danger" onClick={openCancelModal}>
                Cancelar reserva
              </Button>
            )}
            {canEdit && (
              <Button type="button" variant="secondary" onClick={startEditing}>
                Editar
              </Button>
            )}
            {canConfirm && (
              <Button type="button" loading={confirming} onClick={handleConfirm}>
                Confirmar reserva
              </Button>
            )}
          </div>
        </section>
      )}

      {isEditing && canEdit && (
        <form className="occupancy-form" onSubmit={handleSubmit} noValidate>
          <Select
            label="Tipo de habitación"
            required
            value={form.roomTypeId}
            error={errors.roomTypeId}
            onChange={(event) => updateField('roomTypeId', event.target.value)}
          >
            <option value="">Seleccionar tipo</option>
            {screen.roomTypes.map((roomType) => (
              <option key={roomType.id} value={roomType.id}>
                {roomType.name} · {roomType.bedConfiguration}
              </option>
            ))}
          </Select>

          <Input
            label="Entrada"
            type="date"
            required
            value={form.checkIn}
            error={errors.checkIn}
            onChange={(event) => updateField('checkIn', event.target.value)}
          />

          <Input
            label="Salida"
            type="date"
            required
            value={form.checkOut}
            error={errors.checkOut}
            onChange={(event) => updateField('checkOut', event.target.value)}
          />

          <Input
            label="Adultos"
            type="number"
            min="1"
            required
            value={form.adults}
            error={errors.adults}
            onChange={(event) => updateField('adults', event.target.value)}
          />

          <Input
            label="Menores"
            type="number"
            min="0"
            required
            value={form.children}
            error={errors.children ?? liveCapacityError}
            onChange={(event) => updateField('children', event.target.value)}
          />

          <Input
            label="Notas"
            className="occupancy-form-full"
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
          />

          {submitError && <p className="occupancy-error">{submitError}</p>}

          <div className="occupancy-actions">
            <Button type="button" variant="secondary" onClick={stopEditing}>
              Cancelar edición
            </Button>
            <Button type="submit" loading={submitting}>
              Guardar cambios
            </Button>
          </div>
        </form>
      )}

      <Modal open={isCancelOpen} onClose={closeCancelModal} title="Cancelar reserva">
        <p>
          Vas a cancelar la reserva {booking.confirmationCode}. Esta acción no se puede deshacer.
        </p>
        <Input
          label="Motivo de la cancelación"
          required
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          error={!cancelReason.trim() && cancelReason.length > 0 ? 'Ingresa un motivo.' : undefined}
          disabled={cancelling}
          autoFocus
        />
        {transitionError && (
          <p className="occupancy-error" role="alert">
            {transitionError}
          </p>
        )}
        <div className="occupancy-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={closeCancelModal}
            disabled={cancelling}
          >
            Volver
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={cancelling}
            disabled={!cancelReason.trim()}
            onClick={handleCancel}
          >
            Confirmar cancelación
          </Button>
        </div>
      </Modal>
    </section>
  );
}
