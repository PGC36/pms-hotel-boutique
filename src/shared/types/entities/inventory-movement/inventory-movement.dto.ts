export type InventoryMovementTypeDto = 'in' | 'out';
export type InventoryMovementReasonDto =
  'purchase' | 'restock' | 'consumption' | 'sale' | 'shrinkage';

/** Entrada o salida de un artículo de inventario (Lote D, WEB-12). */
export interface InventoryMovementDTO {
  id: string;
  inventory_item_id: string;
  type: InventoryMovementTypeDto;
  reason: InventoryMovementReasonDto;
  quantity: number;
  responsible_user_id?: string;
  occurred_at: string;
  notes?: string;
  created_at: string;
}

export type InventoryMovementDto = InventoryMovementDTO;
