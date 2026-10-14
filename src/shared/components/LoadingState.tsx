import './presentation.css';

export function LoadingState({
  label = 'Cargando datos…',
  variant = 'block',
}: {
  label?: string;
  variant?: 'block' | 'inline';
}) {
  return (
    <div className={`ui-state ui-state--${variant}`} role="status" aria-live="polite">
      <span className="ui-spinner" aria-hidden="true" /> <span>{label}</span>
    </div>
  );
}
