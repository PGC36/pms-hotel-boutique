import { useCallback, useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';

import { housekeepingChecklistTemplateService } from '@/services/housekeepingChecklistTemplateService';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';

/** Límites del backend (`UpdateHousekeepingChecklistTemplateRequest`): 50 puntos de hasta 240. */
const CHECKLIST_MAX_ITEMS = 50;
const CHECKLIST_ITEM_MAX_LENGTH = 240;

export function HousekeepingChecklistTemplatePanel({
  onAction,
}: {
  onAction: (message: string) => void;
}) {
  const [templateName, setTemplateName] = useState('');
  const [itemsText, setItemsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const itemsDirtyRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setError('');
    try {
      const template = await housekeepingChecklistTemplateService.get();
      hasLoadedRef.current = true;
      setTemplateName(template.name);
      setItemsText(template.items.join('\n'));
    } catch (cause) {
      if (!hasLoadedRef.current) {
        setError(cause instanceof Error ? cause.message : 'No fue posible cargar la checklist.');
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    const refreshSilently = () => {
      if (
        !active ||
        saving ||
        document.visibilityState !== 'visible' ||
        document.querySelector('.modal-backdrop') ||
        itemsDirtyRef.current ||
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
  }, [load, saving]);

  const save = async () => {
    if (saving) return;
    const items = itemsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    const longItem = items.findIndex((item) => item.length > CHECKLIST_ITEM_MAX_LENGTH);
    const nextError = !items.length
      ? 'La checklist debe incluir al menos un punto.'
      : items.length > CHECKLIST_MAX_ITEMS
        ? `Máximo ${CHECKLIST_MAX_ITEMS} puntos (hay ${items.length}).`
        : longItem >= 0
          ? `El punto ${longItem + 1} supera ${CHECKLIST_ITEM_MAX_LENGTH} caracteres.`
          : null;
    setFieldError(nextError);
    if (nextError) return;
    setSaving(true);
    try {
      const saved = await housekeepingChecklistTemplateService.update(items);
      itemsDirtyRef.current = false;
      setItemsText(saved.items.join('\n'));
      onAction('Checklist predeterminada actualizada');
    } catch (cause) {
      onAction(cause instanceof Error ? cause.message : 'No fue posible guardar la checklist.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h3>Checklist predeterminada</h3>
          <p>{templateName || 'Limpieza de habitación'} · Un punto por línea</p>
        </div>
        <button className="button primary" onClick={() => void save()} disabled={loading || saving}>
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar checklist'}
        </button>
      </div>
      {loading ? (
        <LoadingState label="Cargando checklist..." />
      ) : error ? (
        <ErrorState title="No se pudo cargar la checklist" description={error} onRetry={load} />
      ) : (
        <>
          <label className="adm-checklist-template-field">
            Puntos de la limpieza
            <textarea
              rows={8}
              maxLength={12000}
              className={fieldError ? 'error' : undefined}
              value={itemsText}
              onChange={(event) => {
                setItemsText(event.target.value);
                setFieldError(null);
              }}
              aria-label="Puntos de la checklist de limpieza, uno por línea"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? 'checklist-template-error' : undefined}
            />
          </label>
          {fieldError && (
            <p id="checklist-template-error" className="hk-form-error" role="alert">
              {fieldError}
            </p>
          )}
          <p className="adm-checklist-template-note">
            Se copia a las nuevas solicitudes de limpieza. Las tareas existentes conservan su
            checklist. Los pedidos de artículos no usan esta lista.
          </p>
        </>
      )}
    </div>
  );
}
