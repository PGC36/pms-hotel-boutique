// Barrel of DTO/Model *types* only, one folder per entity (dto/model/mapper).
// `toDomain`/`toDTO` are NOT re-exported here: every entity's mapper uses
// those exact two names, so re-exporting all of them from one barrel would
// collide. Import a mapper from its own entity path instead, e.g.
// `import { toDomain as toBooking } from '@/shared/types/entities/booking'`.
export type {
  AmenityDTO,
  AmenityDto,
  AmenityCategoryDto,
  Amenity,
  AmenityCategory,
} from './amenity';
export type {
  AuditLogDTO,
  AuditLogDto,
  AuditModuleDto,
  AuditActionDto,
  AuditLog,
  AuditModule,
  AuditAction,
} from './audit-log';
export type {
  BookingDTO,
  BookingDto,
  BookingStatusDto,
  CreateBookingDto,
  Booking,
  BookingStatus,
} from './booking';
export type {
  BookingCompanionDTO,
  BookingCompanionDto,
  BookingCompanionGuestTypeDto,
  UpsertBookingCompanionDto,
  BookingCompanion,
  BookingCompanionGuestType,
  UpsertBookingCompanion,
} from './booking-companion';
export type {
  CashMovementDTO,
  CashMovementDto,
  CashMovementTypeDto,
  CashMovement,
  CashMovementType,
} from './cash-movement';
export type {
  CashSessionDTO,
  CashSessionDto,
  CashSessionStatusDto,
  CashSession,
  CashSessionStatus,
} from './cash-session';
export type {
  ChargeDTO,
  ChargeDto,
  ChargeStatusDto,
  CreateChargeDto,
  Charge,
  ChargeStatus,
} from './charge';
export type {
  DepositDTO,
  DepositDto,
  DepositMethodDto,
  DepositStatusDto,
  Deposit,
  DepositMethod,
  DepositStatus,
} from './deposit';
export type {
  CreateGuestDto,
  GuestDTO,
  GuestDto,
  GuestDocumentTypeDto,
  UpdateGuestDto,
  Guest,
  GuestDocumentType,
} from './guest';
export type {
  GuestAccountDTO,
  GuestAccountDto,
  GuestAccountStatusDto,
  GuestAccount,
  GuestAccountStatus,
} from './guest-account';
export type {
  InventoryItemDTO,
  InventoryItemDto,
  InventoryItemCategoryDto,
  InventoryUnitDto,
  InventoryItem,
  InventoryItemCategory,
  InventoryUnit,
} from './inventory-item';
export type {
  InventoryMovementDTO,
  InventoryMovementDto,
  InventoryMovementTypeDto,
  InventoryMovementReasonDto,
  InventoryMovement,
  InventoryMovementType,
  InventoryMovementReason,
} from './inventory-movement';
export type {
  MediaImageDTO,
  MediaImageDto,
  MediaImageUrlsDto,
  MediaImageAssignmentDto,
  MediaTargetDto,
  MediaUploadDto,
  MediaVariantDto,
  MediaImage,
  MediaImageUrls,
  MediaImageAssignment,
  MediaTarget,
  MediaUpload,
  MediaVariant,
} from './media-image';
export type {
  OrderDTO,
  OrderDto,
  OrderStatusDto,
  OrderItemDto,
  CreateOrderDto,
  Order,
  OrderStatus,
  OrderItem,
} from './order';
export type {
  AddPaymentDto,
  PaymentDTO,
  PaymentDto,
  PaymentMethodDto,
  PaymentStatusDto,
  Payment,
  PaymentMethod,
  PaymentStatus,
} from './payment';
export type { PermissionDTO, PermissionDto, Permission } from './permission';
export type {
  ProductDTO,
  ProductDto,
  ProductCategoryDto,
  Product,
  ProductCategory,
} from './product';
export type { PromotionDto, Promotion } from './promotion';
export type { RateDTO, RateDto, Rate } from './rate';
export type { RoleDTO, RoleDto, Role } from './role';
export type {
  RoomDTO,
  RoomDto,
  RoomStatusDto,
  RoomHousekeepingStatusDto,
  CreateRoomDto,
  UpdateRoomDto,
  Room,
  RoomStatus,
  RoomHousekeepingStatus,
} from './room';
export type { RoomFeatureDTO, RoomFeatureDto, RoomFeature } from './room-feature';
export type { RoomTypeDto, RoomType } from './room-type';
export type {
  ServiceRequestDTO,
  ServiceRequestDto,
  ServiceRequestStatusDto,
  ServiceRequestTypeDto,
  CreateServiceRequestDto,
  ServiceRequest,
  ServiceRequestStatus,
  ServiceRequestType,
} from './service-request';
export type {
  UserDTO,
  UserDto,
  UserRoleDto,
  UserStatusDto,
  User,
  UserRole,
  UserStatus,
} from './user';

// `session/` (login/session response) is intentionally NOT re-exported here:
// it models a different concept than `user/` (PMS access role vs. staff job
// role) and importing both through one barrel risks a silent `User`/`UserDTO`
// name collision. Import it directly: `@/shared/types/entities/session`.
// See `src/modules/auth/README.md`.
