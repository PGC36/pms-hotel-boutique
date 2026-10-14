import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { mediaService } from '@/services/mediaService';
import type { MediaImage, MediaVariant } from '@/shared/types/entities/media-image';
import './CatalogImage.css';

export type CatalogImageProps = {
  /** Imagen del backend. Sin imagen se muestra el placeholder neutral. */
  image?: MediaImage;
  variant?: MediaVariant;
  /** Texto alternativo si la imagen no trae uno propio (p. ej. el nombre del registro). */
  alt: string;
  /** Texto visible del placeholder. */
  placeholderLabel?: string;
  /**
   * Solo personal: si la URL pública falla (imagen de un registro inactivo),
   * pide la vista previa autenticada en vez de mostrar el placeholder.
   */
  staffFallback?: boolean;
  className?: string;
};

/**
 * Imagen de catálogo (tipo de habitación, producto, amenidad). Nunca inventa
 * una foto: si el registro no tiene imagen, o no carga, muestra un
 * placeholder neutral con su nombre.
 */
export function CatalogImage({
  image,
  variant = 'medium',
  alt,
  placeholderLabel,
  staffFallback = false,
  className,
}: CatalogImageProps) {
  const [failed, setFailed] = useState(false);
  const [staffUrl, setStaffUrl] = useState<string | null>(null);
  const imageId = image?.id;

  useEffect(() => {
    setFailed(false);
    setStaffUrl(null);
  }, [imageId, variant]);

  useEffect(() => {
    if (!failed || !staffFallback || !imageId) return undefined;
    let active = true;
    let objectUrl: string | null = null;
    mediaService
      .getStaffPreviewUrl(imageId, variant)
      .then((url) => {
        objectUrl = url;
        if (active) setStaffUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => {
        // Sin vista previa: queda el placeholder.
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [failed, staffFallback, imageId, variant]);

  const classes = ['catalog-image', className].filter(Boolean).join(' ');
  const src = staffUrl ?? (image && !failed ? image.urls[variant] : null);

  if (!src) {
    return (
      <div className={`${classes} catalog-image--placeholder`} role="img" aria-label={alt}>
        <ImageOff aria-hidden="true" className="catalog-image__icon" />
        {placeholderLabel ? <span>{placeholderLabel}</span> : null}
      </div>
    );
  }

  return (
    <img
      className={classes}
      src={src}
      alt={image?.altText || alt}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!staffUrl) setFailed(true);
      }}
    />
  );
}

export default CatalogImage;
