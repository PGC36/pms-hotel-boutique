import { toDomainDate, toDtoDate } from '@/shared/types/common';
import {
  toDomain as toMediaImage,
  toDTO as toMediaImageDTO,
} from '@/shared/types/entities/media-image';
import type { AmenityDto } from './amenity.dto';
import type { Amenity } from './amenity.model';

export const toDomain = (dto: AmenityDto): Amenity => ({
  id: dto.id,
  name: dto.name,
  description: dto.description,
  category: dto.category,
  location: dto.location,
  opensAt: dto.opens_at,
  closesAt: dto.closes_at,
  active: dto.active,
  images: dto.images.map(toMediaImage),
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: Amenity): AmenityDto => ({
  id: model.id,
  name: model.name,
  description: model.description,
  category: model.category,
  location: model.location,
  opens_at: model.opensAt,
  closes_at: model.closesAt,
  active: model.active,
  images: model.images.map(toMediaImageDTO),
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
