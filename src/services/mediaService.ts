import {
  toTargetDTO,
  toUploadDomain,
  type MediaImageAssignmentDto,
  type MediaImageDto,
  type MediaImageUrlsDto,
  type MediaTarget,
  type MediaUpload,
  type MediaUploadDto,
  type MediaVariant,
} from '@/shared/types/entities/media-image';
import { HttpError, httpClient } from './http-client';
import { simulateLatency } from './mockUtils';

/**
 * Imágenes de catálogo (issue #146) sobre el contrato del backend #82
 * (docs/development/media-images.md en el repo del backend):
 *
 * 1. `POST /media` sube el archivo y devuelve una imagen pendiente.
 * 2. Su id viaja en `images` del create/update del registro (roomService,
 *    catalogService); ahí queda asociada y, si el registro está activo, pública.
 *
 * Nunca se usa Base64 ni localStorage: la vista previa local sale de
 * `URL.createObjectURL(file)` y la persistencia es solo del backend.
 */

/** Límites del backend; se validan antes de subir para dar el error sin esperar la red. */
export const MEDIA_LIMITS = {
  maxFileSizeBytes: 5 * 1024 * 1024,
  maxImagesPerRecord: 10,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;

/** Valor para el atributo `accept` de un `<input type="file">`. */
export const MEDIA_ACCEPT = MEDIA_LIMITS.acceptedTypes.join(',');

const MAX_SIZE_LABEL = `${MEDIA_LIMITS.maxFileSizeBytes / (1024 * 1024)} MB`;

export const MEDIA_ERROR_MESSAGES = {
  unsupported: 'Formato no admitido. Usa una imagen JPEG, PNG o WebP.',
  tooLarge: `La imagen supera el tamaño máximo de ${MAX_SIZE_LABEL}.`,
  empty: 'El archivo está vacío.',
  corrupt: 'La imagen está dañada o no se puede leer.',
  tooManyPixels: 'La imagen tiene una resolución demasiado grande. Redúcela e intenta de nuevo.',
  forbidden: 'No tienes permiso para gestionar imágenes de este catálogo.',
  sessionExpired: 'Tu sesión expiró. Inicia sesión nuevamente.',
  unavailable: 'El almacenamiento de imágenes no está disponible. Intenta de nuevo en un momento.',
  uploadFailed: 'No fue posible subir la imagen.',
  deleteFailed: 'No fue posible quitar la imagen.',
  previewFailed: 'No fue posible cargar la vista previa.',
} as const;

/** Mensajes del backend al asociar imágenes en un create/update (400/409). */
const ASSIGNMENT_MESSAGES: Array<[RegExp, string]> = [
  [/^Media images not found/, 'Una de las imágenes ya no existe. Vuelve a subirla.'],
  [/already belongs to another record/, 'Una de las imágenes ya pertenece a otro registro.'],
  [/^A record can have at most (\d+) images/, 'Superaste el máximo de imágenes permitidas.'],
  [/was uploaded for/, 'Una de las imágenes se subió para otro catálogo.'],
  [/^Only one image can be marked as primary/, 'Solo una imagen puede ser la principal.'],
  [/^Duplicated media id/, 'La misma imagen aparece dos veces en la galería.'],
];

/** Forma de una imagen en las respuestas de la API (camelCase). */
export type ApiMediaImage = {
  id: string;
  altText?: string | null;
  position: number;
  primary: boolean;
  width: number;
  height: number;
  urls: MediaImageUrlsDto;
};

/** `images` de una respuesta de la API a DTO, ordenadas por posición. Ausente equivale a vacía. */
export function toMediaImageDtos(images: ApiMediaImage[] | undefined | null): MediaImageDto[] {
  return [...(images ?? [])]
    .sort((left, right) => left.position - right.position)
    .map((image) => ({
      id: image.id,
      ...(image.altText ? { alt_text: image.altText } : {}),
      position: image.position,
      primary: image.primary,
      width: image.width,
      height: image.height,
      urls: { ...image.urls },
    }));
}

/**
 * `images` para el body de un create/update. `undefined` se omite del JSON,
 * así el backend no toca la galería; una lista vacía la vacía.
 */
export function toImagesRequest(
  images: MediaImageAssignmentDto[] | undefined,
): Array<{ mediaId: string; altText?: string; primary?: boolean }> | undefined {
  return images?.map((image) => ({
    mediaId: image.media_id,
    altText: image.alt_text?.trim() || undefined,
    primary: image.primary,
  }));
}

function backendMessage(error: HttpError): string {
  const data = error.data as { message?: unknown } | undefined;
  return typeof data?.message === 'string' ? data.message : '';
}

/** Valida tipo y tamaño en el navegador. Devuelve el mensaje de error o `null` si es válida. */
export function validateImageFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(MEDIA_LIMITS.acceptedTypes as readonly string[]).includes(file.type)) {
    return MEDIA_ERROR_MESSAGES.unsupported;
  }
  if (file.size === 0) return MEDIA_ERROR_MESSAGES.empty;
  if (file.size > MEDIA_LIMITS.maxFileSizeBytes) return MEDIA_ERROR_MESSAGES.tooLarge;
  return null;
}

/** Traduce un error de carga del backend a un mensaje para el usuario. */
export function getMediaErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpError)) {
    // fetch rechazado: red caída o backend apagado.
    return error instanceof TypeError ? MEDIA_ERROR_MESSAGES.unavailable : fallback;
  }
  const message = backendMessage(error);
  switch (error.status) {
    case 400:
      if (message.includes('corrupt')) return MEDIA_ERROR_MESSAGES.corrupt;
      if (message.includes('dimensions')) return MEDIA_ERROR_MESSAGES.tooManyPixels;
      if (message.includes('empty')) return MEDIA_ERROR_MESSAGES.empty;
      return describeImageAssignmentError(error) ?? fallback;
    case 401:
      return MEDIA_ERROR_MESSAGES.sessionExpired;
    case 403:
      return MEDIA_ERROR_MESSAGES.forbidden;
    case 413:
      return MEDIA_ERROR_MESSAGES.tooLarge;
    case 415:
      return MEDIA_ERROR_MESSAGES.unsupported;
    case 503:
      return MEDIA_ERROR_MESSAGES.unavailable;
    default:
      return describeImageAssignmentError(error) ?? fallback;
  }
}

/**
 * Si un create/update falló por su lista `images`, devuelve el motivo en
 * español; si el error es de otro campo, `null` para que el servicio dueño
 * use su propio mensaje.
 */
export function describeImageAssignmentError(error: unknown): string | null {
  if (!(error instanceof HttpError) || (error.status !== 400 && error.status !== 409)) return null;
  const message = backendMessage(error);
  return ASSIGNMENT_MESSAGES.find(([pattern]) => pattern.test(message))?.[1] ?? null;
}

export const mediaService = {
  /** Sube una imagen para un catálogo. Queda pendiente hasta guardarla en su registro. */
  async uploadImage(target: MediaTarget, file: File): Promise<MediaUpload> {
    const invalid = validateImageFile(file);
    if (invalid) throw new Error(invalid);
    await simulateLatency();

    const body = new FormData();
    body.append('file', file);
    body.append('target', toTargetDTO(target));
    try {
      const api = await httpClient.post<{
        id: string;
        target: MediaUploadDto['target'];
        contentType: string;
        sizeBytes: number;
        width: number;
        height: number;
        urls: MediaUploadDto['urls'];
        expiresAt: string;
      }>('/media', body);
      return toUploadDomain({
        id: api.id,
        target: api.target,
        content_type: api.contentType,
        size_bytes: api.sizeBytes,
        width: api.width,
        height: api.height,
        urls: { ...api.urls },
        expires_at: api.expiresAt,
      });
    } catch (error) {
      throw new Error(getMediaErrorMessage(error, MEDIA_ERROR_MESSAGES.uploadFailed));
    }
  },

  /**
   * Borra una imagen pendiente (subida pero nunca guardada en un registro).
   * Una asociada se quita desde su registro enviando `images` sin ella.
   */
  async deletePendingImage(id: string): Promise<void> {
    await simulateLatency();
    try {
      await httpClient.delete<void>(`/media/${encodeURIComponent(id)}`);
    } catch (error) {
      throw new Error(getMediaErrorMessage(error, MEDIA_ERROR_MESSAGES.deleteFailed));
    }
  },

  /**
   * Vista previa para el personal de una imagen que la ruta pública oculta
   * (pendiente o de un registro inactivo). Devuelve una URL `blob:` que el
   * llamador libera con `URL.revokeObjectURL` al desmontar.
   */
  async getStaffPreviewUrl(id: string, variant: MediaVariant = 'thumb'): Promise<string> {
    await simulateLatency();
    try {
      const blob = await httpClient.get<Blob>(
        `/media/${encodeURIComponent(id)}/content/${variant}`,
        { responseType: 'blob' },
      );
      return URL.createObjectURL(blob);
    } catch (error) {
      throw new Error(getMediaErrorMessage(error, MEDIA_ERROR_MESSAGES.previewFailed));
    }
  },
};

export default mediaService;
