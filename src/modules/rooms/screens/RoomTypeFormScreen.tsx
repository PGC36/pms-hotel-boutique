import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routePaths } from '@/app/routes';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { ImageGalleryField } from '@/shared/components/ImageGalleryField';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/LoadingState';
import { Select } from '@/shared/components/Select';
import { roomService } from '@/services/roomService';
import type { RoomFeature } from '@/shared/types/entities/room-feature';
import {
  discardPendingUploads,
  galleryFromImages,
  getGallerySaveBlocker,
  toImageAssignments,
  type GalleryItem,
} from '@/shared/utils/mediaGallery';
import './rooms.css';

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'notFound' }
  | { status: 'ready'; roomFeatures: RoomFeature[] };

type FormState = {
  code: string;
  name: string;
  description: string;
  capacity: string;
  bedConfiguration: string;
  roomFeatureIds: string[];
  active: 'true' | 'false';
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const initialForm: FormState = {
  code: '',
  name: '',
  description: '',
  capacity: '',
  bedConfiguration: '',
  roomFeatureIds: [],
  active: 'true',
};

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Error inesperado.';
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.code.trim()) errors.code = 'Ingresa el código del tipo de habitación.';
  if (!form.name.trim()) errors.name = 'Ingresa el nombre del tipo de habitación.';
  if (!form.bedConfiguration.trim()) {
    errors.bedConfiguration = 'Describe la configuración de camas.';
  }
  if (
    !form.capacity.trim() ||
    !Number.isInteger(Number(form.capacity)) ||
    Number(form.capacity) < 1
  ) {
    errors.capacity = 'Ingresa una capacidad válida (entero, 1 o mayor).';
  }
  return errors;
}

export function RoomTypeFormScreen() {
  const navigate = useNavigate();
  const { roomTypeId } = useParams<'roomTypeId'>();
  const isEditing = Boolean(roomTypeId);

  const [screen, setScreen] = useState<ScreenState>({ status: 'loading' });
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  const loadData = useCallback(async () => {
    setScreen({ status: 'loading' });
    try {
      const roomFeatures = await roomService.getRoomFeatures();

      if (roomTypeId) {
        const roomType = await roomService.getRoomTypeById(roomTypeId);
        if (!roomType) {
          setScreen({ status: 'notFound' });
          return;
        }
        setForm({
          code: roomType.code,
          name: roomType.name,
          description: roomType.description ?? '',
          capacity: String(roomType.capacity),
          bedConfiguration: roomType.bedConfiguration,
          roomFeatureIds: roomType.roomFeatureIds,
          active: roomType.active ? 'true' : 'false',
        });
        setGallery(galleryFromImages(roomType.images));
      } else {
        setForm(initialForm);
        setGallery([]);
      }

      setScreen({ status: 'ready', roomFeatures });
    } catch (cause) {
      setScreen({ status: 'error', message: getErrorMessage(cause) });
    }
  }, [roomTypeId]);

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
    const galleryBlocker = getGallerySaveBlocker(gallery);
    if (galleryBlocker) {
      setSubmitError(galleryBlocker);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        capacity: Number(form.capacity),
        bed_configuration: form.bedConfiguration.trim(),
        room_feature_ids: form.roomFeatureIds,
        active: form.active === 'true',
        images: toImageAssignments(gallery),
      };
      if (roomTypeId) {
        await roomService.updateRoomType(roomTypeId, data);
      } else {
        await roomService.createRoomType(data);
      }
      navigate(routePaths.pms.roomTypes);
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
          title="Tipo de habitación no encontrado"
          description={`No existe un tipo de habitación con el identificador ${roomTypeId}.`}
        />
      </section>
    );
  }

  return (
    <section className="content">
      <div className="rooms-header">
        <div>
          <h1>{isEditing ? 'Editar tipo de habitación' : 'Nuevo tipo de habitación'}</h1>
          <p className="rooms-muted">
            {isEditing
              ? 'Actualiza los datos del tipo de habitación.'
              : 'Registra un nuevo tipo de habitación en el catálogo.'}
          </p>
        </div>
      </div>

      <form className="rooms-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Código"
          required
          value={form.code}
          error={errors.code}
          placeholder="Ej. STD"
          onChange={(event) => updateField('code', event.target.value)}
        />

        <Input
          label="Nombre"
          required
          value={form.name}
          error={errors.name}
          onChange={(event) => updateField('name', event.target.value)}
        />

        <Input
          label="Capacidad"
          type="number"
          min="1"
          required
          value={form.capacity}
          error={errors.capacity}
          onChange={(event) => updateField('capacity', event.target.value)}
        />

        <Input
          label="Configuración de camas"
          required
          value={form.bedConfiguration}
          error={errors.bedConfiguration}
          placeholder="Ej. 1 cama queen"
          onChange={(event) => updateField('bedConfiguration', event.target.value)}
        />

        <Select
          label="Estado"
          value={form.active}
          onChange={(event) => updateField('active', event.target.value as 'true' | 'false')}
        >
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </Select>

        <Select
          label="Características"
          className="rooms-form-full"
          multiple
          size={Math.min(6, Math.max(3, screen.roomFeatures.length))}
          value={form.roomFeatureIds}
          onChange={(event) =>
            updateField(
              'roomFeatureIds',
              Array.from(event.target.selectedOptions, (option) => option.value),
            )
          }
          helpText="Mantén presionado Ctrl (Cmd en Mac) para seleccionar varias características."
        >
          {screen.roomFeatures.map((feature) => (
            <option key={feature.id} value={feature.id}>
              {feature.name}
            </option>
          ))}
        </Select>

        <Input
          label="Descripción"
          className="rooms-form-full"
          value={form.description}
          placeholder="Descripción visible para el motor de reservas"
          onChange={(event) => updateField('description', event.target.value)}
        />

        <div className="rooms-form-full">
          <ImageGalleryField
            label="Fotos del tipo de habitación"
            target="roomType"
            items={gallery}
            onChange={(next) => {
              setGallery(next);
              setSubmitError(null);
            }}
            recordName={form.name || 'el tipo de habitación'}
            disabled={submitting}
          />
        </div>

        {submitError && <p className="rooms-error">{submitError}</p>}

        <div className="rooms-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void discardPendingUploads(gallery);
              navigate(routePaths.pms.roomTypes);
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            {isEditing ? 'Guardar cambios' : 'Crear tipo de habitación'}
          </Button>
        </div>
      </form>
    </section>
  );
}
