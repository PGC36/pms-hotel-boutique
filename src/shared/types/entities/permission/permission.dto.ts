/** Permiso individual, referenciado por `role.permission_ids` (Lote D, WEB-12). */
export interface PermissionDTO {
  id: string;
  key: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export type PermissionDto = PermissionDTO;
