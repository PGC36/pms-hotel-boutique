import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { bookingCompanionService } from '@/services/bookingCompanionService';
import { bookingService } from '@/services/bookingService';
import { guestAccountService } from '@/services/guestAccountService';
import { guestService } from '@/services/guestService';
import { roomService } from '@/services/roomService';
import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/LoadingState';
import { Select } from '@/shared/components/Select';
import { BOOKING_STATUS_TRANSITIONS } from '@/shared/constants/statuses';
import type { Booking } from '@/shared/types/entities/booking';
import type {
  BookingCompanion,
  BookingCompanionGuestType,
  UpsertBookingCompanionDto,
} from '@/shared/types/entities/booking-companion';
import type { Guest, GuestDocumentTypeDto } from '@/shared/types/entities/guest';
import type { Room } from '@/shared/types/entities/room';
import { formatDateGT } from '@/shared/utils/date';
import './front-desk.css';

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'notFound' }
  | { status: 'ready'; booking: Booking; guest?: Guest; rooms: Room[] };

type CompanionForm = {
  id?: string;
  firstName: string;
  lastName: string;
  documentType: Guest['documentType'] | '';
  documentNumber: string;
  guestType: BookingCompanionGuestType;
};

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

function companionToForm(companion: BookingCompanion): CompanionForm {
  return {
    id: companion.id,
    firstName: companion.firstName,
    lastName: companion.lastName,
    documentType: companion.documentType,
    documentNumber: companion.documentNumber,
    guestType: companion.guestType,
  };
}

function emptyCompanion(guestType: BookingCompanionGuestType = 'adult'): CompanionForm {
  return {
    firstName: '',
    lastName: '',
    documentType: '',
    documentNumber: '',
    guestType,
  };
}

function toGuestDocumentTypeDto(
  value: Guest['documentType'] | '',
): GuestDocumentTypeDto | undefined {
  return value === 'nationalId'
    ? 'national_id'
    : value === 'driverLicense'
      ? 'driver_license'
      : value || undefined;
}

function toCompanionDto(companion: CompanionForm): UpsertBookingCompanionDto {
  const documentType = toGuestDocumentTypeDto(companion.documentType);
  if (!documentType) throw new Error('Selecciona el tipo de documento de cada acompanante.');
  return {
    id: companion.id,
    first_name: companion.firstName,
    last_name: companion.lastName,
    document_type: documentType,
    document_number: companion.documentNumber,
    guest_type: companion.guestType,
  };
}

export function CheckInScreen() {
  const navigate = useNavigate();
  const { bookingId } = useParams<'bookingId'>();

  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [documentType, setDocumentType] = useState<Guest['documentType'] | ''>('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [companions, setCompanions] = useState<CompanionForm[]>([]);
  const [assigningRoom, setAssigningRoom] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [roomAssignedMessage, setRoomAssignedMessage] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setScreen({ status: 'notFound' });
      return;
    }

    setScreen({ status: 'loading' });
    setActionError(null);
    setRoomAssignedMessage(null);

    try {
      const booking = await bookingService.getBookingById(bookingId);
      if (!booking) {
        setScreen({ status: 'notFound' });
        return;
      }

      const [guest, rooms, bookingCompanions] = await Promise.all([
        guestService.getGuestById(booking.guestId),
        roomService.getRooms(),
        bookingCompanionService.getCompanionsByBookingId(booking.id),
      ]);

      setScreen({ status: 'ready', booking, guest, rooms });
      setSelectedRoomId(booking.roomId ?? '');
      setDocumentType(guest?.documentType ?? '');
      setDocumentNumber(guest?.documentNumber ?? '');
      setCompanions(bookingCompanions.map(companionToForm));
    } catch (cause) {
      setScreen({ status: 'error', message: getErrorMessage(cause) });
    }
  }, [bookingId]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  const availableRooms = useMemo(() => {
    if (screen.status !== 'ready') return [];
    return screen.rooms.filter((room) => room.isAssignable || room.id === screen.booking.roomId);
  }, [screen]);

  const companionAdults = companions.filter((companion) => companion.guestType === 'adult').length;
  const companionChildren = companions.filter(
    (companion) => companion.guestType === 'child',
  ).length;

  function getCompanionValidationMessage(booking: Booking): string | undefined {
    const expectedCompanionAdults = Math.max(booking.adults - 1, 0);
    if (companionAdults !== expectedCompanionAdults || companionChildren !== booking.children) {
      return `La reserva requiere ${expectedCompanionAdults} acompanante(s) adulto(s) y ${booking.children} menor(es).`;
    }
    if (1 + companions.length !== booking.adults + booking.children) {
      return `La reserva espera ${booking.adults + booking.children} huesped(es) en total.`;
    }
    return undefined;
  }

  function updateCompanion(index: number, next: Partial<CompanionForm>) {
    setCompanions((current) =>
      current.map((companion, itemIndex) =>
        itemIndex === index ? { ...companion, ...next } : companion,
      ),
    );
    setActionError(null);
  }

  function addCompanion() {
    if (screen.status !== 'ready') return;
    const nextGuestType =
      companionAdults < Math.max(screen.booking.adults - 1, 0) ? 'adult' : 'child';
    setCompanions((current) => [...current, emptyCompanion(nextGuestType)]);
    setActionError(null);
  }

  function removeCompanion(index: number) {
    setCompanions((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setActionError(null);
  }

  async function handleAssignRoom() {
    if (screen.status !== 'ready' || !selectedRoomId) return;

    setAssigningRoom(true);
    setActionError(null);
    setRoomAssignedMessage(null);

    try {
      await bookingService.assignRoom(screen.booking.id, selectedRoomId);
      const [booking, rooms] = await Promise.all([
        bookingService.getBookingById(screen.booking.id),
        roomService.getRooms(),
      ]);
      if (!booking) throw new Error('La reserva ya no esta disponible despues de asignar.');
      const room = screen.rooms.find((item) => item.id === selectedRoomId);
      setScreen({ ...screen, booking, rooms });
      setSelectedRoomId(booking.roomId ?? selectedRoomId);
      setRoomAssignedMessage(
        `Habitación ${room?.roomNumber ?? selectedRoomId} asignada correctamente.`,
      );
    } catch (cause) {
      setActionError(getErrorMessage(cause));
    } finally {
      setAssigningRoom(false);
    }
  }

  async function handleCheckIn() {
    if (screen.status !== 'ready') return;
    const companionValidation = getCompanionValidationMessage(screen.booking);
    if (companionValidation) {
      setActionError(companionValidation);
      return;
    }

    setCheckingIn(true);
    setActionError(null);
    setRoomAssignedMessage(null);

    try {
      const documentTypeDto = toGuestDocumentTypeDto(documentType);
      if (screen.guest && documentTypeDto) {
        await guestService.updateGuest(screen.guest.id, {
          document_type: documentTypeDto,
          document_number: documentNumber.trim() || undefined,
        });
      }
      await bookingCompanionService.saveCompanionsForBooking(
        screen.booking.id,
        companions.map(toCompanionDto),
      );
      await bookingService.checkIn(screen.booking.id);
      const [refreshedBooking, refreshedRooms] = await Promise.all([
        bookingService.getBookingById(screen.booking.id),
        roomService.getRooms(),
      ]);
      if (!refreshedBooking) {
        throw new Error('El check-in se completo, pero la reserva ya no esta disponible.');
      }
      setScreen({ ...screen, booking: refreshedBooking, rooms: refreshedRooms });
      const account = await guestAccountService.getAccountByBookingId(screen.booking.id);
      if (!account) {
        throw new Error('El check-in se completó, pero no se encontró la cuenta del huésped.');
      }
      navigate(`/pms/accounts/${account.bookingId}`);
    } catch (cause) {
      setActionError(getErrorMessage(cause));
      setCheckingIn(false);
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
        <ErrorState description={screen.message} onRetry={loadBooking} />
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

  const { booking, guest } = screen;
  const canTransitionToCheckedIn = BOOKING_STATUS_TRANSITIONS[booking.status].includes('checkedIn');
  const hasRoomAssigned = Boolean(booking.roomId);
  const companionValidation = getCompanionValidationMessage(booking);
  const canCompleteCheckIn =
    canTransitionToCheckedIn &&
    hasRoomAssigned &&
    !companionValidation &&
    !checkingIn &&
    !assigningRoom;

  return (
    <section className="content" aria-labelledby="check-in-title">
      <div className="front-desk-header">
        <div>
          <p className="eyebrow">Front Desk</p>
          <h1 id="check-in-title">Check-in del huésped</h1>
          <p className="muted">Reserva {booking.confirmationCode}</p>
        </div>
        <Badge tone={BOOKING_STATUS_TONES[booking.status]}>
          {BOOKING_STATUS_LABELS[booking.status]}
        </Badge>
      </div>

      <div className="panel front-desk-panel">
        <h2>Datos de la reserva</h2>
        <dl className="front-desk-summary">
          <div>
            <dt>Huésped</dt>
            <dd>{guest ? `${guest.firstName} ${guest.lastName}` : 'No disponible'}</dd>
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
        </dl>

        {!canTransitionToCheckedIn && (
          <p className="field-error" role="alert">
            Esta reserva está en estado "{BOOKING_STATUS_LABELS[booking.status]}" y no admite pasar
            a hospedaje activo desde aquí.
          </p>
        )}
      </div>

      <div className="panel front-desk-panel">
        <h2>Documento de identificación y acompañantes</h2>
        <div className="front-desk-form-grid">
          <Select
            label="Tipo de documento"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value as Guest['documentType'] | '')}
          >
            <option value="">Selecciona un tipo</option>
            <option value="passport">Pasaporte</option>
            <option value="nationalId">DPI / identificación nacional</option>
            <option value="driverLicense">Licencia de conducir</option>
          </Select>
          <Input
            label="Número de documento"
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
            placeholder="Ej. 1234 56789 0101"
          />
          <div className="front-desk-form-grid-full front-desk-companion-header">
            <div>
              <h3>Acompañantes</h3>
              <p>
                {companionAdults} adulto(s) y {companionChildren} menor(es)
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={addCompanion}>
              Agregar acompañante
            </Button>
          </div>
          {companionValidation && (
            <p className="field-error front-desk-form-grid-full" role="alert">
              {companionValidation}
            </p>
          )}
          {companions.map((companion, index) => (
            <div
              className="front-desk-companion-row front-desk-form-grid-full"
              key={companion.id ?? index}
            >
              <Input
                label="Nombre"
                value={companion.firstName}
                onChange={(event) => updateCompanion(index, { firstName: event.target.value })}
              />
              <Input
                label="Apellido"
                value={companion.lastName}
                onChange={(event) => updateCompanion(index, { lastName: event.target.value })}
              />
              <Select
                label="Documento"
                value={companion.documentType}
                onChange={(event) =>
                  updateCompanion(index, {
                    documentType: event.target.value as CompanionForm['documentType'],
                  })
                }
              >
                <option value="">Selecciona un tipo</option>
                <option value="passport">Pasaporte</option>
                <option value="nationalId">DPI / identificación nacional</option>
                <option value="driverLicense">Licencia de conducir</option>
              </Select>
              <Input
                label="Numero"
                value={companion.documentNumber}
                onChange={(event) => updateCompanion(index, { documentNumber: event.target.value })}
              />
              <Select
                label="Tipo"
                value={companion.guestType}
                onChange={(event) =>
                  updateCompanion(index, {
                    guestType: event.target.value as BookingCompanionGuestType,
                  })
                }
              >
                <option value="adult">Adulto</option>
                <option value="child">Menor</option>
              </Select>
              <Button type="button" variant="secondary" onClick={() => removeCompanion(index)}>
                Quitar
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel front-desk-panel">
        <h2>Habitación</h2>
        <Select
          label="Habitación disponible"
          value={selectedRoomId}
          onChange={(event) => {
            setSelectedRoomId(event.target.value);
            setRoomAssignedMessage(null);
            setActionError(null);
          }}
          disabled={assigningRoom || checkingIn}
          helpText="Solo se muestran habitaciones libres y listas para recibir al huésped."
        >
          <option value="">Selecciona una habitación</option>
          {availableRooms.map((room) => (
            <option key={room.id} value={room.id}>
              Habitación {room.roomNumber} · Piso {room.floor}
            </option>
          ))}
        </Select>

        {availableRooms.length === 0 && (
          <EmptyState
            title="No hay habitaciones disponibles"
            description="No hay habitaciones libres y limpias para asignar en este momento."
          />
        )}

        <div className="front-desk-actions">
          <Button
            type="button"
            variant="secondary"
            loading={assigningRoom}
            disabled={
              !selectedRoomId || selectedRoomId === booking.roomId || assigningRoom || checkingIn
            }
            onClick={handleAssignRoom}
          >
            Asignar habitación
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={checkingIn}
            disabled={!canCompleteCheckIn}
            onClick={handleCheckIn}
          >
            Completar check-in
          </Button>
        </div>

        <div aria-live="polite" className="front-desk-feedback">
          {roomAssignedMessage && <p className="front-desk-success">{roomAssignedMessage}</p>}
          {actionError && (
            <p className="field-error" role="alert">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
