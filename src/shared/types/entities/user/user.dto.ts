export type UserRoleDto =
  'admin' | 'guest' | 'reception' | 'housekeeping' | 'concierge' | 'room_service';
export type UserStatusDto = 'active' | 'inactive';

export interface UserDTO {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRoleDto;
  status: UserStatusDto;
  created_at: string;
  updated_at: string;
}

export type UserDto = UserDTO;
