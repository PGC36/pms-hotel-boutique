import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';

import {
  conciergeCatalogService,
  type ConciergeServiceOption,
} from '@/services/conciergeCatalogService';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { catalogNameError } from '@/shared/utils/catalogName';
import { PaginatedList } from '@/shared/components/PaginatedList';

export function ConciergeCatalogPanel({ onAction }: { onAction: (message: string) => void }) {
  const [services, setServices] = useState<ConciergeServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ConciergeServiceOption | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ConciergeServiceOption | null>(null);
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const formOpenRef = useRef(formOpen);

  useEffect(() => {
    formOpenRef.current = formOpen;
  }, [formOpen]);

  const load = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setError('');
    try {
      setServices(await conciergeCatalogService.getServices());
      hasLoadedRef.current = true;
    } catch (cause) {
      if (!hasLoadedRef.current) {
        setError(cause instanceof Error ? cause.message : 'No fue posible cargar el catálogo.');
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    let active = true;
    const refreshSilently = () => {
      if (
        !active || formOpenRef.current || document.visibilityState !== 'visible' ||
        document.querySelector('.modal-backdrop') ||
        (document.activeElement instanceof HTMLElement &&
          document.activeElement.matches('input, textarea, select, [contenteditable="true"]'))
      ) return;
      void load();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSilently();
    };
    const intervalId = window.setInterval(refreshSilently, 20_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const startEdit = (service?: ConciergeServiceOption) => {
    setFormOpen(true);
    setEditing(service ?? null);
    setName(service?.name ?? '');
    setDescription(service?.description ?? '');
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const nameError = catalogNameError(name);
    if (nameError) {
      onAction(nameError);
      return;
    }
    setSaving(true);
    try {
      const saved = await conciergeCatalogService.saveService(
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
      onAction(editing ? 'Servicio actualizado' : 'Servicio agregado al catálogo');
    } catch (cause) {
      onAction(cause instanceof Error ? cause.message : 'No fue posible guardar el servicio.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (service: ConciergeServiceOption) => {
    try {
      const updated = await conciergeCatalogService.saveService(
        { name: service.name, description: service.description, active: !service.active },
        service.id,
      );
      setServices((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      onAction(updated.active ? 'Servicio disponible para huéspedes' : 'Servicio desactivado');
    } catch (cause) {
      onAction(cause instanceof Error ? cause.message : 'No fue posible actualizar el servicio.');
    }
  };

  const remove = async (service: ConciergeServiceOption) => {
    setDeletingId(service.id);
    try {
      await conciergeCatalogService.deleteService(service.id);
      setServices((current) => current.filter((item) => item.id !== service.id));
      setPendingDelete(null);
      onAction('Servicio eliminado del catálogo; se conserva en el historial.');
    } catch (cause) {
      onAction(cause instanceof Error ? cause.message : 'No fue posible eliminar el servicio.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h3>Catálogo de Conserjería</h3>
          <p>Define qué servicios pueden solicitar los huéspedes.</p>
        </div>
        <button className="button primary" onClick={() => startEdit()}>
          <Plus size={16} /> Agregar servicio
        </button>
      </div>
      {formOpen && (
        <form className="adm-concierge-form" onSubmit={save}>
          <label>
            Nombre
            <input
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                event.currentTarget.setCustomValidity('');
              }}
              onBlur={(event) =>
                event.currentTarget.setCustomValidity(catalogNameError(event.target.value) ?? '')
              }
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
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar servicio'}
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <LoadingState label="Cargando servicios..." />
      ) : error ? (
        <ErrorState title="No se pudo cargar el catálogo" description={error} onRetry={load} />
      ) : services.length === 0 ? (
        <div className="hk-empty">
          <p>No hay servicios configurados</p>
        </div>
      ) : (
        <PaginatedList
          items={services}
          getKey={(service) => service.id}
          listClassName="adm-concierge-list"
          label="Paginación del catálogo de conserjería"
          renderItem={(service) => (
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
                  type="button"
                >
                  {service.active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  className="icon-btn danger"
                  aria-label={`Eliminar ${service.name}`}
                  title="Eliminar del catálogo"
                  type="button"
                  disabled={deletingId === service.id}
                  onClick={() => setPendingDelete(service)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )}
        />
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar servicio de conserjería"
        description={`¿Seguro que quieres eliminar “${pendingDelete?.name ?? ''}” del catálogo? Se conservará en el historial.`}
        pending={pendingDelete !== null && deletingId === pendingDelete.id}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void remove(pendingDelete);
        }}
      />
    </div>
  );
}
