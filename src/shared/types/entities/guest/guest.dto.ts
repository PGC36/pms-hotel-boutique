export type GuestDocumentTypeDto = 'passport' | 'national_id' | 'driver_license';

export interface GuestDTO {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  nationality?: string;
  document_type?: GuestDocumentTypeDto;
  document_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type GuestDto = GuestDTO;
export type CreateGuestDto = Omit<GuestDTO, 'id' | 'created_at' | 'updated_at'>;
export type UpdateGuestDto = Partial<CreateGuestDto>;
