/**
 * Catálogo de roles con su conjunto de permisos (Lote D, WEB-12). `code`
 * usa exactamente los mismos literales que `UserRoleDto` — no es una FK
 * real desde `user.role` (que sigue siendo el literal de puesto ya
 * publicado), sino una correspondencia por valor: todo `user.role` debe
 * tener un `role.code` igual en este catálogo. Ver
 * docs/DECISIONES.md D-003.
 */
export interface RoleDTO {
  id: string;
  code: string;
  name: string;
  permission_ids: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type RoleDto = RoleDTO;
