import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';

import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { PaginatedList } from '@/shared/components/PaginatedList';
import { catalogNameError } from '@/shared/utils/catalogName';

type CatalogOption = { id: string; name: string; description: string; active: boolean };
type CatalogService<T extends CatalogOption> = {
  getServices: () => Promise<T[]>;
  saveService: (
    data: { name: string; description: string; active: boolean },
    id?: string,
  ) => Promise<T>;
  deleteService: (id: string) => Promise<void>;
};

type CatalogManagementPanelProps<T extends CatalogOption> = {
  onAction: (message: string) => void;
  service: CatalogService<T>;
  title: string;
  description: string;
  addLabel: string;
  itemLabel: string;
  itemLabelPlural: string;
  emptyMessage: string;
  paginationLabel: string;
  saveMessages: { created: string; updated: string };
  deleteMessage: string;
  toggleMessages: { activated: string; deactivated: string };
  errorMessages: { save: string; update: string; delete: string };
  deleteDescription: string;
};

export function CatalogManagementPanel<T extends CatalogOption>({
  onAction,
  service,
  title,
  description,
  addLabel,
  itemLabel,
  itemLabelPlural,
  emptyMessage,
  paginationLabel,
  saveMessages,
  deleteMessage,
  toggleMessages,
  errorMessages,
  deleteDescription,
}: Readonly<CatalogManagementPanelProps<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<T | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
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
      setItems(await service.getServices());
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
    if (
      typeof document === 'undefined' ||
      typeof window === 'undefined' ||
      typeof window.setInterval !== 'function'
    )
      return () => {
        active = false;
      };
    const refreshSilently = () => {
      if (
        !active ||
        formOpenRef.current ||
        document.visibilityState !== 'visible' ||
        document.querySelector('.modal-backdrop') ||
        (document.activeElement instanceof HTMLElement &&
          document.activeElement.matches('input, textarea, select, [contenteditable="true"]'))
      )
        return;
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

  const startEdit = (item?: T) => {
    setFormOpen(true);
    setEditing(item ?? null);
    setName(item?.name ?? '');
    setItemDescription(item?.description ?? '');
  };

  const resetForm = () => {
    setFormOpen(false);
    setEditing(null);
    setName('');
    setItemDescription('');
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
      const saved = await service.saveService(
        { name: name.trim(), description: itemDescription.trim(), active: editing?.active ?? true },
        editing?.id,
      );
      setItems((current) =>
        editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
      );
      resetForm();
      onAction(editing ? saveMessages.updated : saveMessages.created);
    } catch (cause) {
      onAction(cause instanceof Error ? cause.message : errorMessages.save);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item: T) => {
    try {
      const updated = await service.saveService(
        { name: item.name, description: item.description, active: !item.active },
        item.id,
      );
      setItems((current) =>
        current.map((currentItem) => (currentItem.id === updated.id ? updated : currentItem)),
      );
      onAction(updated.active ? toggleMessages.activated : toggleMessages.deactivated);
    } catch (cause) {
      onAction(cause instanceof Error ? cause.message : errorMessages.update);
    }
  };

  const remove = async (item: T) => {
    setDeletingId(item.id);
    try {
      await service.deleteService(item.id);
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      setPendingDelete(null);
      onAction(deleteMessage);
    } catch (cause) {
      onAction(cause instanceof Error ? cause.message : errorMessages.delete);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button className="button primary" onClick={() => startEdit()}>
          <Plus size={16} /> {addLabel}
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
              value={itemDescription}
              onChange={(event) => setItemDescription(event.target.value)}
            />
          </label>
          <div className="adm-actions">
            <button className="button secondary" type="button" onClick={resetForm}>
              <X size={15} /> Cancelar
            </button>
            <button className="button primary" type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : addLabel}
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <LoadingState label={`Cargando ${itemLabelPlural.toLocaleLowerCase()}...`} />
      ) : error ? (
        <ErrorState title="No se pudo cargar el catálogo" description={error} onRetry={load} />
      ) : items.length === 0 ? (
        <div className="hk-empty">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <PaginatedList
          items={items}
          getKey={(item) => item.id}
          listClassName="adm-concierge-list"
          label={paginationLabel}
          renderItem={(item) => (
            <div className="adm-concierge-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.description || 'Sin descripción'}</span>
              </div>
              <span className={`status-pill ${item.active ? 'success' : 'warning'}`}>
                {item.active ? 'Activo' : 'Inactivo'}
              </span>
              <div className="adm-actions">
                <button
                  className="icon-btn"
                  aria-label={`Editar ${item.name}`}
                  onClick={() => startEdit(item)}
                >
                  <Edit2 size={15} />
                </button>
                <button
                  className={`button small ${item.active ? 'secondary' : 'primary'}`}
                  onClick={() => void toggle(item)}
                  type="button"
                >
                  {item.active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  className="icon-btn danger"
                  aria-label={`Eliminar ${item.name}`}
                  title="Eliminar del catálogo"
                  type="button"
                  disabled={deletingId === item.id}
                  onClick={() => setPendingDelete(item)}
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
        title={`Eliminar ${itemLabel}`}
        description={`¿Seguro que quieres eliminar “${pendingDelete?.name ?? ''}” del catálogo? ${deleteDescription}`}
        pending={pendingDelete !== null && deletingId === pendingDelete.id}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void remove(pendingDelete);
        }}
      />
    </div>
  );
}
