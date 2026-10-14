import type { MediaImage } from '@/shared/types/entities/media-image';

export type AmenityCategory = 'room' | 'hotel' | 'service';

export interface Amenity {
  id: string;
  name: string;
  description?: string;
  category: AmenityCategory;
  location?: string;
  opensAt?: string;
  closesAt?: string;
  active: boolean;
  images: MediaImage[];
  createdAt: Date;
  updatedAt: Date;
}
