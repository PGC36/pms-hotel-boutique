import { toDomainDate } from '@/shared/types/common';
import type {
  MediaImageAssignmentDto,
  MediaImageDto,
  MediaTargetDto,
  MediaUploadDto,
} from './media-image.dto';
import type {
  MediaImage,
  MediaImageAssignment,
  MediaTarget,
  MediaUpload,
} from './media-image.model';

// `alt_text` es opcional: se omite la clave en vez de dejarla `undefined`, para que
// una imagen anidada en room-type/product/amenity sobreviva el round-trip igual.
export const toDomain = (dto: MediaImageDto): MediaImage => ({
  id: dto.id,
  ...(dto.alt_text !== undefined ? { altText: dto.alt_text } : {}),
  position: dto.position,
  primary: dto.primary,
  width: dto.width,
  height: dto.height,
  urls: { ...dto.urls },
});

export const toDTO = (model: MediaImage): MediaImageDto => ({
  id: model.id,
  ...(model.altText !== undefined ? { alt_text: model.altText } : {}),
  position: model.position,
  primary: model.primary,
  width: model.width,
  height: model.height,
  urls: { ...model.urls },
});

export const toTargetDTO = (target: MediaTarget): MediaTargetDto =>
  target === 'roomType' ? 'room_type' : target === 'inventoryItem' ? 'inventory_item' : target;

export const toTargetDomain = (target: MediaTargetDto): MediaTarget =>
  target === 'room_type' ? 'roomType' : target === 'inventory_item' ? 'inventoryItem' : target;

export const toUploadDomain = (dto: MediaUploadDto): MediaUpload => ({
  id: dto.id,
  target: toTargetDomain(dto.target),
  contentType: dto.content_type,
  sizeBytes: dto.size_bytes,
  width: dto.width,
  height: dto.height,
  urls: { ...dto.urls },
  expiresAt: toDomainDate(dto.expires_at),
});

export const toAssignmentDTO = (model: MediaImageAssignment): MediaImageAssignmentDto => ({
  media_id: model.mediaId,
  alt_text: model.altText,
  primary: model.primary,
});

/** Galería en el orden en que se muestra: la principal primero, luego por posición. */
export const orderGalleryImages = (images: MediaImage[]): MediaImage[] =>
  [...images].sort((left, right) =>
    left.primary === right.primary ? left.position - right.position : left.primary ? -1 : 1,
  );

/** Imagen principal de una galería, o `undefined` si el registro no tiene imágenes. */
export const findPrimaryImage = (images: MediaImage[]): MediaImage | undefined =>
  images.find((image) => image.primary) ?? images[0];
