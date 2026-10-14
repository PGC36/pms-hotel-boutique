import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { OrderDto, OrderItemDto } from './order.dto';
import type { Order, OrderItem } from './order.model';

const itemToDomain = (item: OrderItemDto): OrderItem => ({
  productId: item.product_id,
  quantity: item.quantity,
  unitPriceCents: item.unit_price_cents,
  productName: item.product_name,
  lineTotalCents: item.line_total_cents,
});

// Los campos opcionales se omiten si faltan: los ítems mock no los traen.
const itemToDTO = (item: OrderItem): OrderItemDto => ({
  product_id: item.productId,
  quantity: item.quantity,
  unit_price_cents: item.unitPriceCents,
  ...(item.productName !== undefined && { product_name: item.productName }),
  ...(item.lineTotalCents !== undefined && { line_total_cents: item.lineTotalCents }),
});

export const toDomain = (dto: OrderDto): Order => ({
  id: dto.id,
  bookingId: dto.booking_id,
  roomId: dto.room_id,
  roomNumber: dto.room_number,
  guestId: dto.guest_id,
  guestName: dto.guest_name,
  items: dto.items.map(itemToDomain),
  status: dto.status === 'on_the_way' ? 'onTheWay' : dto.status,
  notes: dto.notes,
  currency: dto.currency,
  totalCents: dto.total_cents,
  chargeId: dto.charge_id,
  requestedAt: toDomainDate(dto.requested_at),
  createdAt: toDomainDate(dto.created_at),
  updatedAt: toDomainDate(dto.updated_at),
});

export const toDTO = (model: Order): OrderDto => ({
  id: model.id,
  booking_id: model.bookingId,
  room_id: model.roomId,
  room_number: model.roomNumber,
  guest_id: model.guestId,
  guest_name: model.guestName,
  items: model.items.map(itemToDTO),
  status: model.status === 'onTheWay' ? 'on_the_way' : model.status,
  notes: model.notes,
  currency: model.currency,
  total_cents: model.totalCents,
  charge_id: model.chargeId,
  requested_at: toDtoDate(model.requestedAt),
  created_at: toDtoDate(model.createdAt),
  updated_at: toDtoDate(model.updatedAt),
});
