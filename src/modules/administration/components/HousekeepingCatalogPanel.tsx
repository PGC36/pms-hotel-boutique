import { useEffect, useState, type FormEvent } from 'react';
import { Edit2, Plus, X } from 'lucide-react';

import {
  housekeepingCatalogService,
  type HousekeepingServiceOption,
} from '@/services/housekeepingCatalogService';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';

export function HousekeepingCatalogPanel({ onAction }: { onAction: (message: string) => void }) {
  const [services, setServices] = useState<HousekeepingServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<HousekeepingServiceOption | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setServices(await housekeepingCatalogService.getServices());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startEdit = (service?: HousekeepingServiceOption) => {
    setFormOpen(true);
    setEditing(service ?? null);
    setName(service?.name ?? '');
    setDescription(service?.description ?? '');
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await housekeepingCatalogService.saveService(
        { name: name.trim(), description: description.trim(), active: editing?.active ?? true },
        editing?.id,
      );
      setServices((current) =>
        editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setFormOpen(false);
      setEditing(null);
      setName('');
      setDescription('');
      onAction(
        editing ? 'Opción de limpieza actualizada' : 'Opción agregada al catálogo de limpieza',
      );
    } catch (cause) {
      onAction(cause instanceof Error ? cause.message : 'No fue posible guardar la opción.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (service: HousekeepingServiceOption) => {
    try {
      const updated = await housekeepingCatalogService.saveService(
        { name: service.name, description: service.description, active: !service.active },
        service.id,
      );
      setServices((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      onAction(updated.active ? 'Opción disponible para huéspedes' : 'Opción desactivada');
    } catch (cause) {
      onAction(cause instanceof Error ? cause.message : 'No fue posible actualizar la opción.');
    }
  };

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h3>Catálogo de Limpieza</h3>
          <p>Define qué tipos de limpieza pueden solicitar los huéspedes.</p>
        </div>
        <button className="button primary" onClick={() => startEdit()}>
          <Plus size={16} /> Agregar opción
        </button>
      </div>
      {formOpen && (
        <form className="adm-concierge-form" onSubmit={save}>
          <label>
            Nombre
            <input
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Descripción
            <input
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="adm-actions">
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
                setName('');
                setDescription('');
              }}
            >
              <X size={15} /> Cancelar
            </button>
            <button className="button primary" type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar opción'}
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <LoadingState label="Cargando opciones..." />
      ) : error ? (
        <ErrorState title="No se pudo cargar el catálogo" description={error} onRetry={load} />
      ) : services.length === 0 ? (
        <div className="hk-empty">
          <p>No hay opciones configuradas</p>
        </div>
      ) : (
        <div className="adm-concierge-list">
          {services.map((service) => (
            <div className="adm-concierge-row" key={service.id}>
              <div>
                <strong>{service.name}</strong>
                <span>{service.description || 'Sin descripción'}</span>
              </div>
              <span className={`status-pill ${service.active ? 'success' : 'warning'}`}>
                {service.active ? 'Activo' : 'Inactivo'}
              </span>
              <div className="adm-actions">
                <button
                  className="icon-btn"
                  aria-label={`Editar ${service.name}`}
                  onClick={() => startEdit(service)}
                >
                  <Edit2 size={15} />
                </button>
                <button
                  className={`button small ${service.active ? 'secondary' : 'primary'}`}
                  onClick={() => void toggle(service)}
                >
                  {service.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
