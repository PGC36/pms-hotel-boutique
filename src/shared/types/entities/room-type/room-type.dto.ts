import type { MediaImageAssignmentDto, MediaImageDto } from '@/shared/types/entities/media-image';

export interface RoomTypeDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  capacity: number;
  bed_configuration: string;
  /**
   * Características de la habitación (aire acondicionado, balcón, vista al
   * jardín...), no amenidades del hotel. Una amenidad (piscina, spa) es un
   * servicio compartido con horario propio y no pertenece a un tipo de
   * habitación — ver `room-feature/` y docs/CONTRATO-DATOS.md sección 3.2.
   */
  room_feature_ids: string[];
  active: boolean;
  /** Galería ordenada (backend #82). Vacía si el tipo todavía no tiene fotos. */
  images: MediaImageDto[];
  created_at: string;
  updated_at: string;
}

export interface CreateRoomTypeDto {
  code: string;
  name: string;
  description?: string;
  capacity: number;
  bed_configuration: string;
  room_feature_ids: string[];
  active?: boolean;
  /** Ausente: no cambia la galería. Lista vacía: quita todas las imágenes. */
  images?: MediaImageAssignmentDto[];
}

export type UpdateRoomTypeDto = Partial<CreateRoomTypeDto>;
