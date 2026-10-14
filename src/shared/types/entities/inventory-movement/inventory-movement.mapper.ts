import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { InventoryMovementDto } from './inventory-movement.dto';
import type { InventoryMovement } from './inventory-movement.model';

export const toDomain = (dto: InventoryMovementDto): InventoryMovement => ({
  id: dto.id,
  inventoryItemId: dto.inventory_item_id,
  type: dto.type,
  reason: dto.reason,
  quantity: dto.quantity,
  responsibleUserId: dto.responsible_user_id,
  occurredAt: toDomainDate(dto.occurred_at),
  notes: dto.notes,
  createdAt: toDomainDate(dto.created_at),
});

export const toDTO = (model: InventoryMovement): InventoryMovementDto => ({
  id: model.id,
  inventory_item_id: model.inventoryItemId,
  type: model.type,
  reason: model.reason,
  quantity: model.quantity,
  responsible_user_id: model.responsibleUserId,
  occurred_at: toDtoDate(model.occurredAt),
  notes: model.notes,
  created_at: toDtoDate(model.createdAt),
});
