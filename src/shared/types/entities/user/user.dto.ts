export type UserRoleDto =
  'admin' | 'guest' | 'reception' | 'housekeeping' | 'concierge' | 'room_service';
export type UserStatusDto = 'active' | 'inactive';

export interface UserDTO {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRoleDto;
  /**
   * Código real del rol en el backend (p. ej. `reception` o un rol personalizado
   * `qa_cesar`). `role` solo distingue los seis puestos predefinidos (D-003).
   */
  role_code?: string;
  status: UserStatusDto;
  created_at: string;
  updated_at: string;
}

export type UserDto = UserDTO;
