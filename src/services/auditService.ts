import {
  toDomain as toAuditLog,
  type AuditLog,
  type AuditLogDto,
} from '@/shared/types/entities/audit-log';
import { simulateLatency } from './mockUtils';
import { httpClient } from './http-client';

type ApiAuditLog = {
  id: string;
  userId?: string;
  userEmail?: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  details?: string;
};

const defaultFrom = '2000-01-01T00:00:00-06:00';
const defaultTo = '2100-01-01T00:00:00-06:00';

const toModule = (module: string) => (module === 'guestAccounts' ? 'guest_accounts' : module);

function toAuditLogDto(api: ApiAuditLog): AuditLogDto {
  return {
    id: api.id,
    user_id: api.userId ?? '',
    module: toModule(api.module),
    action: api.action,
    entity_type: api.entityType,
    entity_id: api.entityId,
    occurred_at: api.occurredAt,
    details: api.details ?? api.userEmail,
    created_at: api.occurredAt,
  };
}

export const auditService = {
  async getLogs(range: { from?: string | Date; to?: string | Date } = {}): Promise<AuditLog[]> {
    await simulateLatency();
    const from =
      range.from instanceof Date ? range.from.toISOString() : (range.from ?? defaultFrom);
    const to = range.to instanceof Date ? range.to.toISOString() : (range.to ?? defaultTo);
    const params = new URLSearchParams({ from, to });
    const logs = await httpClient.get<ApiAuditLog[]>(`/admin/audit-logs?${params.toString()}`);
    return logs.map(toAuditLogDto).map(toAuditLog);
  },
};
export default auditService;
