import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { RoomFeatureDto } from './room-feature.dto';
import type { RoomFeature } from './room-feature.model';

export const toDomain = (dto: RoomFeatureDto): RoomFeature => ({
  id: dto.id,
  name: dto.name,
  description: dto.description,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: RoomFeature): RoomFeatureDto => ({
  id: model.id,
  name: model.name,
  description: model.description,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
