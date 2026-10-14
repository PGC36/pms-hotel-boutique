import type { User } from '@/shared/types/entities/user';
import { toDomain as toUser, type UserDto } from '@/shared/types/entities/user';
import { toDomain as toRole, type Role } from '@/shared/types/entities/role';
import { toDomain as toPermission, type Permission } from '@/shared/types/entities/permission';
import type { ID } from '@/shared/types/common';
import { simulateLatency } from './mockUtils';
import { httpClient } from './http-client';

type ApiUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleCode: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

type ApiRole = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  permissions: string[];
};

type ApiPermission = {
  id: string;
  key: string;
  name: string;
  description?: string;
};

type CreateUserData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
};

type CreateRoleData = {
  code: string;
  name: string;
  active?: boolean;
  permissions: string[];
};

type UpdateRoleData = {
  name?: string;
  active?: boolean;
};

type UpdateUserData = {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  status: User['status'];
};

const apiRoleToUserRole: Record<string, User['role']> = {
  ADMIN: 'admin',
  GUEST: 'guest',
  RECEPTION: 'reception',
  HOUSEKEEPING: 'housekeeping',
  CONCIERGE: 'concierge',
  ROOM_SERVICE: 'roomService',
};

const normalizeRoleCode = (code: string): string => code.trim().toUpperCase();
const toUserRoleDto = (code: string): UserDto['role'] => {
  const role = apiRoleToUserRole[normalizeRoleCode(code)] ?? 'reception';
  return role === 'roomService' ? 'room_service' : role;
};

const toUserDto = (api: ApiUser): UserDto => ({
  id: api.id,
  first_name: api.firstName,
  last_name: api.lastName,
  email: api.email,
  role: toUserRoleDto(api.roleCode),
  status: api.status,
  created_at: api.createdAt,
  updated_at: api.updatedAt,
});

const toCreateUserRequest = (data: CreateUserData) => ({
  firstName: data.firstName.trim(),
  lastName: data.lastName.trim(),
  email: data.email.trim().toLowerCase(),
  password: data.password,
  roleId: data.roleId,
});

const toUpdateUserRequest = (data: UpdateUserData) => ({
  firstName: data.firstName.trim(),
  lastName: data.lastName.trim(),
  email: data.email.trim().toLowerCase(),
  roleId: data.roleId,
  status: data.status,
});

const toCreateRoleRequest = (data: CreateRoleData) => ({
  code: data.code.trim(),
  name: data.name.trim(),
  active: data.active ?? true,
  permissions: [...new Set(data.permissions)].sort(),
});

const toUpdateRoleRequest = (data: UpdateRoleData) => ({
  ...(data.name !== undefined ? { name: data.name.trim() } : {}),
  ...(data.active !== undefined ? { active: data.active } : {}),
});

const toRoleDto = (api: ApiRole) => {
  const timestamp = new Date().toISOString();
  return {
    id: api.id,
    code: apiRoleToUserRole[normalizeRoleCode(api.code)] ?? api.code.toLowerCase(),
    name: api.name,
    permission_ids: api.permissions,
    active: api.active,
    created_at: timestamp,
    updated_at: timestamp,
  };
};

const toPermissionDto = (permission: ApiPermission) => {
  const timestamp = new Date().toISOString();
  return {
    id: permission.id,
    key: permission.key,
    name: permission.name,
    description: permission.description,
    created_at: timestamp,
    updated_at: timestamp,
  };
};

export const personnelService = {
  async getUsers(): Promise<User[]> {
    await simulateLatency();
    const users = await httpClient.get<ApiUser[]>('/admin/users');
    return users.map(toUserDto).map(toUser);
  },
  async getUserById(id: ID): Promise<User | undefined> {
    await simulateLatency();
    try {
      const user = await httpClient.get<ApiUser>(`/admin/users/${id}`);
      return toUser(toUserDto(user));
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 404
      ) {
        return undefined;
      }
      throw error;
    }
  },
  async createUser(data: CreateUserData): Promise<User> {
    await simulateLatency();
    if (!data.firstName.trim()) throw new Error('El usuario requiere nombre.');
    if (!data.lastName.trim()) throw new Error('El usuario requiere apellido.');
    if (!data.email.trim()) throw new Error('El usuario requiere correo.');
    if (!data.password.trim()) throw new Error('El usuario requiere contrasena.');
    if (!data.roleId.trim()) throw new Error('El usuario requiere rol.');

    const user = await httpClient.post<ApiUser>('/admin/users', toCreateUserRequest(data));
    return toUser(toUserDto(user));
  },
  async updateUser(id: ID, data: Partial<UpdateUserData>): Promise<User> {
    await simulateLatency();

    const current = await this.getUserById(id);
    if (!current) throw new Error(`No existe el usuario ${id}.`);
    if (!data.roleId?.trim()) throw new Error('El usuario requiere rol.');
    const request = toUpdateUserRequest({
      firstName: data.firstName ?? current.firstName,
      lastName: data.lastName ?? current.lastName,
      email: data.email ?? current.email,
      roleId: data.roleId,
      status: data.status ?? current.status,
    });
    const user = await httpClient.put<ApiUser>(`/admin/users/${id}`, request);
    return toUser(toUserDto(user));
  },
  async getRoles(): Promise<Role[]> {
    await simulateLatency();
    const roles = await httpClient.get<ApiRole[]>('/admin/roles');
    return roles.map(toRoleDto).map(toRole);
  },
  async createRole(data: CreateRoleData): Promise<Role> {
    await simulateLatency();
    if (!data.code.trim()) throw new Error('El rol requiere codigo.');
    if (!data.name.trim()) throw new Error('El rol requiere nombre.');
    const role = await httpClient.post<ApiRole>('/admin/roles', toCreateRoleRequest(data));
    return toRole(toRoleDto(role));
  },
  async updateRole(id: ID, data: UpdateRoleData): Promise<Role> {
    await simulateLatency();
    const role = await httpClient.put<ApiRole>(`/admin/roles/${id}`, toUpdateRoleRequest(data));
    return toRole(toRoleDto(role));
  },
  async updateRolePermissions(id: ID, permissions: string[]): Promise<Role> {
    await simulateLatency();
    const role = await httpClient.put<ApiRole>(`/admin/roles/${id}/permissions`, {
      permissions: [...new Set(permissions)].sort(),
    });
    return toRole(toRoleDto(role));
  },
  async getPermissions(): Promise<Permission[]> {
    await simulateLatency();
    const permissions = await httpClient.get<ApiPermission[]>('/admin/permissions');
    return permissions.map(toPermissionDto).map(toPermission);
  },
};
export default personnelService;
