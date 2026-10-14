import type { Currency } from '@/shared/types/common';
import type { MediaImageDto } from '@/shared/types/entities/media-image';

export type ProductCategoryDto = 'minibar' | 'shop' | 'food_and_beverage' | 'other';

export interface ProductDTO {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: ProductCategoryDto;
  price_cents: number;
  currency: Currency;
  stock_quantity: number;
  reorder_level: number;
  active: boolean;
  /** Galería ordenada (backend #82). Vacía si todavía no tiene imagen. */
  images: MediaImageDto[];
  created_at: string;
  updated_at: string;
}

export type ProductDto = ProductDTO;
