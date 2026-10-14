import type { MediaImage } from '@/shared/types/entities/media-image';

export interface RoomType {
  id: string;
  code: string;
  name: string;
  description?: string;
  capacity: number;
  bedConfiguration: string;
  roomFeatureIds: string[];
  active: boolean;
  images: MediaImage[];
  createdAt: Date;
  updatedAt: Date;
}
