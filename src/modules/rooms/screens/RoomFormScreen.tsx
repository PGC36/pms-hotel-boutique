import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/LoadingState';
import { Select } from '@/shared/components/Select';
import { roomService } from '@/services/roomService';
import { ROOM_HOUSEKEEPING_STATUSES, ROOM_STATUSES } from '@/shared/constants/statuses';
import type { Room, RoomStatusDto } from '@/shared/types/entities/room';
import type { RoomType } from '@/shared/types/entities/room-type';
import './rooms.css';

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'notFound' }
  | { status: 'ready'; roomTypes: RoomType[] };

type FormState = {
  roomNumber: string;
  roomTypeId: string;
  floor: string;
  status: Room['status'];
  housekeepingStatus: Room['housekeepingStatus'];
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const ROOM_STATUS_LABELS: Record<Room['status'], string> = {
  available: 'Libre',
  occupied: 'Ocupada',
  maintenance: 'Mantenimiento',
  outOfService: 'Fuera de servicio',
};

const HOUSEKEEPING_STATUS_LABELS: Record<Room['housekeepingStatus'], string> = {
  dirty: 'Sucia',
  cleaning: 'En limpieza',
  clean: 'Limpia',
  inspected: 'Inspeccionada',
};

const initialForm: FormState = {
  roomNumber: '',
  roomTypeId: '',
  floor: '',
  status: 'available',
  housekeepingStatus: 'dirty',
  notes: '',
};

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Error inesperado.';
}

function toDtoStatus(status: Room['status']): RoomStatusDto {
  return status === 'outOfService' ? 'out_of_service' : status;
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.roomNumber.trim()) errors.roomNumber = 'Ingresa el número de habitación.';
  if (!form.roomTypeId) errors.roomTypeId = 'Selecciona un tipo de habitación.';
  if (!form.floor.trim() || !Number.isInteger(Number(form.floor)) || Number(form.floor) < 0) {
    errors.floor = 'Ingresa un piso válido (entero, 0 o mayor).';
  }
  return errors;
}

export function RoomFormScreen() {
  const navigate = useNavigate();
  const { roomId } = useParams<'roomId'>();
  const isEditing = Boolean(roomId);

  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setScreen({ status: 'loading' });
    try {
      const roomTypes = await roomService.getRoomTypes();

      if (roomId) {
        const room = await roomService.getRoomById(roomId);
        if (!room) {
          setScreen({ status: 'notFound' });
          return;
        }
        setForm({
          roomNumber: room.roomNumber,
          roomTypeId: room.roomTypeId,
          floor: String(room.floor),
          status: room.status,
          housekeepingStatus: room.housekeepingStatus,
          notes: room.notes ?? '',
        });
      } else {
        setForm(initialForm);
      }

      setScreen({ status: 'ready', roomTypes: roomTypes.filter((roomType) => roomType.active) });
    } catch (cause) {
      setScreen({ status: 'error', message: getErrorMessage(cause) });
    }
  }, [roomId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = {
        room_number: form.roomNumber.trim(),
        room_type_id: form.roomTypeId,
        floor: Number(form.floor),
        status: toDtoStatus(form.status),
        housekeeping_status: form.housekeepingStatus,
        notes: form.notes.trim() || undefined,
      };
      if (roomId) {
        await roomService.updateRoom(roomId, data);
      } else {
        await roomService.createRoom(data);
      }
      navigate(routePaths.pms.rooms);
    } catch (cause) {
      setSubmitError(getErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  if (screen.status === 'loading') {
    return (
      <section className="content">
        <LoadingState label="Cargando formulario..." />
      </section>
    );
  }

  if (screen.status === 'error') {
    return (
      <section className="content">
        <ErrorState
          title="No pudimos cargar el formulario"
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
          title="Habitación no encontrada"
          description={`No existe una habitación con el identificador ${roomId}.`}
        />
      </section>
    );
  }

  return (
    <section className="content">
      <div className="rooms-header">
        <div>
          <h1>{isEditing ? 'Editar habitación' : 'Nueva habitación'}</h1>
          <p className="rooms-muted">
            {isEditing
              ? 'Actualiza los datos de la habitación.'
              : 'Registra una nueva habitación en el inventario.'}
          </p>
        </div>
      </div>

      {screen.roomTypes.length === 0 ? (
        <EmptyState
          title="No hay tipos de habitación activos"
          description="Crea al menos un tipo de habitación activo antes de registrar habitaciones."
        />
      ) : (
        <form className="rooms-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Número de habitación"
            required
            value={form.roomNumber}
            error={errors.roomNumber}
            onChange={(event) => updateField('roomNumber', event.target.value)}
          />

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
                {roomType.name}
              </option>
            ))}
          </Select>

          <Input
            label="Piso"
            type="number"
            min="0"
            required
            value={form.floor}
            error={errors.floor}
            onChange={(event) => updateField('floor', event.target.value)}
          />

          <Select
            label="Estado de ocupación"
            value={form.status}
            onChange={(event) => updateField('status', event.target.value as Room['status'])}
          >
            {ROOM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ROOM_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>

          <Select
            label="Estado de limpieza"
            value={form.housekeepingStatus}
            onChange={(event) =>
              updateField('housekeepingStatus', event.target.value as Room['housekeepingStatus'])
            }
            helpText="La limpieza la actualiza normalmente la app móvil; este valor inicial queda disponible para el alta."
          >
            {ROOM_HOUSEKEEPING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {HOUSEKEEPING_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>

          <Input
            label="Notas"
            className="rooms-form-full"
            value={form.notes}
            placeholder="Referencia interna opcional"
            onChange={(event) => updateField('notes', event.target.value)}
          />

          {submitError && <p className="rooms-error">{submitError}</p>}

          <div className="rooms-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(routePaths.pms.rooms)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              {isEditing ? 'Guardar cambios' : 'Crear habitación'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
