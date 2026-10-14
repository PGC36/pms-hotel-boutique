import { mediaService } from '@/services/mediaService';
import {
  orderGalleryImages,
  type MediaImage,
  type MediaImageAssignmentDto,
} from '@/shared/types/entities/media-image';

/**
 * Estado de una galería en un formulario de catálogo (issue #146). Cada
 * imagen nueva se sube apenas se elige (queda pendiente en el backend) y solo
 * se asocia al registro cuando el formulario se guarda con `images`.
 *
 * La primera imagen de la lista es la principal: reordenar o "hacer
 * principal" mueve la imagen al inicio, y así se envía al backend.
 */
export type GalleryItemStatus = 'uploading' | 'ready' | 'error';

export type GalleryItem = {
  /** Clave estable para React; no es el id del backend. */
  key: string;
  /** Id de la imagen en el backend. Ausente mientras sube o si la carga falló. */
  mediaId?: string;
  /** Imagen ya guardada en el registro (llega del backend). */
  image?: MediaImage;
  /** Vista previa local (`blob:` de `URL.createObjectURL`) de un archivo recién elegido. */
  localPreviewUrl?: string;
  /** Nombre del archivo local, para describir la imagen mientras sube o si falla. */
  fileName?: string;
  altText: string;
  status: GalleryItemStatus;
  error?: string;
  /**
   * Se subió en esta sesión del formulario y todavía no está guardada en el
   * registro: si se quita o se cancela el formulario, se borra del backend.
   */
  pendingUpload: boolean;
};

let keySequence = 0;
export const nextGalleryKey = (): string => `gallery-${Date.now()}-${(keySequence += 1)}`;

/** Galería inicial a partir de las imágenes guardadas: la principal primero, luego por posición. */
export function galleryFromImages(images: MediaImage[]): GalleryItem[] {
  return orderGalleryImages(images).map((image) => ({
    key: `media-${image.id}`,
    mediaId: image.id,
    image,
    altText: image.altText ?? '',
    status: 'ready',
    pendingUpload: false,
  }));
}

/**
 * Lista `images` para el create/update. Sin marca `primary`: el backend toma
 * la primera como principal, que es justo el orden que muestra el formulario.
 */
export function toImageAssignments(items: GalleryItem[]): MediaImageAssignmentDto[] {
  return items
    .filter((item): item is GalleryItem & { mediaId: string } =>
      Boolean(item.status === 'ready' && item.mediaId),
    )
    .map((item) => ({
      media_id: item.mediaId,
      alt_text: item.altText.trim() || undefined,
    }));
}

/** Mueve una imagen de `from` a `to`. Índices fuera de rango no cambian nada. */
export function moveGalleryItem(items: GalleryItem[], from: number, to: number): GalleryItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export const makePrimaryGalleryItem = (items: GalleryItem[], index: number): GalleryItem[] =>
  moveGalleryItem(items, index, 0);

/**
 * Motivo por el que el formulario todavía no puede guardarse, o `null`. Nunca
 * se guarda con una imagen subiendo (se perdería) ni con una fallida (el
 * usuario creería que quedó guardada).
 */
export function getGallerySaveBlocker(items: GalleryItem[]): string | null {
  if (items.some((item) => item.status === 'uploading')) {
    return 'Espera a que terminen de subir las imágenes antes de guardar.';
  }
  if (items.some((item) => item.status === 'error')) {
    return 'Quita o vuelve a intentar las imágenes con error antes de guardar.';
  }
  return null;
}

export const remainingGallerySlots = (items: GalleryItem[], maxImages: number): number =>
  Math.max(0, maxImages - items.length);

/** Libera la vista previa local de una imagen. */
export function releaseGalleryPreview(item: GalleryItem): void {
  if (item.localPreviewUrl) URL.revokeObjectURL(item.localPreviewUrl);
}

/**
 * Borra del backend las imágenes subidas en esta sesión que no se guardaron
 * (formulario cancelado o imagen quitada). Si falla, la limpieza programada
 * del backend las borra de todos modos al vencer su plazo.
 */
export async function discardPendingUploads(items: GalleryItem[]): Promise<void> {
  await Promise.allSettled(
    items
      .filter((item) => item.pendingUpload && item.mediaId)
      .map((item) => mediaService.deletePendingImage(item.mediaId as string)),
  );
}
