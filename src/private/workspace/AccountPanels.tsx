import { useState } from 'react';
import {
  Bell,
  CalendarDays,
  Check,
  Clock,
  ImagePlus,
  Phone,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';

type AccountPanelBaseProps = {
  name: string;
  roleLabel: string;
  initials: string;
  tone?: string;
  onClose: () => void;
  onSave: (message: string) => void;
};

type AccountProfileModalProps = AccountPanelBaseProps & {
  email: string;
};

type AccountPreferencesModalProps = AccountPanelBaseProps & {
  initialView?: string;
  viewOptions?: string[];
};

export function AccountProfileModal({
  name,
  roleLabel,
  initials,
  tone = 'gold',
  email: sessionEmail,
  onClose,
  onSave,
}: AccountProfileModalProps) {
  const [displayName, setDisplayName] = useState(name);
  const [email, setEmail] = useState(sessionEmail);
  const [phone, setPhone] = useState('+502 5555 0101');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const changePhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
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
              onChange={(event) => changePhoto(event.target.files?.[0])}
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
            />
          </label>
          <label className="hk-form-label">
            Correo
            <input
              className="hk-form-select"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="hk-form-label">
            Teléfono
            <input
              className="hk-form-select"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
        </div>

        <div className="account-info-grid">
          <span>
            <Phone size={14} /> {phone}
          </span>
          <span>
            <ShieldCheck size={14} /> Acceso protegido por rol
          </span>
        </div>

        <div className="modal-foot">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            type="button"
            onClick={() => {
              onSave('Perfil actualizado');
              onClose();
            }}
          >
            Guardar perfil <Check size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountPreferencesModal({
  initialView = 'Panel operativo',
  viewOptions = ['Panel operativo'],
  onClose,
  onSave,
}: AccountPreferencesModalProps) {
  const availableViews = Array.from(new Set([...viewOptions, initialView].filter(Boolean)));
  const [defaultView, setDefaultView] = useState(initialView);
  const [dateFormat, setDateFormat] = useState('dd-mm-aaaa');
  const [density, setDensity] = useState('Comoda');
  const [notifyArrivals, setNotifyArrivals] = useState(true);
  const [notifyHousekeeping, setNotifyHousekeeping] = useState(true);
  const [notifyCash, setNotifyCash] = useState(false);

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
              value={defaultView}
              onChange={(event) => setDefaultView(event.target.value)}
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
              value={dateFormat}
              onChange={(event) => setDateFormat(event.target.value)}
            >
              <option>dd-mm-aaaa</option>
              <option>aaaa-mm-dd</option>
              <option>dd/mmm/aaaa</option>
            </select>
          </label>
          <label className="hk-form-label">
            Densidad de pantalla
            <select
              className="hk-form-select"
              value={density}
              onChange={(event) => setDensity(event.target.value)}
            >
              <option>Comoda</option>
              <option>Compacta</option>
              <option>Amplia</option>
            </select>
          </label>
        </div>

        <div className="account-toggle-list">
          <button
            type="button"
            className={notifyArrivals ? 'account-toggle on' : 'account-toggle'}
            onClick={() => setNotifyArrivals((value) => !value)}
          >
            <span>
              <CalendarDays size={16} /> Llegadas y salidas del día
            </span>
            <i />
          </button>
          <button
            type="button"
            className={notifyHousekeeping ? 'account-toggle on' : 'account-toggle'}
            onClick={() => setNotifyHousekeeping((value) => !value)}
          >
            <span>
              <Bell size={16} /> Alertas de limpieza y habitaciones
            </span>
            <i />
          </button>
          <button
            type="button"
            className={notifyCash ? 'account-toggle on' : 'account-toggle'}
            onClick={() => setNotifyCash((value) => !value)}
          >
            <span>
              <Clock size={16} /> Recordatorios de caja y cierres
            </span>
            <i />
          </button>
        </div>

        <div className="account-preference-note">
          <Settings size={16} />
          <p>
            Estas preferencias afectan solo tu sesión en el PMS. No cambian reglas del hotel ni
            permisos de acceso.
          </p>
        </div>

        <div className="modal-foot">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            type="button"
            onClick={() => {
              onSave('Preferencias actualizadas');
              onClose();
            }}
          >
            Guardar preferencias <Check size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
