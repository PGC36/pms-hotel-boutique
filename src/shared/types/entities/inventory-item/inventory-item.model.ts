export type InventoryItemCategory = 'roomService' | 'housekeeping' | 'maintenance' | 'office';
export type InventoryUnit = 'unit' | 'box' | 'bottle' | 'kg' | 'liter' | 'roll';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: InventoryItemCategory;
  unit: InventoryUnit;
  currentQuantity: number;
  minimumQuantity: number;
  productId?: string;
  images?: MediaImage[];
  active: boolean;
  /** `true` si `currentQuantity < minimumQuantity` — calculado por el mapper. */
  isBelowMinimum: boolean;
  createdAt: Date;
  updatedAt: Date;
}
import type { MediaImage } from '../media-image';
