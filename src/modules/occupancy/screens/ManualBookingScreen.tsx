import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/LoadingState';
import { Select } from '@/shared/components/Select';
import { bookingService } from '@/services/bookingService';
import { guestService } from '@/services/guestService';
import { roomService } from '@/services/roomService';
import { toDtoCalendarDate } from '@/shared/types/common';
import type { Booking } from '@/shared/types/entities/booking';
import type { Guest } from '@/shared/types/entities/guest';
import type { Room } from '@/shared/types/entities/room';
import type { RoomType } from '@/shared/types/entities/room-type';
import { validateBookingCapacity } from '@/shared/utils/bookingCapacity';
import './occupancy.css';

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; guests: Guest[]; roomTypes: RoomType[]; rooms: Room[]; bookings: Booking[] };

type FormState = {
  guestId: string;
  roomTypeId: string;
  roomId: string;
  rateId: string;
  checkIn: string;
  checkOut: string;
  adults: string;
  children: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const initialForm: FormState = {
  guestId: '',
  roomTypeId: '',
  roomId: '',
  rateId: '',
  checkIn: '',
  checkOut: '',
  adults: '1',
  children: '0',
  notes: '',
};

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Error inesperado.';
}

function toCalendarTime(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function validateForm(form: FormState, roomTypes: RoomType[]): FormErrors {
  const errors: FormErrors = {};
  const selectedRoomType = roomTypes.find((roomType) => roomType.id === form.roomTypeId);
  if (!form.guestId) errors.guestId = 'Selecciona un huésped.';
  if (!form.roomTypeId) errors.roomTypeId = 'Selecciona un tipo de habitación.';
  if (!form.roomId) errors.roomId = 'Selecciona una habitación disponible.';
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

export function ManualBookingScreen() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setScreen({ status: 'loading' });
    try {
      const [guests, roomTypes, rooms, bookings] = await Promise.all([
        guestService.getGuests(),
        roomService.getRoomTypes(),
        roomService.getRooms(),
        bookingService.getBookings(),
      ]);
      setScreen({
        status: 'ready',
        guests,
        roomTypes: roomTypes.filter((roomType) => roomType.active),
        rooms,
        bookings,
      });
    } catch (cause) {
      setScreen({ status: 'error', message: getErrorMessage(cause) });
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasOptions = useMemo(
    () => screen.status === 'ready' && screen.guests.length > 0 && screen.roomTypes.length > 0,
    [screen],
  );
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
  const availableRooms = useMemo(() => {
    if (screen.status !== 'ready' || !form.roomTypeId || !form.checkIn || !form.checkOut) return [];
    return screen.rooms.filter((room) => {
      if (!room.isAssignable || room.roomTypeId !== form.roomTypeId) return false;
      return !screen.bookings.some(
        (booking) =>
          booking.roomId === room.id &&
          ['pending', 'confirmed', 'checkedIn'].includes(booking.status) &&
          toDtoCalendarDate(booking.checkIn) < form.checkOut &&
          toDtoCalendarDate(booking.checkOut) > form.checkIn,
      );
    });
  }, [form.checkIn, form.checkOut, form.roomTypeId, screen]);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(['roomTypeId', 'checkIn', 'checkOut'].includes(key) ? { roomId: '' } : {}),
    }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(form, screen.status === 'ready' ? screen.roomTypes : []);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await bookingService.createBooking({
        guest_id: form.guestId,
        room_type_id: form.roomTypeId,
        room_id: form.roomId,
        rate_id: form.rateId || undefined,
        check_in: form.checkIn,
        check_out: form.checkOut,
        adults: Number(form.adults),
        children: Number(form.children),
        notes: form.notes || undefined,
      });
      navigate('/pms/occupancy');
    } catch (cause) {
      setSubmitError(getErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="content">
      <div className="occupancy-header">
        <div>
          <h1>Nueva reserva manual</h1>
          <p className="occupancy-muted">Registro para reservas tomadas por recepción.</p>
        </div>
      </div>

      {screen.status === 'loading' && <LoadingState label="Cargando formulario..." />}

      {screen.status === 'error' && (
        <ErrorState
          title="No pudimos cargar el formulario"
          description={screen.message}
          onRetry={loadData}
        />
      )}

      {screen.status === 'ready' && !hasOptions && (
        <EmptyState
          title="Faltan datos para crear reservas"
          description="Debe existir al menos un huésped y un tipo de habitación activo."
        />
      )}

      {screen.status === 'ready' && hasOptions && (
        <form className="occupancy-form" onSubmit={handleSubmit} noValidate>
          <Select
            label="Huésped"
            required
            value={form.guestId}
            error={errors.guestId}
            onChange={(event) => updateField('guestId', event.target.value)}
          >
            <option value="">Seleccionar huésped</option>
            {screen.guests.map((guest) => (
              <option key={guest.id} value={guest.id}>
                {guest.firstName} {guest.lastName}
              </option>
            ))}
          </Select>

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

          <Select
            label="Habitación"
            required
            value={form.roomId}
            error={errors.roomId}
            onChange={(event) => updateField('roomId', event.target.value)}
          >
            <option value="">Seleccionar habitación</option>
            {availableRooms.map((room) => (
              <option key={room.id} value={room.id}>
                Hab. {room.roomNumber} · {room.floor}° piso
              </option>
            ))}
          </Select>
          {form.checkIn && form.checkOut && form.roomTypeId && availableRooms.length === 0 && (
            <p className="occupancy-error occupancy-form-full">
              No hay habitaciones limpias y disponibles de este tipo para esas fechas.
            </p>
          )}

          <Input
            label="Tarifa"
            value={form.rateId}
            placeholder="RATE-01"
            helpText="Opcional si recepción todavía no definió tarifa."
            onChange={(event) => updateField('rateId', event.target.value)}
          />

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
            value={form.notes}
            placeholder="Solicitud especial o referencia de recepción"
            onChange={(event) => updateField('notes', event.target.value)}
          />

          {submitError && <p className="occupancy-error">{submitError}</p>}

          <div className="occupancy-actions">
            <Button type="button" variant="secondary" onClick={() => navigate('/pms/occupancy')}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              Crear reserva
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
