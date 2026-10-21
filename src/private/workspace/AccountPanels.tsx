import { useState } from 'react';
import { Check, ImagePlus, Settings, ShieldCheck, X } from 'lucide-react';
import {
  defaultAccountPreferences,
  type AccountPreferences,
  type AccountProfile,
} from './accountSettings';

type AccountProfileModalProps = {
  name: string;
  roleLabel: string;
  initials: string;
  tone?: string;
  email: string;
  avatarDataUrl: string | null;
  onClose: () => void;
  onSave: (profile: AccountProfile) => void | Promise<void>;
};

type AccountPreferencesModalProps = {
  initialView?: string;
  viewOptions?: string[];
  initialPreferences?: AccountPreferences;
  onClose: () => void;
  onSave: (preferences: AccountPreferences) => void | Promise<void>;
};

function compressAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecciona un archivo de imagen.'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('La imagen debe pesar menos de 8 MB.'));
      return;
    }

    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      URL.revokeObjectURL(source);
      if (!context) {
        reject(new Error('No fue posible preparar la imagen.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error('No fue posible leer la imagen seleccionada.'));
    };
    image.src = source;
  });
}

export function AccountProfileModal({
  name,
  roleLabel,
  initials,
  tone = 'gold',
  email,
  avatarDataUrl,
  onClose,
  onSave,
}: AccountProfileModalProps) {
  const [displayName, setDisplayName] = useState(name);
  const [photoPreview, setPhotoPreview] = useState<string | null>(avatarDataUrl);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const changePhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      setError('');
      setPhotoPreview(await compressAvatar(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar la imagen.');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal account-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">CUENTA DEL EQUIPO</p>
            <h2>Mi perfil</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="account-profile-card">
          <label className="account-photo-control" aria-label="Cambiar foto de perfil">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                void changePhoto(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            {photoPreview ? (
              <img src={photoPreview} alt="" />
            ) : (
              <span className={`avatar ${tone}`}>{initials}</span>
            )}
            <i>
              <ImagePlus size={14} />
            </i>
          </label>
          <div>
            <strong>{displayName}</strong>
            <span>{roleLabel} · Hotel Aurora</span>
          </div>
        </div>

        <div className="account-form-grid">
          <label className="hk-form-label">
            Nombre visible
            <input
              className="hk-form-select"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
            />
          </label>
          <label className="hk-form-label">
            Correo de acceso
            <input className="hk-form-select" value={email || 'No disponible'} readOnly />
          </label>
        </div>

        <div className="account-info-grid">
          <span>
            <ShieldCheck size={14} /> Correo y teléfono requieren verificación de credenciales para
            cambiarse.
          </span>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="modal-foot">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            type="button"
            disabled={saving}
            onClick={async () => {
              if (!displayName.trim()) {
                setError('Escribe el nombre que quieres mostrar.');
                return;
              }
              setSaving(true);
              setError('');
              try {
                await onSave({ displayName: displayName.trim(), avatarDataUrl: photoPreview });
                onClose();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'No pudimos guardar tu perfil.');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Guardando…' : 'Guardar perfil'} {!saving ? <Check size={16} /> : null}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountPreferencesModal({
  initialView = 'Panel operativo',
  viewOptions = ['Panel operativo'],
  initialPreferences = defaultAccountPreferences,
  onClose,
  onSave,
}: AccountPreferencesModalProps) {
  const availableViews = Array.from(new Set([...viewOptions, initialView].filter(Boolean)));
  const [preferences, setPreferences] = useState(() => {
    return {
      ...initialPreferences,
      defaultView: availableViews.includes(initialPreferences.defaultView)
        ? initialPreferences.defaultView
        : initialView,
    };
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal account-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">CONFIGURACION PERSONAL</p>
            <h2>Preferencias</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="account-preference-list">
          <label className="hk-form-label">
            Vista inicial
            <select
              className="hk-form-select"
              value={preferences.defaultView || initialView}
              onChange={(event) =>
                setPreferences((current) => ({ ...current, defaultView: event.target.value }))
              }
            >
              {availableViews.map((view) => (
                <option key={view}>{view}</option>
              ))}
            </select>
          </label>
          <label className="hk-form-label">
            Formato de fecha
            <select
              className="hk-form-select"
              value={preferences.dateFormat}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  dateFormat: event.target.value as AccountPreferences['dateFormat'],
                }))
              }
            >
              <option value="dd-mm-yyyy">dd-mm-aaaa</option>
              <option value="yyyy-mm-dd">aaaa-mm-dd</option>
              <option value="dd/mmm/yyyy">dd/mmm/aaaa</option>
            </select>
          </label>
          <label className="hk-form-label">
            Densidad de pantalla
            <select
              className="hk-form-select"
              value={preferences.density}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  density: event.target.value as AccountPreferences['density'],
                }))
              }
            >
              <option value="comfortable">Cómoda</option>
              <option value="compact">Compacta</option>
              <option value="spacious">Amplia</option>
            </select>
          </label>
        </div>

        <div className="account-preference-note">
          <Settings size={16} />
          <p>
            Se guardan en tu cuenta y se aplican en tus dispositivos. La vista inicial se aplicará
            al volver a entrar.
          </p>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="modal-foot">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError('');
              try {
                await onSave({
                  ...preferences,
                  defaultView: preferences.defaultView || initialView,
                });
                onClose();
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : 'No pudimos guardar tus preferencias.',
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Guardando…' : 'Guardar preferencias'} {!saving ? <Check size={16} /> : null}
          </button>
        </div>
      </div>
    </div>
  );
}
