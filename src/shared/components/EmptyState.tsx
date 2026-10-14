import type { ReactNode } from 'react';
import './presentation.css';

export function EmptyState({
  title = 'No hay registros',
  description = 'Los resultados aparecerán aquí.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-state">
      <p className="ui-state__title">{title}</p>
      <p className="ui-state__description">{description}</p>
      {action}
    </div>
  );
}
