import { toDomainDate, toDtoDate } from '@/shared/types/common';
import {
  toDomain as toMediaImage,
  toDTO as toMediaImageDTO,
} from '@/shared/types/entities/media-image';
import type { ProductDto } from './product.dto';
import type { Product } from './product.model';

export const toDomain = (dto: ProductDto): Product => ({
  id: dto.id,
  sku: dto.sku,
  name: dto.name,
  description: dto.description,
  category: dto.category === 'food_and_beverage' ? 'foodAndBeverage' : dto.category,
  priceCents: dto.price_cents,
  currency: dto.currency,
  stockQuantity: dto.stock_quantity,
  reorderLevel: dto.reorder_level,
  active: dto.active,
  images: dto.images.map(toMediaImage),
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: Product): ProductDto => ({
  id: model.id,
  sku: model.sku,
  name: model.name,
  description: model.description,
  category: model.category === 'foodAndBeverage' ? 'food_and_beverage' : model.category,
  price_cents: model.priceCents,
  currency: model.currency,
  stock_quantity: model.stockQuantity,
  reorder_level: model.reorderLevel,
  active: model.active,
  images: model.images.map(toMediaImageDTO),
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
