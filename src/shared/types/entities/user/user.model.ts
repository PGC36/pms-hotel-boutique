export type UserRole =
  'admin' | 'guest' | 'reception' | 'housekeeping' | 'concierge' | 'roomService';
export type UserStatus = 'active' | 'inactive';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}
