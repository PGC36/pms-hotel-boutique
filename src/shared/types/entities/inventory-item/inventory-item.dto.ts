export type InventoryItemCategoryDto = 'room_service' | 'housekeeping' | 'maintenance' | 'office';
export type InventoryUnitDto = 'unit' | 'box' | 'bottle' | 'kg' | 'liter' | 'roll';

/**
 * Artículo de inventario (Lote D, WEB-12) — más amplio que `product`
 * (Room Service vendible al huésped): también cubre insumos operativos
 * (blancos, químicos de limpieza) que nunca se venden. `product_id?`
 * enlaza el subconjunto de artículos que sí son productos de Room
 * Service. `current_quantity` es un valor guardado — coincide con la
 * suma de sus `inventory_movement` (entradas menos salidas); la FASE 5 lo
 * verifica.
 */
export interface InventoryItemDTO {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: InventoryItemCategoryDto;
  unit: InventoryUnitDto;
  current_quantity: number;
  minimum_quantity: number;
  product_id?: string;
  images?: MediaImageDTO[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type InventoryItemDto = InventoryItemDTO;
import type { MediaImageDTO } from '../media-image';
