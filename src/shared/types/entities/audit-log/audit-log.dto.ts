export type KnownAuditModuleDto =
  'guest_accounts' | 'cash' | 'inventory' | 'catalog' | 'users' | 'bookings';
export type AuditModuleDto = KnownAuditModuleDto | (string & {});
export type KnownAuditActionDto = 'create' | 'update' | 'delete' | 'void' | 'open' | 'close';
export type AuditActionDto = KnownAuditActionDto | (string & {});

/**
 * Registro de auditoría (Lote D, WEB-12): quién, cuándo, qué módulo, qué
 * acción, sobre qué entidad. Suficiente para filtrar por usuario, fecha,
 * módulo y acción.
 */
export interface AuditLogDTO {
  id: string;
  user_id: string;
  module: AuditModuleDto;
  action: AuditActionDto;
  entity_type: string;
  entity_id: string;
  occurred_at: string;
  details?: string;
  created_at: string;
}

export type AuditLogDto = AuditLogDTO;
