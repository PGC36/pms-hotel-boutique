import type { MediaImageDto } from '@/shared/types/entities/media-image';

export type AmenityCategoryDto = 'room' | 'hotel' | 'service';

export interface AmenityDTO {
  id: string;
  name: string;
  description?: string;
  category: AmenityCategoryDto;
  location?: string;
  /**
   * Horario de funcionamiento, `"HH:mm"` 24 horas (Lote D, WEB-12). Ausentes
   * en una amenidad de servicio continuo (p. ej. Wi-Fi) — no todas cierran.
   */
  opens_at?: string;
  closes_at?: string;
  active: boolean;
  /** Galería ordenada (backend #82). Vacía si todavía no tiene imagen. */
  images: MediaImageDto[];
  created_at: string;
  updated_at: string;
}

export type AmenityDto = AmenityDTO;
