import { toDomainDate, toDtoDate } from '@/shared/types/common';
import type { ChargeDto } from './charge.dto';
import type { Charge } from './charge.model';

export const toDomain = (dto: ChargeDto): Charge => ({
  id: dto.id,
  bookingId: dto.booking_id,
  productId: dto.product_id,
  description: dto.description,
  quantity: dto.quantity,
  unitPriceCents: dto.unit_price_cents,
  amountCents: dto.amount_cents,
  currency: dto.currency,
  category: dto.category,
  status: dto.status,
  chargedAt: toDomainDate(dto.charged_at),
  createdByUserId: dto.created_by_user_id,
  voidReason: dto.void_reason,
  createdAt: toDomainDate(dto.created_at),
});

export const toDTO = (model: Charge): ChargeDto => ({
  id: model.id,
  booking_id: model.bookingId,
  product_id: model.productId,
  description: model.description,
  quantity: model.quantity,
  unit_price_cents: model.unitPriceCents,
  amount_cents: model.amountCents,
  currency: model.currency,
  category: model.category,
  status: model.status,
  charged_at: toDtoDate(model.chargedAt),
  created_by_user_id: model.createdByUserId,
  void_reason: model.voidReason,
  created_at: toDtoDate(model.createdAt),
});
