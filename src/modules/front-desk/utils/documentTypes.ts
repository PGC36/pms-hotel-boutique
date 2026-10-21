import type { GuestDocumentTypeDto } from '@/shared/types/entities/guest';

/** Tipos de documento que acepta el backend (`DocumentType`). */
export const DOCUMENT_TYPE_OPTIONS: { value: GuestDocumentTypeDto; label: string }[] = [
  { value: 'national_id', label: 'DPI / identificación nacional' },
  { value: 'passport', label: 'Pasaporte' },
  { value: 'driver_license', label: 'Licencia de conducir' },
];

/** Normaliza el tipo de documento guardado (dominio o API) al valor del backend. */
export function toDocumentTypeDto(value?: string): GuestDocumentTypeDto | '' {
  if (value === 'nationalId' || value === 'national_id') return 'national_id';
  if (value === 'passport') return 'passport';
  if (value === 'driverLicense' || value === 'driver_license') return 'driver_license';
  return '';
}
