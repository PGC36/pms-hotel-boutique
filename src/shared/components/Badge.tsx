import type { ReactNode } from 'react';
import './presentation.css';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export function Badge({
  children,
  tone = 'neutral',
  size = 'medium',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  size?: 'small' | 'medium';
}) {
  return <span className={`ui-badge ui-badge--${tone} ui-badge--${size}`}>{children}</span>;
}
