import { formatCurrency } from '@/shared/utils/currency';

const AUDIT_STATUS_LABELS: Record<string, string> = { active: 'activo', inactive: 'inactivo' };

/**
 * Resumen legible de `details` (JSON que arma AuditTrail, sin secretos). Solo toma
 * campos conocidos; si no hay ninguno, conserva "tipo id".
 */
export const auditDescription = (entityType: string, entityId: string, details?: string) => {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = details ? JSON.parse(details) : {};
    if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
  } catch {
    data = {};
  }
  const value = (key: string) =>
    typeof data[key] === 'string' || typeof data[key] === 'number' ? String(data[key]) : undefined;
  const statusLabel = (status?: string) => (status ? (AUDIT_STATUS_LABELS[status] ?? status) : '');
  const cents = (key: string) =>
    typeof data[key] === 'number' && Number.isInteger(data[key])
      ? (data[key] as number)
      : undefined;
  const parts: string[] = [];
  if (value('userEmail')) parts.push(`Usuario: ${value('userEmail')}`);
  if (value('previousRole') && value('role') && value('previousRole') !== value('role')) {
    parts.push(`Rol: ${value('previousRole')} → ${value('role')}`);
  }
  if (value('previousStatus') && value('status') && value('previousStatus') !== value('status')) {
    parts.push(`Estado: ${statusLabel(value('previousStatus'))} → ${statusLabel(value('status'))}`);
  }
  if (value('code') && entityType === 'role') parts.push(`Rol: ${value('code')}`);
  const amount = cents('amountCents');
  if (amount !== undefined) parts.push(`Monto: ${formatCurrency(amount, 'GTQ')}`);
  const difference = cents('differenceCents');
  if (difference !== undefined) parts.push(`Diferencia: ${formatCurrency(difference, 'GTQ')}`);
  const reason = value('reason') ?? value('voidReason') ?? value('cancellationReason');
  if (reason) parts.push(`Motivo: ${reason}`);
  return parts.length > 0 ? parts.join(' · ') : `${entityType} ${entityId}`;
};
