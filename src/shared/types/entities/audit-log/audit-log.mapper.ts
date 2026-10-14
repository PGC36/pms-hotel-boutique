import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { AuditLogDto } from './audit-log.dto';
import type { AuditLog } from './audit-log.model';

const toDomainModule = (module: AuditLogDto['module']): AuditLog['module'] =>
  module === 'guest_accounts' ? 'guestAccounts' : module;

const toDtoModule = (module: AuditLog['module']): AuditLogDto['module'] =>
  module === 'guestAccounts' ? 'guest_accounts' : module;

export const toDomain = (dto: AuditLogDto): AuditLog => ({
  id: dto.id,
  userId: dto.user_id,
  module: toDomainModule(dto.module),
  action: dto.action,
  entityType: dto.entity_type,
  entityId: dto.entity_id,
  occurredAt: toDomainDate(dto.occurred_at),
  details: dto.details,
  createdAt: toDomainDate(dto.created_at),
});

export const toDTO = (model: AuditLog): AuditLogDto => ({
  id: model.id,
  user_id: model.userId,
  module: toDtoModule(model.module),
  action: model.action,
  entity_type: model.entityType,
  entity_id: model.entityId,
  occurred_at: toDtoDate(model.occurredAt),
  details: model.details,
  created_at: toDtoDate(model.createdAt),
});
