import type { MediaImage } from '@/shared/types/entities/media-image';

import type { Currency } from '@/shared/types/common';

export type ProductCategory = 'minibar' | 'shop' | 'foodAndBeverage' | 'other';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: ProductCategory;
  priceCents: number;
  currency: Currency;
  stockQuantity: number;
  reorderLevel: number;
  active: boolean;
  images: MediaImage[];
  createdAt: Date;
  updatedAt: Date;
}
