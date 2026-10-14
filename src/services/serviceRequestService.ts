import {
  toDomain as toServiceRequest,
  type ServiceRequest,
  type ServiceRequestStatus,
} from '@/shared/types/entities/service-request';
import type { ID } from '@/shared/types/common';
import type {
  ServiceRequestDto,
  ServiceRequestTypeDto,
} from '@/shared/types/entities/service-request';
import { mockUtils, simulateLatency } from './mockUtils';
import { HttpError, httpClient } from './http-client';
import { guestRequest } from './guestHttp';

type ServiceRequestResponse = {
  id: string;
  bookingId?: string | null;
  roomId?: string | null;
  roomNumber?: string | null;
  guestId?: string | null;
  guestName?: string | null;
  responsibleUserId?: string | null;
  responsibleUserName?: string | null;
  responsibleUserEmail?: string | null;
  type: ServiceRequestTypeDto;
  description: string;
  status: ServiceRequestDto['status'];
  notes?: string | null;
  chargeId?: string | null;
  requestedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

function toServiceRequestDto(response: ServiceRequestResponse): ServiceRequestDto {
  return {
    id: response.id,
    booking_id: response.bookingId ?? '',
    room_id: response.roomId ?? '',
    room_number: response.roomNumber ?? undefined,
    guest_id: response.guestId ?? undefined,
    guest_name: response.guestName ?? undefined,
    responsible_user_id: response.responsibleUserId ?? undefined,
    responsible_user_name: response.responsibleUserName ?? undefined,
    responsible_user_email: response.responsibleUserEmail ?? undefined,
    type: response.type,
    description: response.description,
    status: response.status,
    notes: response.notes ?? undefined,
    charge_id: response.chargeId ?? undefined,
    requested_at: response.requestedAt,
    started_at: response.startedAt ?? undefined,
    completed_at: response.completedAt ?? undefined,
    created_at: response.createdAt,
    updated_at: response.updatedAt,
  };
}

function toStatusParam(status: ServiceRequestStatus): ServiceRequestDto['status'] {
  return status === 'inProgress' ? 'in_progress' : status;
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
  const data = error.data;
  if (data && typeof data === 'object') {
    const value = data as { message?: unknown; error?: unknown; detail?: unknown };
    if (typeof value.message === 'string' && value.message.trim()) return value.message;
    if (typeof value.error === 'string' && value.error.trim()) return value.error;
    if (typeof value.detail === 'string' && value.detail.trim()) return value.detail;
  }
  if (error.status === 400) {
    return `${fallback} El backend rechazó la operación: la solicitud cambió de estado o ya no admite ese cambio.`;
  }
  if (error.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
  if (error.status === 403) return 'No tienes permisos para operar solicitudes.';
  if (error.status === 404) return `${fallback} La solicitud no existe.`;
  return fallback;
}

async function request<T>(call: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new Error(getHttpErrorMessage(error, fallback));
  }
}

/**
 * Tipos que `/service-requests` acepta para crear o cambiar de estado.
 * Conserjería y stayover de limpieza tienen endpoints propios y el backend
 * responde 400 si llegan por esta ruta.
 */
type GeneralServiceRequestType = Extract<ServiceRequestTypeDto, 'maintenance' | 'other'>;

const conciergePath = '/concierge/requests';
const serviceRequestsPath = '/service-requests';

export const serviceRequestService = {
  async getConciergeRequests(
    filters: { bookingId?: ID; status?: ServiceRequestStatus } = {},
  ): Promise<ServiceRequest[]> {
    const response = await request(
      () =>
        httpClient.get<ServiceRequestResponse[]>(
          withQuery(conciergePath, {
            bookingId: filters.bookingId,
            status: filters.status ? toStatusParam(filters.status) : undefined,
          }),
        ),
      'No fue posible cargar las solicitudes de conserjería.',
    );
    return response.map((item) => toServiceRequest(toServiceRequestDto(item)));
  },
  async getConciergeRequestById(id: ID): Promise<ServiceRequest | undefined> {
    try {
      const response = await httpClient.get<ServiceRequestResponse>(`${conciergePath}/${id}`);
      return toServiceRequest(toServiceRequestDto(response));
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw new Error(getHttpErrorMessage(error, 'No fue posible cargar la solicitud.'));
    }
  },
  async createConciergeRequest(data: {
    bookingId: ID;
    description: string;
    notes?: string;
  }): Promise<ServiceRequest> {
    if (!data.description.trim()) throw new Error('Describe la solicitud.');
    const response = await request(
      () =>
        httpClient.post<ServiceRequestResponse>(conciergePath, {
          bookingId: data.bookingId,
          description: data.description.trim(),
          notes: data.notes?.trim() || undefined,
        }),
      'No fue posible crear la solicitud.',
    );
    return toServiceRequest(toServiceRequestDto(response));
  },
  async updateConciergeRequest(
    id: ID,
    data: { description?: string; notes?: string },
  ): Promise<ServiceRequest> {
    const response = await request(
      () => httpClient.put<ServiceRequestResponse>(`${conciergePath}/${id}`, data),
      'No fue posible guardar la solicitud.',
    );
    return toServiceRequest(toServiceRequestDto(response));
  },
  async updateConciergeRequestStatus(
    id: ID,
    status: ServiceRequestStatus,
    options: { notes?: string; responsibleUserId?: ID } = {},
  ): Promise<ServiceRequest> {
    const response = await request(
      () =>
        httpClient.post<ServiceRequestResponse>(`${conciergePath}/${id}/status`, {
          status: toStatusParam(status),
          notes: options.notes,
          responsibleUserId: options.responsibleUserId,
        }),
      'No fue posible actualizar la solicitud.',
    );
    return toServiceRequest(toServiceRequestDto(response));
  },
  async getGuestConciergeRequests(): Promise<ServiceRequest[]> {
    const response = await guestRequest(
      () => httpClient.get<ServiceRequestResponse[]>('/guest/concierge/requests'),
      'No fue posible cargar tus solicitudes.',
    );
    return response.map((item) => toServiceRequest(toServiceRequestDto(item)));
  },
  async createGuestConciergeRequest(data: {
    serviceId: ID;
    description: string;
    notes?: string;
  }): Promise<ServiceRequest> {
    if (!data.description.trim()) throw new Error('Describe la solicitud.');
    const response = await guestRequest(
      () =>
        httpClient.post<ServiceRequestResponse>('/guest/concierge/requests', {
          description: data.description.trim(),
          notes: data.notes?.trim() || undefined,
          serviceId: data.serviceId,
        }),
      'No fue posible enviar tu solicitud.',
    );
    return toServiceRequest(toServiceRequestDto(response));
  },
  async cancelGuestConciergeRequest(requestId: ID): Promise<ServiceRequest> {
    const response = await guestRequest(
      () =>
        httpClient.post<ServiceRequestResponse>(`/guest/concierge/requests/${requestId}/cancel`),
      'No fue posible cancelar tu solicitud.',
    );
    return toServiceRequest(toServiceRequestDto(response));
  },
  async getRequests(
    filters: {
      type?: ServiceRequestTypeDto;
      bookingId?: ID;
      roomId?: ID;
      status?: ServiceRequestStatus;
    } = {},
  ): Promise<ServiceRequest[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar las solicitudes.');
    const response = await request(
      () =>
        httpClient.get<ServiceRequestResponse[]>(
          withQuery(serviceRequestsPath, {
            type: filters.type,
            bookingId: filters.bookingId,
            roomId: filters.roomId,
            status: filters.status ? toStatusParam(filters.status) : undefined,
          }),
        ),
      'No fue posible cargar las solicitudes.',
    );
    return response.map((item) => toServiceRequest(toServiceRequestDto(item)));
  },
  async getRequestById(id: ID): Promise<ServiceRequest | undefined> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar la solicitud.');
    try {
      const response = await httpClient.get<ServiceRequestResponse>(`${serviceRequestsPath}/${id}`);
      return toServiceRequest(toServiceRequestDto(response));
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw new Error(getHttpErrorMessage(error, 'No fue posible cargar la solicitud.'));
    }
  },
  async createRequest(data: {
    bookingId?: ID;
    roomId: ID;
    type: GeneralServiceRequestType;
    description: string;
    notes?: string;
  }): Promise<ServiceRequest> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible crear la solicitud.');
    if (!data.description.trim()) throw new Error('Describe la solicitud.');

    const response = await request(
      () =>
        httpClient.post<ServiceRequestResponse>(serviceRequestsPath, {
          bookingId: data.bookingId,
          roomId: data.roomId,
          type: data.type,
          description: data.description.trim(),
          notes: data.notes?.trim() || undefined,
        }),
      'No fue posible crear la solicitud.',
    );
    return toServiceRequest(toServiceRequestDto(response));
  },
  async createMaintenanceReport(data: {
    roomId: ID;
    description: string;
    notes?: string;
  }): Promise<ServiceRequest> {
    return this.createRequest({
      roomId: data.roomId,
      type: 'maintenance',
      description: data.description,
      notes: data.notes,
    });
  },
  async updateRequestStatus(
    id: ID,
    status: ServiceRequestStatus,
    options: { notes?: string; responsibleUserId?: ID } = {},
  ): Promise<ServiceRequest> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible actualizar la solicitud.');
    const response = await request(
      () =>
        httpClient.post<ServiceRequestResponse>(`${serviceRequestsPath}/${id}/status`, {
          status: toStatusParam(status),
          notes: options.notes?.trim() || undefined,
          responsibleUserId: options.responsibleUserId,
        }),
      'No fue posible actualizar la solicitud.',
    );
    return toServiceRequest(toServiceRequestDto(response));
  },
};
export default serviceRequestService;
