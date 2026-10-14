/**
 * Imagen de catálogo asociada a un tipo de habitación, producto o amenidad
 * (backend #82). Los bytes viven en el almacenamiento de objetos del backend;
 * aquí solo llegan sus URLs públicas por variante. El orden de la galería es
 * `position` y la imagen principal es la que trae `primary: true`.
 *
 * Las URLs responden 404 sin sesión si la imagen no está asociada a un
 * registro activo — para el personal existe la ruta con token (ver
 * services/mediaService.ts).
 */
export type MediaTargetDto = 'room_type' | 'product' | 'amenity' | 'inventory_item';

export type MediaVariantDto = 'thumb' | 'medium' | 'large';

export interface MediaImageUrlsDto {
  thumb: string;
  medium: string;
  large: string;
}

export interface MediaImageDTO {
  id: string;
  alt_text?: string;
  position: number;
  primary: boolean;
  width: number;
  height: number;
  urls: MediaImageUrlsDto;
}

export type MediaImageDto = MediaImageDTO;

/**
 * Imagen recién subida (`POST /media`), todavía pendiente: sus URLs públicas
 * responden 404 hasta que se asocia a un registro activo, y el backend la
 * borra en `expires_at` si nadie la asocia.
 */
export interface MediaUploadDto {
  id: string;
  target: MediaTargetDto;
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
  urls: MediaImageUrlsDto;
  expires_at: string;
}

/**
 * Una imagen ya subida que se asocia a un registro en su create/update. El
 * orden de la lista es el orden de la galería; si ninguna llega con
 * `primary: true`, la primera es la principal.
 */
export interface MediaImageAssignmentDto {
  media_id: string;
  alt_text?: string;
  primary?: boolean;
}
