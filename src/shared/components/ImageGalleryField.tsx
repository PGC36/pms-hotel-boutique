import { useEffect, useId, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, RotateCcw, Star, Trash2 } from 'lucide-react';
import {
  MEDIA_ACCEPT,
  MEDIA_LIMITS,
  mediaService,
  validateImageFile,
} from '@/services/mediaService';
import type { MediaTarget } from '@/shared/types/entities/media-image';
import {
  makePrimaryGalleryItem,
  moveGalleryItem,
  nextGalleryKey,
  releaseGalleryPreview,
  remainingGallerySlots,
  type GalleryItem,
} from '@/shared/utils/mediaGallery';
import { CatalogImage } from './CatalogImage';
import './ImageGalleryField.css';

export type ImageGalleryFieldProps = {
  label: string;
  target: MediaTarget;
  items: GalleryItem[];
  onChange: Dispatch<SetStateAction<GalleryItem[]>>;
  /** 1 para una sola imagen (producto, amenidad); hasta 10 para una galería. */
  maxImages?: number;
  /** Nombre del registro, para el texto alternativo de las vistas previas. */
  recordName?: string;
  disabled?: boolean;
};

const MAX_SIZE_MB = MEDIA_LIMITS.maxFileSizeBytes / (1024 * 1024);

/**
 * Carga, vista previa, orden, imagen principal y borrado de imágenes de un
 * registro de catálogo. Cada archivo se sube al elegirlo; el formulario dueño
 * envía la lista al guardar (ver shared/utils/mediaGallery.ts).
 */
export function ImageGalleryField({
  label,
  target,
  items,
  onChange,
  maxImages = MEDIA_LIMITS.maxImagesPerRecord,
  recordName,
  disabled = false,
}: ImageGalleryFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef(new Map<string, File>());
  const itemsRef = useRef(items);
  const [notice, setNotice] = useState<string | null>(null);
  const labelId = useId();
  const helpId = useId();
  const single = maxImages === 1;

  itemsRef.current = items;

  // Libera las vistas previas locales al cerrar el formulario.
  useEffect(
    () => () => {
      itemsRef.current.forEach(releaseGalleryPreview);
    },
    [],
  );

  function updateItem(key: string, patch: Partial<GalleryItem>) {
    onChange((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function upload(key: string, file: File) {
    updateItem(key, { status: 'uploading', error: undefined });
    try {
      const uploaded = await mediaService.uploadImage(target, file);
      filesRef.current.delete(key);
      updateItem(key, { status: 'ready', mediaId: uploaded.id, pendingUpload: true });
    } catch (cause) {
      updateItem(key, {
        status: 'error',
        error: cause instanceof Error ? cause.message : 'No fue posible subir la imagen.',
      });
    }
  }

  function removeItem(key: string) {
    const item = itemsRef.current.find((current) => current.key === key);
    if (!item) return;
    releaseGalleryPreview(item);
    filesRef.current.delete(key);
    if (item.pendingUpload && item.mediaId) {
      void mediaService.deletePendingImage(item.mediaId).catch(() => {
        // Si falla, la limpieza programada del backend la borra al vencer.
      });
    }
    onChange((current) => current.filter((currentItem) => currentItem.key !== key));
  }

  function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;

    // Una sola imagen: elegir otra reemplaza la actual.
    if (single) itemsRef.current.forEach((item) => removeItem(item.key));

    const slots = single ? 1 : remainingGallerySlots(itemsRef.current, maxImages);
    const accepted = files.slice(0, slots);
    setNotice(
      files.length > accepted.length
        ? `Solo se pueden tener ${maxImages} imágenes; se ignoraron ${files.length - accepted.length}.`
        : null,
    );

    const added: GalleryItem[] = accepted.map((file) => {
      const invalid = validateImageFile(file);
      const key = nextGalleryKey();
      if (!invalid) filesRef.current.set(key, file);
      return {
        key,
        fileName: file.name,
        localPreviewUrl: invalid ? undefined : URL.createObjectURL(file),
        altText: '',
        status: invalid ? 'error' : 'uploading',
        error: invalid ?? undefined,
        pendingUpload: false,
      };
    });
    onChange((current) => [...current, ...added]);
    added.forEach((item) => {
      const file = filesRef.current.get(item.key);
      if (file) void upload(item.key, file);
    });
  }

  const full = !single && items.length >= maxImages;
  const addLabel = single
    ? items.length > 0
      ? 'Reemplazar imagen'
      : 'Subir imagen'
    : 'Agregar imágenes';

  return (
    <div className="image-gallery-field" role="group" aria-labelledby={labelId}>
      <div className="image-gallery-field__header">
        <span id={labelId} className="image-gallery-field__label">
          {label}
        </span>
        <span id={helpId} className="image-gallery-field__help">
          JPEG, PNG o WebP de hasta {MAX_SIZE_MB} MB
          {single
            ? '.'
            : `; hasta ${maxImages} imágenes. La primera es la principal en el catálogo.`}
        </span>
      </div>

      {items.length > 0 ? (
        <ol
          className={`image-gallery-field__list${single ? ' image-gallery-field__list--single' : ''}`}
        >
          {items.map((item, index) => {
            const name = item.fileName ?? recordName ?? label;
            const position = `${index + 1} de ${items.length}`;
            const canRetry = item.status === 'error' && filesRef.current.has(item.key);
            return (
              <li className="image-gallery-field__card" key={item.key}>
                <div className="image-gallery-field__preview">
                  {item.localPreviewUrl ? (
                    <img src={item.localPreviewUrl} alt={`Vista previa de ${name}`} />
                  ) : (
                    <CatalogImage
                      image={item.image}
                      variant="thumb"
                      alt={item.altText || `Imagen de ${name}`}
                      placeholderLabel={item.status === 'error' ? 'Archivo no válido' : undefined}
                      staffFallback
                    />
                  )}
                  {!single && index === 0 && item.status !== 'error' ? (
                    <span className="image-gallery-field__badge">
                      <Star aria-hidden="true" /> Principal
                    </span>
                  ) : null}
                  {item.status === 'uploading' ? (
                    <span className="image-gallery-field__overlay" role="status">
                      Subiendo…
                    </span>
                  ) : null}
                </div>

                {item.status === 'error' ? (
                  <p className="image-gallery-field__error" role="alert">
                    {item.error}
                  </p>
                ) : (
                  <label className="image-gallery-field__alt">
                    <span>Descripción (texto alternativo)</span>
                    <input
                      value={item.altText}
                      maxLength={255}
                      disabled={disabled}
                      placeholder="Ej. Cama king con vista al jardín"
                      onChange={(event) => updateItem(item.key, { altText: event.target.value })}
                    />
                  </label>
                )}

                <div className="image-gallery-field__actions">
                  {!single ? (
                    <>
                      <button
                        type="button"
                        className="image-gallery-field__icon-button"
                        aria-label={`Mover imagen ${position} hacia atrás`}
                        title="Mover antes"
                        disabled={disabled || index === 0}
                        onClick={() =>
                          onChange((current) => moveGalleryItem(current, index, index - 1))
                        }
                      >
                        <ArrowLeft aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="image-gallery-field__icon-button"
                        aria-label={`Mover imagen ${position} hacia adelante`}
                        title="Mover después"
                        disabled={disabled || index === items.length - 1}
                        onClick={() =>
                          onChange((current) => moveGalleryItem(current, index, index + 1))
                        }
                      >
                        <ArrowRight aria-hidden="true" />
                      </button>
                      {index > 0 && item.status !== 'error' ? (
                        <button
                          type="button"
                          className="image-gallery-field__text-button"
                          disabled={disabled}
                          onClick={() =>
                            onChange((current) => makePrimaryGalleryItem(current, index))
                          }
                        >
                          Hacer principal
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  {canRetry ? (
                    <button
                      type="button"
                      className="image-gallery-field__icon-button"
                      aria-label={`Reintentar la carga de la imagen ${position}`}
                      title="Reintentar"
                      disabled={disabled}
                      onClick={() => {
                        const file = filesRef.current.get(item.key);
                        if (file) void upload(item.key, file);
                      }}
                    >
                      <RotateCcw aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="image-gallery-field__icon-button image-gallery-field__icon-button--danger"
                    aria-label={`Quitar imagen ${position}`}
                    title="Quitar"
                    disabled={disabled || item.status === 'uploading'}
                    onClick={() => removeItem(item.key)}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="image-gallery-field__empty">
          {single ? 'Sin imagen todavía.' : 'Sin imágenes todavía.'} Se mostrará un placeholder
          neutral.
        </p>
      )}

      {notice ? (
        <p className="image-gallery-field__notice" role="status">
          {notice}
        </p>
      ) : null}

      <input
        ref={inputRef}
        className="image-gallery-field__input"
        type="file"
        accept={MEDIA_ACCEPT}
        multiple={!single}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <button
        type="button"
        className="image-gallery-field__add"
        aria-describedby={helpId}
        disabled={disabled || full}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus aria-hidden="true" />
        {full ? `Máximo de ${maxImages} imágenes` : addLabel}
      </button>
    </div>
  );
}

export default ImageGalleryField;
