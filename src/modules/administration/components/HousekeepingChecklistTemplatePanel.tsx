import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';

import { housekeepingChecklistTemplateService } from '@/services/housekeepingChecklistTemplateService';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';

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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const template = await housekeepingChecklistTemplateService.get();
      setTemplateName(template.name);
      setItemsText(template.items.join('\n'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar la checklist.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const items = itemsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!items.length) {
      onAction('La checklist debe incluir al menos un punto.');
      return;
    }
    setSaving(true);
    try {
      const saved = await housekeepingChecklistTemplateService.update(items);
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
              value={itemsText}
              onChange={(event) => setItemsText(event.target.value)}
              aria-label="Puntos de la checklist de limpieza, uno por línea"
            />
          </label>
          <p className="adm-checklist-template-note">
            Se copia a las nuevas solicitudes de limpieza. Las tareas existentes conservan su
            checklist. Los pedidos de artículos no usan esta lista.
          </p>
        </>
      )}
    </div>
  );
}
