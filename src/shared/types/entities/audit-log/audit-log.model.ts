export type KnownAuditModule =
  'guestAccounts' | 'cash' | 'inventory' | 'catalog' | 'users' | 'bookings';
export type AuditModule = KnownAuditModule | (string & {});
export type KnownAuditAction = 'create' | 'update' | 'delete' | 'void' | 'open' | 'close';
export type AuditAction = KnownAuditAction | (string & {});

export interface AuditLog {
  id: string;
  userId: string;
  module: AuditModule;
  action: AuditAction;
  entityType: string;
  entityId: string;
  occurredAt: Date;
  details?: string;
  createdAt: Date;
}
