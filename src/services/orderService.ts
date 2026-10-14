import { toDomain as toOrder, type Order, type OrderDto } from '@/shared/types/entities/order';
import type { ID } from '@/shared/types/common';
import type { OrderStatus } from '@/shared/constants/statuses';
import { HttpError, httpClient } from './http-client';
import { guestRequest } from './guestHttp';

// INT-10: el personal opera los pedidos contra `RoomServiceController`. El
// backend decide las transiciones, descuenta/devuelve inventario y genera el
// cargo al folio al entregar; este servicio no replica nada de eso.

type RoomServiceOrderItemResponse = {
  id: string;
  productId: string;
  productName?: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents?: number | null;
};

type RoomServiceOrderResponse = {
  id: string;
  bookingId: string;
  roomId?: string | null;
  roomNumber?: string | null;
  guestId?: string | null;
  guestName?: string | null;
  status: OrderDto['status'];
  notes?: string | null;
  currency: string;
  totalCents?: number | null;
  items: RoomServiceOrderItemResponse[];
  chargeId?: string | null;
  requestedAt: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeCurrency(value: string): OrderDto['currency'] {
  if (value !== 'GTQ') {
    throw new Error(`Room Service solo admite moneda GTQ; backend devolvio ${value}.`);
  }
  return 'GTQ';
}

function toOrderDto(response: RoomServiceOrderResponse): OrderDto {
  return {
    id: response.id,
    booking_id: response.bookingId,
    room_id: response.roomId ?? '',
    room_number: response.roomNumber ?? undefined,
    guest_id: response.guestId ?? undefined,
    guest_name: response.guestName ?? undefined,
    items: response.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      product_name: item.productName ?? undefined,
      line_total_cents: item.lineTotalCents ?? undefined,
    })),
    status: response.status,
    notes: response.notes ?? undefined,
    currency: normalizeCurrency(response.currency),
    total_cents: response.totalCents ?? undefined,
    charge_id: response.chargeId ?? undefined,
    requested_at: response.requestedAt,
    created_at: response.createdAt,
    updated_at: response.updatedAt,
  };
}

function toStatusParam(status: OrderStatus): OrderDto['status'] {
  return status === 'onTheWay' ? 'on_the_way' : status;
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

function getHttpErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpError)) return error instanceof Error ? error.message : fallback;
  if (error.status === 400) {
    return `${fallback} El backend rechazó la operación: el pedido cambió de estado, no hay stock suficiente o el folio no está abierto.`;
  }
  if (error.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
  if (error.status === 403) return 'No tienes permisos para operar Room Service.';
  if (error.status === 404) return `${fallback} El pedido, la reserva o el folio no existe.`;
  return fallback;
}

async function request<T>(call: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new Error(getHttpErrorMessage(error, fallback));
  }
}

export const orderService = {
  async getOrders(filters: { bookingId?: ID; status?: OrderStatus } = {}): Promise<Order[]> {
    const response = await request(
      () =>
        httpClient.get<RoomServiceOrderResponse[]>(
          withQuery('/room-service/orders', {
            bookingId: filters.bookingId,
            status: filters.status ? toStatusParam(filters.status) : undefined,
          }),
        ),
      'No fue posible cargar los pedidos.',
    );
    return response.map((item) => toOrder(toOrderDto(item)));
  },
  async getOrderById(id: ID): Promise<Order | undefined> {
    try {
      const response = await httpClient.get<RoomServiceOrderResponse>(`/room-service/orders/${id}`);
      return toOrder(toOrderDto(response));
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw new Error(getHttpErrorMessage(error, 'No fue posible cargar el pedido.'));
    }
  },
  /** Creación desde el personal: el backend toma habitación, huésped y precios de la reserva. */
  async createStaffOrder(data: {
    bookingId: ID;
    items: { productId: ID; quantity: number }[];
    notes?: string;
  }): Promise<Order> {
    if (data.items.length === 0) throw new Error('Agrega al menos un producto al pedido.');
    const response = await request(
      () =>
        httpClient.post<RoomServiceOrderResponse>('/room-service/orders', {
          bookingId: data.bookingId,
          notes: data.notes?.trim() || undefined,
          items: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      'No fue posible crear el pedido.',
    );
    return toOrder(toOrderDto(response));
  },
  /**
   * Cambia el estado en backend. `notes` viaja junto con el cambio (p. ej. el
   * motivo de un rechazo o cancelación); si se omite, el backend conserva las notas.
   */
  async updateOrderStatus(orderId: ID, status: OrderStatus, notes?: string): Promise<Order> {
    const response = await request(
      () =>
        httpClient.post<RoomServiceOrderResponse>(`/room-service/orders/${orderId}/status`, {
          status: toStatusParam(status),
          notes,
        }),
      'No fue posible actualizar el pedido.',
    );
    return toOrder(toOrderDto(response));
  },
  async updateOrderNotes(orderId: ID, notes: string): Promise<Order> {
    const response = await request(
      () =>
        httpClient.patch<RoomServiceOrderResponse>(`/room-service/orders/${orderId}/notes`, {
          notes,
        }),
      'No fue posible guardar la observación del pedido.',
    );
    return toOrder(toOrderDto(response));
  },
  // --- Portal del huésped (INT-12) ---------------------------------------------
  // La reserva sale del JWT de huésped: ninguna de estas llamadas envía bookingId.
  async getGuestOrders(): Promise<Order[]> {
    const response = await guestRequest(
      () => httpClient.get<RoomServiceOrderResponse[]>('/guest/room-service/orders'),
      'No fue posible cargar tus pedidos.',
    );
    return response.map((item) => toOrder(toOrderDto(item)));
  },
  async createGuestOrder(data: {
    items: { productId: ID; quantity: number }[];
    notes?: string;
  }): Promise<Order> {
    if (data.items.length === 0) throw new Error('Agrega al menos un producto al pedido.');
    const response = await guestRequest(
      () =>
        httpClient.post<RoomServiceOrderResponse>('/guest/room-service/orders', {
          notes: data.notes?.trim() || undefined,
          items: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      'No fue posible enviar tu pedido.',
    );
    return toOrder(toOrderDto(response));
  },
  /** El backend decide si el pedido todavía se puede cancelar. */
  async cancelGuestOrder(orderId: ID): Promise<Order> {
    const response = await guestRequest(
      () =>
        httpClient.post<RoomServiceOrderResponse>(`/guest/room-service/orders/${orderId}/cancel`),
      'No fue posible cancelar tu pedido.',
    );
    return toOrder(toOrderDto(response));
  },
};
export default orderService;
