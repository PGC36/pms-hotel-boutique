import type { ServiceRequestStatus } from '@/shared/constants/statuses';

export type { ServiceRequestStatus };

export type ServiceRequestType = 'housekeeping' | 'concierge' | 'maintenance' | 'other';

export interface ServiceRequest {
  id: string;
  bookingId: string;
  roomId: string;
  roomNumber?: string;
  guestId?: string;
  guestName?: string;
  responsibleUserId?: string;
  responsibleUserName?: string;
  responsibleUserEmail?: string;
  type: ServiceRequestType;
  description: string;
  status: ServiceRequestStatus;
  notes?: string;
  chargeId?: string;
  requestedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
