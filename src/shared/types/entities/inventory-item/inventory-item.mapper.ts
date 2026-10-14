import { toDomainDate, toDtoDate } from '@/shared/types/common';
import {
  toDomain as toMediaImage,
  toDTO as toMediaImageDto,
} from '../media-image/media-image.mapper';
import type { InventoryItemDto } from './inventory-item.dto';
import type { InventoryItem } from './inventory-item.model';

const toDomainCategory = (category: InventoryItemDto['category']): InventoryItem['category'] =>
  category === 'room_service' ? 'roomService' : category;

const toDtoCategory = (category: InventoryItem['category']): InventoryItemDto['category'] =>
  category === 'roomService' ? 'room_service' : category;

export const toDomain = (dto: InventoryItemDto): InventoryItem => ({
  id: dto.id,
  sku: dto.sku,
  name: dto.name,
  description: dto.description,
  category: toDomainCategory(dto.category),
  unit: dto.unit,
  currentQuantity: dto.current_quantity,
  minimumQuantity: dto.minimum_quantity,
  productId: dto.product_id,
  ...(dto.images === undefined ? {} : { images: dto.images.map(toMediaImage) }),
  active: dto.active,
  isBelowMinimum: dto.current_quantity < dto.minimum_quantity,
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: InventoryItem): InventoryItemDto => ({
  id: model.id,
  sku: model.sku,
  name: model.name,
  description: model.description,
  category: toDtoCategory(model.category),
  unit: model.unit,
  current_quantity: model.currentQuantity,
  minimum_quantity: model.minimumQuantity,
  product_id: model.productId,
  ...(model.images === undefined ? {} : { images: model.images.map(toMediaImageDto) }),
  active: model.active,
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
