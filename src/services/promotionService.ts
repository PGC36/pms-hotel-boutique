import {
  toDomain as toPromotion,
  type Promotion,
  type PromotionDto,
} from '@/shared/types/entities/promotion';
import { simulateLatency } from './mockUtils';
import { getUserFacingErrorMessage, HttpError, httpClient } from './http-client';

type ApiPromotion = {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountPercent: number;
  validFrom: string;
  validTo?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type SavePromotionData = {
  code: string;
  name: string;
  description: string;
  discount_percent: number;
  valid_from: string;
  valid_to: string;
  active?: boolean;
};

function validatePromotion(
  data: Pick<SavePromotionData, 'name' | 'code' | 'discount_percent' | 'valid_from'> & {
    valid_to?: string;
  },
) {
  if (!data.name.trim()) throw new Error('La promocion requiere nombre.');
  if (!data.code.trim()) throw new Error('La promocion requiere codigo.');
  if (
    !Number.isInteger(data.discount_percent) ||
    data.discount_percent < 1 ||
    data.discount_percent > 100
  ) {
    throw new Error('El descuento debe ser un numero entero entre 1 y 100.');
  }
  if (!data.valid_from) throw new Error('Selecciona la fecha de inicio de la promocion.');
  if (data.valid_to && data.valid_to < data.valid_from) {
    throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio.');
  }
}

function toPromotionDto(api: ApiPromotion): PromotionDto {
  return {
    id: api.id,
    code: api.code,
    name: api.name,
    description: api.description ?? '',
    discount_percent: api.discountPercent,
    valid_from: api.validFrom,
    valid_to: api.validTo ?? api.validFrom,
    active: api.active,
    created_at: api.createdAt,
    updated_at: api.updatedAt,
  };
}

function toRequest(data: SavePromotionData) {
  return {
    code: data.code.trim().toUpperCase(),
    name: data.name.trim(),
    description: data.description.trim(),
    discountPercent: data.discount_percent,
    validFrom: data.valid_from,
    validTo: data.valid_to || undefined,
    active: data.active ?? true,
  };
}

async function getPromotionRequest(id: string, data: Partial<SavePromotionData>) {
  const promotions = await httpClient.get<ApiPromotion[]>('/admin/promotions');
  const found = promotions.find((promotion) => promotion.id === id);
  if (!found) throw new Error(`No existe la promocion ${id}.`);
  const current = toPromotionDto(found);
  return toRequest({
    code: data.code ?? current.code,
    name: data.name ?? current.name,
    description: data.description ?? current.description,
    discount_percent: data.discount_percent ?? current.discount_percent,
    valid_from: data.valid_from ?? current.valid_from,
    valid_to: data.valid_to ?? current.valid_to,
    active: data.active ?? current.active,
  });
}

export const promotionService = {
  async getPublicPromotions(): Promise<Promotion[]> {
    await simulateLatency();
    try {
      const promotions = await httpClient.get<ApiPromotion[]>('/public/promotions', {
        auth: { skipAuthorization: true, skipRefresh: true },
      });
      return promotions.map(toPromotionDto).map(toPromotion);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        throw new Error('No pudimos cargar las promociones. Intenta nuevamente.');
      }
      throw new Error(getUserFacingErrorMessage(error, 'No fue posible cargar las promociones.'));
    }
  },
  async getPromotions(): Promise<Promotion[]> {
    await simulateLatency();
    const promotions = await httpClient.get<ApiPromotion[]>('/admin/promotions');
    return promotions.map(toPromotionDto).map(toPromotion);
  },
  async createPromotion(data: SavePromotionData): Promise<Promotion> {
    await simulateLatency();
    validatePromotion(data);

    const promotion = await httpClient.post<ApiPromotion>('/admin/promotions', toRequest(data));
    return toPromotion(toPromotionDto(promotion));
  },
  async updatePromotion(id: string, data: Partial<SavePromotionData>): Promise<Promotion> {
    await simulateLatency();
    const request = await getPromotionRequest(id, data);
    validatePromotion({
      name: request.name,
      code: request.code,
      discount_percent: request.discountPercent,
      valid_from: request.validFrom,
      valid_to: request.validTo,
    });
    const promotion = await httpClient.put<ApiPromotion>(`/admin/promotions/${id}`, request);
    return toPromotion(toPromotionDto(promotion));
  },
};
export default promotionService;
