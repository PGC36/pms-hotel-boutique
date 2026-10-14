import type { Currency } from '@/shared/types/common';

export type OrderStatusDto =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'on_the_way'
  | 'delivered'
  | 'rejected'
  | 'cancelled';

export interface OrderItemDto {
  product_id: string;
  quantity: number;
  unit_price_cents: number;
  /** Nombre y total de la línea con precio congelado; los calcula el backend (INT-10). */
  product_name?: string;
  line_total_cents?: number;
}

/**
 * Un pedido de Room Service. Lo opera la app móvil (personal de room
 * service marca el avance) y lo cobra la web: al entregarse, ese consumo
 * se carga a la cuenta del huésped vía `charge_id` (ver `charge/`). Entidad
 * más crítica del contrato compartido junto con `service_request` — si
 * web y móvil divergen aquí, el cargo no se puede generar.
 */
export interface OrderDTO {
  id: string;
  booking_id: string;
  room_id: string;
  /** Datos de entrega que devuelve el backend: el personal no tiene `rooms.read`. */
  room_number?: string;
  guest_id?: string;
  guest_name?: string;
  items: OrderItemDto[];
  status: OrderStatusDto;
  notes?: string;
  currency: Currency;
  /** Total calculado por el backend con precios congelados. */
  total_cents?: number;
  charge_id?: string;
  requested_at: string;
  created_at: string;
  updated_at: string;
}

export type OrderDto = OrderDTO;

export interface CreateOrderDto {
  booking_id: string;
  room_id: string;
  guest_id?: string;
  items: OrderItemDto[];
  notes?: string;
}
