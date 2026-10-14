export interface Role {
  id: string;
  code: string;
  name: string;
  permissionIds: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
