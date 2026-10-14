import { toDomain as toRoom, type Room, type RoomDto } from '@/shared/types/entities/room';
import {
  toDomain as toServiceRequest,
  type ServiceRequest,
  type ServiceRequestDto,
} from '@/shared/types/entities/service-request';
import type { ID } from '@/shared/types/common';
import type { RoomHousekeepingStatus, ServiceRequestStatus } from '@/shared/constants/statuses';
import { HttpError, httpClient } from './http-client';
import { guestRequest } from './guestHttp';

// INT-09: el turnover (`dirty -> cleaning -> clean -> inspected`) y las tareas
// stayover viven en `HousekeepingController` del backend. El backend decide si
// una transición es válida; este servicio no replica esas reglas.

type HousekeepingRoomResponse = {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  floor: number;
  status: RoomDto['status'];
  housekeepingStatus: RoomDto['housekeeping_status'];
  notes?: string | null;
  cleaningUserEmail?: string | null;
  cleaningStartedAt?: string | null;
  cleaningCompletedByUserEmail?: string | null;
  cleaningCompletedAt?: string | null;
  inspectorUserEmail?: string | null;
  inspectedAt?: string | null;
  updatedAt: string;
};

type StayoverCleaningStatusResponse =
  'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';

type StayoverCleaningResponse = {
  id: string;
  bookingId: string;
  roomId?: string | null;
  roomNumber?: string | null;
  status: StayoverCleaningStatusResponse;
  description: string;
  notes?: string | null;
  responsibleUserEmail?: string | null;
  startedByUserEmail?: string | null;
  completedByUserEmail?: string | null;
  requestedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HousekeepingChecklistItem = {
  id?: ID;
  label: string;
  done: boolean;
  position?: number;
  notes?: string;
  checkedByUserEmail?: string;
  checkedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type HousekeepingChecklist = {
  id: ID;
  serviceRequestId: ID;
  roomId?: ID;
  roomNumber?: string;
  status: HousekeepingChecklistStatus;
  observations?: string;
  responsibleUserEmail?: string;
  completedByUserEmail?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  items: HousekeepingChecklistItem[];
};

type HousekeepingChecklistResponse = {
  id: string;
  serviceRequestId: string;
  roomId: string;
  roomNumber?: string | null;
  status: HousekeepingChecklistStatus;
  observations?: string | null;
  responsibleUserEmail?: string | null;
  completedByUserEmail?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: {
    id?: string | null;
    label: string;
    checked: boolean;
    position?: number | null;
    notes?: string | null;
    checkedByUserEmail?: string | null;
    checkedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  }[];
};

type SaveChecklistPayload = {
  observations?: string;
  status?: HousekeepingChecklistStatus;
  items: HousekeepingChecklistItem[];
};

type HousekeepingChecklistTemplateResponse = {
  code: string;
  name: string;
  items: string[];
  updatedAt: string;
};

type HousekeepingChecklistStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

function toRoomDto(response: HousekeepingRoomResponse): RoomDto {
  return {
    id: response.id,
    room_number: response.roomNumber,
    room_type_id: response.roomTypeId,
    floor: response.floor,
    status: response.status,
    housekeeping_status: response.housekeepingStatus,
    notes: response.notes ?? undefined,
    cleaning_user_email: response.cleaningUserEmail ?? undefined,
    cleaning_started_at: response.cleaningStartedAt ?? undefined,
    cleaning_completed_by_user_email: response.cleaningCompletedByUserEmail ?? undefined,
    cleaning_completed_at: response.cleaningCompletedAt ?? undefined,
    inspector_user_email: response.inspectorUserEmail ?? undefined,
    inspected_at: response.inspectedAt ?? undefined,
    // HousekeepingRoomResponse no expone createdAt; updatedAt es la mejor cota disponible.
    created_at: response.updatedAt,
    updated_at: response.updatedAt,
  };
}

function toServiceRequestDto(response: StayoverCleaningResponse): ServiceRequestDto {
  return {
    id: response.id,
    booking_id: response.bookingId,
    room_id: response.roomId ?? '',
    type: 'housekeeping',
    description: response.description,
    // El contrato del frontend representa una cancelación del huésped como `rejected`.
    status: response.status === 'cancelled' ? 'rejected' : response.status,
    notes: response.notes ?? undefined,
    requested_at: response.requestedAt,
    started_at: response.startedAt ?? undefined,
    completed_at: response.completedAt ?? undefined,
    created_at: response.createdAt,
    updated_at: response.updatedAt,
  };
}

function toStatusParam(status: ServiceRequestStatus): string {
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
  if (error.status === 400) {
    return `${fallback} El backend rechazó la transición: el estado cambió, se recargó el estado real.`;
  }
  if (error.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
  if (error.status === 403) return 'No tienes permisos para operar Limpieza.';
  if (error.status === 404) return `${fallback} El registro ya no existe.`;
  return fallback;
}

async function request<T>(call: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new Error(getHttpErrorMessage(error, fallback));
  }
}

async function roomAction(roomId: ID, action: string, fallback: string): Promise<Room> {
  const response = await request(
    () => httpClient.post<HousekeepingRoomResponse>(`/housekeeping/rooms/${roomId}/${action}`),
    fallback,
  );
  return toRoom(toRoomDto(response));
}

async function stayoverAction(requestId: ID, action: string, fallback: string) {
  const response = await request(
    () =>
      httpClient.post<StayoverCleaningResponse>(
        `/housekeeping/rooms/stayover-cleanings/${requestId}/${action}`,
      ),
    fallback,
  );
  return toServiceRequest(toServiceRequestDto(response));
}

function removeChecklist(roomId: ID): void {
  void roomId;
}

function toDate(value?: string | null): Date | undefined {
  return value ? new Date(value) : undefined;
}

function toChecklist(response: HousekeepingChecklistResponse): HousekeepingChecklist {
  return {
    id: response.id,
    serviceRequestId: response.serviceRequestId,
    roomId: response.roomId,
    roomNumber: response.roomNumber ?? undefined,
    status: response.status,
    observations: response.observations ?? undefined,
    responsibleUserEmail: response.responsibleUserEmail ?? undefined,
    completedByUserEmail: response.completedByUserEmail ?? undefined,
    startedAt: toDate(response.startedAt),
    completedAt: toDate(response.completedAt),
    createdAt: new Date(response.createdAt),
    updatedAt: new Date(response.updatedAt),
    items: response.items.map((item) => ({
      id: item.id ?? undefined,
      label: item.label,
      done: item.checked,
      position: item.position ?? undefined,
      notes: item.notes ?? undefined,
      checkedByUserEmail: item.checkedByUserEmail ?? undefined,
      checkedAt: toDate(item.checkedAt),
      createdAt: toDate(item.createdAt),
      updatedAt: toDate(item.updatedAt),
    })),
  };
}

function toChecklistRequest(data: SaveChecklistPayload) {
  return {
    observations: data.observations?.trim() || undefined,
    status: data.status,
    items: data.items.map((item) => ({
      id: item.id,
      label: item.label.trim(),
      checked: item.done,
      position: item.position,
      notes: item.notes?.trim() || undefined,
    })),
  };
}

export const housekeepingService = {
  async getRooms(filters: { housekeepingStatus?: RoomHousekeepingStatus } = {}): Promise<Room[]> {
    const response = await request(
      () =>
        httpClient.get<HousekeepingRoomResponse[]>(
          withQuery('/housekeeping/rooms', { housekeepingStatus: filters.housekeepingStatus }),
        ),
      'No fue posible cargar las habitaciones de limpieza.',
    );
    return response.map((item) => toRoom(toRoomDto(item)));
  },
  async getRoom(roomId: ID): Promise<Room> {
    const response = await request(
      () => httpClient.get<HousekeepingRoomResponse>(`/housekeeping/rooms/${roomId}`),
      'No fue posible cargar la habitación.',
    );
    return toRoom(toRoomDto(response));
  },
  async startCleaning(roomId: ID): Promise<Room> {
    const room = await roomAction(roomId, 'start', 'No fue posible iniciar la limpieza.');
    // Un turnover nuevo arranca con el checklist vacío.
    removeChecklist(roomId);
    return room;
  },
  async completeCleaning(roomId: ID): Promise<Room> {
    return roomAction(roomId, 'complete', 'No fue posible finalizar la limpieza.');
  },
  async inspectRoom(roomId: ID): Promise<Room> {
    return roomAction(roomId, 'inspect', 'No fue posible inspeccionar la habitación.');
  },
  async getStayoverCleanings(
    filters: { bookingId?: ID; status?: ServiceRequestStatus } = {},
  ): Promise<ServiceRequest[]> {
    const response = await request(
      () =>
        httpClient.get<StayoverCleaningResponse[]>(
          withQuery('/housekeeping/rooms/stayover-cleanings', {
            bookingId: filters.bookingId,
            status: filters.status ? toStatusParam(filters.status) : undefined,
          }),
        ),
      'No fue posible cargar las limpiezas de estancia.',
    );
    return response.map((item) => toServiceRequest(toServiceRequestDto(item)));
  },
  async createStayoverCleaning(
    roomId: ID,
    data: { bookingId: ID; description?: string },
  ): Promise<ServiceRequest> {
    const response = await request(
      () =>
        httpClient.post<StayoverCleaningResponse>(
          `/housekeeping/rooms/${roomId}/stayover-cleanings`,
          { bookingId: data.bookingId, description: data.description?.trim() || undefined },
        ),
      'No fue posible crear la limpieza de estancia.',
    );
    return toServiceRequest(toServiceRequestDto(response));
  },
  async startStayoverCleaning(requestId: ID): Promise<ServiceRequest> {
    return stayoverAction(requestId, 'start', 'No fue posible iniciar la limpieza de estancia.');
  },
  async completeStayoverCleaning(requestId: ID): Promise<ServiceRequest> {
    return stayoverAction(
      requestId,
      'complete',
      'No fue posible completar la limpieza de estancia.',
    );
  },
  // --- Portal del huésped (INT-12) -------------------------------------------
  // Limpiezas de estancia de la reserva del JWT de huésped (`/guest/housekeeping`).
  async getGuestStayoverRequests(): Promise<ServiceRequest[]> {
    const response = await guestRequest(
      () => httpClient.get<StayoverCleaningResponse[]>('/guest/housekeeping/requests'),
      'No fue posible cargar tus solicitudes de limpieza.',
    );
    return response.map((item) => toServiceRequest(toServiceRequestDto(item)));
  },
  async createGuestStayoverRequest(data: {
    description: string;
    notes?: string;
    serviceId?: string;
  }): Promise<ServiceRequest> {
    if (!data.description.trim()) throw new Error('Describe la solicitud.');
    const response = await guestRequest(
      () =>
        httpClient.post<StayoverCleaningResponse>('/guest/housekeeping/requests', {
          description: data.description.trim(),
          notes: data.notes?.trim() || undefined,
          serviceId: data.serviceId,
        }),
      'No fue posible enviar tu solicitud de limpieza.',
    );
    return toServiceRequest(toServiceRequestDto(response));
  },
  async createGuestHousekeepingItemRequest(data: {
    itemId: ID;
    quantity: number;
    notes?: string;
  }): Promise<ServiceRequest> {
    if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 5) {
      throw new Error('La cantidad debe ser de 1 a 5 artículos.');
    }
    const response = await guestRequest(
      () =>
        httpClient.post<StayoverCleaningResponse>('/guest/housekeeping/item-requests', {
          itemId: data.itemId,
          quantity: data.quantity,
          notes: data.notes?.trim() || undefined,
        }),
      'No fue posible solicitar los artículos de limpieza.',
    );
    return toServiceRequest(toServiceRequestDto(response));
  },
  /** El backend decide si la limpieza todavía se puede cancelar. */
  async cancelGuestStayoverRequest(requestId: ID): Promise<ServiceRequest> {
    const response = await guestRequest(
      () =>
        httpClient.post<StayoverCleaningResponse>(
          `/guest/housekeeping/requests/${requestId}/cancel`,
        ),
      'No fue posible cancelar tu solicitud de limpieza.',
    );
    return toServiceRequest(toServiceRequestDto(response));
  },
  async getChecklists(): Promise<HousekeepingChecklist[]> {
    const response = await request(
      () => httpClient.get<HousekeepingChecklistResponse[]>('/housekeeping/checklists'),
      'No fue posible cargar los checklists de limpieza.',
    );
    return response.map(toChecklist);
  },
  async getGuestCleaningChecklistTemplate(): Promise<string[]> {
    const response = await request(
      () =>
        httpClient.get<HousekeepingChecklistTemplateResponse>('/housekeeping/checklist-template'),
      'No fue posible cargar la lista de limpieza configurada.',
    );
    return response.items;
  },
  async createChecklist(data: SaveChecklistPayload & { serviceRequestId: ID }) {
    const response = await request(
      () =>
        httpClient.post<HousekeepingChecklistResponse>('/housekeeping/checklists', {
          serviceRequestId: data.serviceRequestId,
          ...toChecklistRequest(data),
        }),
      'No fue posible crear el checklist de limpieza.',
    );
    return toChecklist(response);
  },
  async saveChecklist(checklistId: ID, data: SaveChecklistPayload): Promise<HousekeepingChecklist> {
    const response = await request(
      () =>
        httpClient.put<HousekeepingChecklistResponse>(
          `/housekeeping/checklists/${checklistId}`,
          toChecklistRequest(data),
        ),
      'No fue posible guardar el checklist de limpieza.',
    );
    return toChecklist(response);
  },
};

export default housekeepingService;
