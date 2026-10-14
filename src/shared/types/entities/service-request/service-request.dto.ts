export type ServiceRequestStatusDto =
  'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';

/**
 * Solicitud de limpieza o conservería que el huésped hace desde la app
 * (o que recepción registra por teléfono). A diferencia de `order`
 * (Room Service, con productos), aquí lo que viaja es una descripción
 * libre de la tarea. `charge_id` queda para el caso poco común de una
 * solicitud que sí genera un cargo (p. ej. un taxi reservado por
 * conserjería).
 */
export type ServiceRequestTypeDto = 'housekeeping' | 'concierge' | 'maintenance' | 'other';

export interface ServiceRequestDTO {
  id: string;
  booking_id: string;
  room_id: string;
  /** Datos que devuelve Conserjería (INT-11): el personal no tiene `rooms.read`. */
  room_number?: string;
  guest_id?: string;
  guest_name?: string;
  /** Responsable asignado (INT-11); el nombre evita depender de /admin/users. */
  responsible_user_id?: string;
  responsible_user_name?: string;
  responsible_user_email?: string;
  type: ServiceRequestTypeDto;
  description: string;
  status: ServiceRequestStatusDto;
  notes?: string;
  charge_id?: string;
  requested_at: string;
  /** Trazabilidad de stayover (INT-09): cuándo se inició y completó. */
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export type ServiceRequestDto = ServiceRequestDTO;

export interface CreateServiceRequestDto {
  booking_id: string;
  room_id: string;
  guest_id?: string;
  type: ServiceRequestTypeDto;
  description: string;
  notes?: string;
}
