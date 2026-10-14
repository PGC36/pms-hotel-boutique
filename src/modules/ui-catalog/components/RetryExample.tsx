import { useEffect, useState } from 'react';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { Badge } from '@/shared/components/Badge';
import { getCatalogRecords } from '../services/catalog-service';

export function RetryExample() {
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    getCatalogRecords({ fail: true }).catch(() => {
      if (active) setStatus('error');
    });
    return () => {
      active = false;
    };
  }, []);
  async function reload(fail = false) {
    setStatus('loading');
    try {
      const records = await getCatalogRecords({ fail });
      setCount(records.length);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }
  if (status === 'loading') return <LoadingState label="Recuperando registros…" />;
  if (status === 'error')
    return (
      <ErrorState
        description="La solicitud de ejemplo falló. Reintenta para recuperar los registros."
        onRetry={() => reload()}
      />
    );
  return (
    <div className="ui-state">
      <Badge tone="success">Solicitud completada</Badge>
      <p>{count} registros recuperados.</p>
      <button className="ui-action" type="button" onClick={() => reload(true)}>
        Reproducir error
      </button>
    </div>
  );
}
