export type UserRole = "CUSTOMER" | "ADMIN" | "STORE_MANAGER" | "DRIVER";
export type PartnerApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type TabKey = "overview" | "stores" | "driver-applications" | "store-applications" | "vouchers" | "categories" | "banners" | "users";

export interface SessionTokens { accessToken: string; refreshToken: string; }
export interface AdminUser { id: string; name: string; email: string; role: UserRole; }
export interface LoginResponse { user: AdminUser; tokens: SessionTokens; }
export interface ApiListResponse<T> { data: T; message?: string; }

export interface Store {
  id: string; name: string; address: string; rating: number;
  etaMinutesMin: number; etaMinutesMax: number; isOpen: boolean;
  manager: { id: string; name: string; email: string; } | null;
}

export interface DriverApplication {
  id: string; fullName: string; dateOfBirth: string; createdAt: string;
  email: string; phone: string | null; vehicleType: string; licensePlate: string;
  portraitImageData: string; idCardImageData: string; driverLicenseImageData: string;
  portraitQualityScore: number; idCardQualityScore: number; driverLicenseQualityScore: number;
  status: PartnerApplicationStatus; adminNote: string | null; reviewedAt: string | null;
}

export interface StoreApplication {
  id: string; storeName: string; storeAddress: string; storePhone: string;
  storeLatitude: number | null; storeLongitude: number | null;
  frontStoreImageData: string | null; businessLicenseImageData: string | null;
  status: PartnerApplicationStatus; adminNote: string | null; reviewedAt: string | null;
  createdAt: string;
  applicant: { id: string; name: string; email: string; phone: string | null; };
}

export interface OverviewMetrics {
  totalUsers: number; totalStores: number; totalProducts: number;
  totalOrders: number; pendingOrders: number; preparingOrders: number;
  deliveringOrders: number; deliveredToday: number; cancelledToday: number;
  revenueToday: number; pendingDriverApplications: number;
}

export interface OverviewOrderStatus { status: string; count: number; }
export interface OverviewLatestOrder {
  id: string; status: string; total: number; createdAt: string;
  store: { id: string; name: string; };
  user: { id: string; name: string; email: string; };
}

export interface OverviewPayload {
  metrics: OverviewMetrics;
  orderStatusDistribution: OverviewOrderStatus[];
  latestOrders: OverviewLatestOrder[];
}

export interface Voucher {
  id: string; code: string; description: string;
  scope?: "ORDER" | "SHIPPING";
  isClaimable?: boolean;
  maxClaimTotal?: number | null;
  claimedCount?: number;
  autoGrantOnRegister?: boolean;
  discountType: "FIXED" | "PERCENT"; discountValue: number;
  maxDiscount: number | null; minOrderValue: number;
  maxUsageTotal: number | null; maxUsagePerUser: number;
  usedCount: number; isActive: boolean;
  startsAt: string; expiresAt: string; createdAt: string;
  _count?: { usages: number };
}

export interface Category {
  id: string; key: string; name: string; slug: string; iconUrl: string | null;
}

export interface HeroBanner {
  id: string; title: string | null; imageUrl: string;
  link: string | null; sortOrder: number; isActive: boolean;
  createdAt: string;
}

export interface AdminUserItem {
  id: string; email: string; name: string; phone: string | null;
  role: UserRole; createdAt: string;
  _count: { orders: number };
}
