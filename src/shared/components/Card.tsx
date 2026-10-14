import type { ReactNode } from 'react';
import './presentation.css';

export interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'outlined' | 'raised' | 'muted';
}

export function Card({ title, description, children, footer, variant = 'outlined' }: CardProps) {
  return (
    <div className={`ui-card ui-card--${variant}`}>
      {(title || description) && (
        <div className="ui-card__header">
          {title && <h3 className="ui-card__title">{title}</h3>}
          {description && <p className="ui-card__description">{description}</p>}
        </div>
      )}
      {children}
      {footer && <div className="ui-card__footer">{footer}</div>}
    </div>
  );
}
