import { useRef, useState } from 'react';
import './presentation.css';

export function ErrorState({
  title = 'No pudimos cargar los datos',
  description = 'Intenta nuevamente.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function retry() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setRetryError(null);
    try {
      await onRetry();
    } catch {
      setRetryError('El reintento falló. Puedes volver a intentarlo.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <div className="ui-state ui-state--error" aria-busy={pending}>
      <div role="alert">
        <p className="ui-state__title">{title}</p>
        <p className="ui-state__description">{retryError ?? description}</p>
      </div>
      <button className="ui-action" type="button" disabled={pending} onClick={retry}>
        {pending ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  );
}
