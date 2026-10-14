import { toDomainDate } from '@/shared/types/common';
import type { ID } from '@/shared/types/common';
import { httpClient } from './http-client';
import { guestRequest } from './guestHttp';

/**
 * Notificaciones del huésped (INT-12): las persiste el backend por reserva y las
 * genera ante cambios de Room Service, Conserjería y cancelaciones de limpieza.
 * Sin colección mock: la fuente oficial es `/guest/notifications` con el JWT de
 * huésped. No hay entidad en el contrato compartido (ver docs/DECISIONES.md,
 * divergencia con MOV-21), así que el tipo vive aquí.
 */
export interface Notification {
  id: ID;
  /** Tipo técnico del backend, p. ej. `room_service_delivered`. */
  type: string;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: ID;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

type GuestNotificationResponse = {
  id: string;
  type: string;
  title: string;
  message: string;
  resourceType?: string | null;
  resourceId?: string | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
};

function toNotification(response: GuestNotificationResponse): Notification {
  return {
    id: response.id,
    type: response.type,
    title: response.title,
    message: response.message,
    resourceType: response.resourceType ?? undefined,
    resourceId: response.resourceId ?? undefined,
    read: response.read,
    readAt: response.readAt ? toDomainDate(response.readAt) : undefined,
    createdAt: toDomainDate(response.createdAt),
  };
}

export const notificationService = {
  async getGuestNotifications(): Promise<Notification[]> {
    const response = await guestRequest(
      () => httpClient.get<GuestNotificationResponse[]>('/guest/notifications'),
      'No fue posible cargar tus notificaciones.',
    );
    return response.map(toNotification);
  },
  /** Contador oficial del backend (`GET /guest/notifications/unread-count`). */
  async getGuestUnreadCount(): Promise<number> {
    const response = await guestRequest(
      () => httpClient.get<{ unreadCount: number }>('/guest/notifications/unread-count'),
      'No fue posible cargar tus notificaciones.',
    );
    return response.unreadCount;
  },
  async markGuestNotificationRead(notificationId: ID): Promise<Notification> {
    const response = await guestRequest(
      () =>
        httpClient.post<GuestNotificationResponse>(`/guest/notifications/${notificationId}/read`),
      'No fue posible marcar la notificación como leída.',
    );
    return toNotification(response);
  },
  /** Marca todas en una sola transacción del backend y devuelve el listado actualizado. */
  async markAllGuestNotificationsRead(): Promise<Notification[]> {
    const response = await guestRequest(
      () => httpClient.post<GuestNotificationResponse[]>('/guest/notifications/read-all'),
      'No fue posible marcar las notificaciones como leídas.',
    );
    return response.map(toNotification);
  },
};

export default notificationService;
