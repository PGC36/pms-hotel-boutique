import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { PermissionDto } from './permission.dto';
import type { Permission } from './permission.model';

export const toDomain = (dto: PermissionDto): Permission => ({
  id: dto.id,
  key: dto.key,
  name: dto.name,
  description: dto.description,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: Permission): PermissionDto => ({
  id: model.id,
  key: model.key,
  name: model.name,
  description: model.description,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
