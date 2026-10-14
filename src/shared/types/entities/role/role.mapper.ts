import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { RoleDto } from './role.dto';
import type { Role } from './role.model';

export const toDomain = (dto: RoleDto): Role => ({
  id: dto.id,
  code: dto.code,
  name: dto.name,
  permissionIds: [...dto.permission_ids],
  active: dto.active,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: Role): RoleDto => ({
  id: model.id,
  code: model.code,
  name: model.name,
  permission_ids: [...model.permissionIds],
  active: model.active,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
