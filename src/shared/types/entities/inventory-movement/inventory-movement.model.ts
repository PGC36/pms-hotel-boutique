export type InventoryMovementType = 'in' | 'out';
export type InventoryMovementReason = 'purchase' | 'restock' | 'consumption' | 'sale' | 'shrinkage';

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  type: InventoryMovementType;
  reason: InventoryMovementReason;
  quantity: number;
  responsibleUserId?: string;
  occurredAt: Date;
  notes?: string;
  createdAt: Date;
}
