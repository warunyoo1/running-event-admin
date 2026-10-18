import type {
  EVENT_CATEGORIES,
  EVENT_IMAGE_KINDS,
  EVENT_THEMES,
  SHIRT_SIZES,
} from "../constants";

export type Role = "super_admin" | "reviewer" | "viewer";
export type OrderStatus =
  "pending" | "slip_uploaded" | "paid" | "rejected" | "expired" | "cancelled";
export type EventStatus = "draft" | "open" | "closed" | "upcoming";
export type Delivery = "pickup" | "shipping";
export type PaymentStatus = "submitted" | "approved" | "rejected" | "superseded";
export type EventTheme = (typeof EVENT_THEMES)[number];
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export type ShirtSize = (typeof SHIRT_SIZES)[number];
export type EventImageKind = (typeof EVENT_IMAGE_KINDS)[number];

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
/** Optional envelope fields the API adds to every JSON response (not read by the client yet). */
export type ApiEnvelopeFields = {
  statusCode?: number;
  success?: boolean;
  message?: string;
};
export type Paginated<T> = ApiEnvelopeFields & { data: T[]; meta: PageMeta };
export type PageQuery = { page?: number; pageSize?: number };

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Race = {
  id: string;
  name: string;
  price: number;
  quota: number;
  start: string | null;
  remaining: number;
};
export type EventImage = {
  id: string;
  kind: EventImageKind;
  alt: string;
  sortOrder: number;
  /** Public path (relative to the API), for the public site. */
  url: string;
  /** Same-origin admin path for thumbnails (also works for draft events). */
  previewUrl: string;
  mime: string;
  size: number;
  createdAt: string | null;
};
export type ImagePatchBody = { kind?: EventImageKind; alt?: string; sortOrder?: number };

export type AdminEvent = {
  id: string;
  name: string;
  slug: string;
  subtitle?: string;
  description?: string;
  date: string;
  venue: string;
  province?: string;
  category?: EventCategory;
  theme?: EventTheme;
  status: EventStatus;
  registrationEnds?: string;
  organizer?: string;
  refundPolicy?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  races: Race[];
  images: EventImage[];
};

export type Address = {
  street: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
};

export type AdminParticipant = {
  id: string;
  orderId: string;
  eventId: string;
  raceId: string;
  raceName: string;
  price: number;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  nationality: string;
  declineIdentity: boolean;
  idNumber: string;
  email?: string;
  phone: string;
  medical?: string;
  blood?: string;
  emergencyName?: string;
  emergencyRelation?: string;
  emergencyPhone?: string;
  province: string;
  team?: string;
  applicantType: string;
  size: ShirtSize;
  bibNo?: string;
  collected: boolean;
  collectedAt?: string;
  createdAt: string;
  updatedAt: string;
};
export type ParticipantRow = AdminParticipant & {
  orderNo: string;
  orderStatus: OrderStatus;
};

export type AdminOrderRow = {
  id: string;
  orderNo: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  participantCount: number;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  delivery: Delivery;
  address?: Address;
  subtotal: number;
  shippingFee: number;
  amount: number;
  status: OrderStatus;
  expiresAt?: string;
  trackingProvider?: string;
  trackingNo?: string;
  cancelReason?: string;
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  transactionRef?: string;
  paidAt?: string;
  slipUploadedAt?: string;
  createdAt: string;
  updatedAt: string;
};
export type Payment = {
  id: string;
  orderId: string;
  slipMime: string;
  amount: number;
  status: PaymentStatus;
  transactionRef?: string;
  rejectReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};
export type OrderDetail = AdminOrderRow & {
  participants: AdminParticipant[];
  payments: Payment[];
};

export type SlipTab = "waiting" | "history";
export type SlipRow = {
  orderId: string;
  orderNo: string;
  eventName: string;
  contactName: string;
  amount: number;
  status: OrderStatus;
  slipUploadedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  transactionRef?: string;
  paymentId: string | null;
};

export type ShippingMethod = Delivery;
export type ShippingParticipant = {
  id: string;
  name: string;
  race: string;
  size: ShirtSize;
  bibNo: string | null;
  collected: boolean;
};
export type ShippingRow = {
  orderId: string;
  orderNo: string;
  eventId: string;
  contactName: string;
  contactPhone: string;
  delivery: Delivery;
  address: Address | null;
  trackingProvider: string | null;
  trackingNo: string | null;
  participants: ShippingParticipant[];
  allCollected: boolean;
};

export type DashboardRace = {
  raceId: string;
  eventId: string;
  eventName: string;
  name: string;
  price: number;
  quota: number;
  reserved: number;
  remaining: number;
};
export type DashboardData = {
  orders: Record<OrderStatus, number>;
  totalOrders: number;
  pendingReview: number;
  paidRevenue: number;
  participants: number;
  races: DashboardRace[];
};

export type ReportSummary = {
  totals: { orders: number; paidOrders: number; paidRevenue: number };
  rows: {
    eventId: string;
    eventName: string;
    race: string;
    participants: number;
    paidParticipants: number;
    revenue: number;
  }[];
};
export type ShirtSizeReport = {
  status: OrderStatus;
  sizes: { size: ShirtSize; count: number }[];
  total: number;
  byRace: { race: string; sizes: Record<ShirtSize, number> }[];
};

export type LoginBody = { email: string; password: string };
export type ChangePasswordBody = { currentPassword: string; newPassword: string };
export type RaceBody = {
  id?: string;
  name: string;
  price: number;
  quota: number;
  start?: string;
};
export type EventBody = {
  name: string;
  slug: string;
  subtitle?: string;
  description?: string;
  date: string;
  venue: string;
  province?: string;
  category?: EventCategory;
  theme?: EventTheme;
  status: EventStatus;
  registrationEnds?: string;
  organizer?: string;
  refundPolicy?: string;
  races: RaceBody[];
};
export type ParticipantPatch = { collected?: boolean; bibNo?: string | null };
export type TrackingBody = { trackingProvider: string; trackingNo: string };
export type UserCreateBody = {
  name: string;
  email: string;
  password: string;
  role: Role;
};
export type UserPatchBody = {
  name?: string;
  role?: Role;
  active?: boolean;
  password?: string;
};

export type Query = Record<string, string | number | boolean | null | undefined>;
