import { toDomainDate, toDtoDate } from '@/shared/types/common';
import {
  toDomain as toMediaImage,
  toDTO as toMediaImageDTO,
} from '@/shared/types/entities/media-image';
import type { RoomTypeDto } from './room-type.dto';
import type { RoomType } from './room-type.model';

export const toDomain = (dto: RoomTypeDto): RoomType => ({
  id: dto.id,
  code: dto.code,
  name: dto.name,
  description: dto.description,
  capacity: dto.capacity,
  bedConfiguration: dto.bed_configuration,
  roomFeatureIds: [...dto.room_feature_ids],
  active: dto.active,
  images: dto.images.map(toMediaImage),
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: RoomType): RoomTypeDto => ({
  id: model.id,
  code: model.code,
  name: model.name,
  description: model.description,
  capacity: model.capacity,
  bed_configuration: model.bedConfiguration,
  room_feature_ids: [...model.roomFeatureIds],
  active: model.active,
  images: model.images.map(toMediaImageDTO),
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
