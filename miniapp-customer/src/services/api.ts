import { getStorage, setStorage } from "zmp-sdk";
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/* ── Global auth event bus ────────────────────────────────── */

type SessionEventCallback = (reason: string) => void;
const sessionExpiredListeners = new Set<SessionEventCallback>();

export function onSessionExpired(cb: SessionEventCallback) {
  sessionExpiredListeners.add(cb);
  return () => { sessionExpiredListeners.delete(cb); };
}

export function fireSessionExpired(reason: string) {
  writeSession(null);
  setAutoDemoLoginBlocked(true);
  for (const cb of sessionExpiredListeners) {
    try { cb(reason); } catch (_) { /* swallow */ }
  }
}

interface Session {
  accessToken: string;
  refreshToken: string;
}

type AppUserRole = "CUSTOMER" | "ADMIN" | "STORE_MANAGER" | "DRIVER";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: AppUserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterCustomerPayload {
  name: string;
  email: string;
  password: string;
  phone: string;
  otpCode: string;
}



export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

const SESSION_KEY = "zaui_food_session";
const AUTO_DEMO_LOGIN_BLOCK_KEY = "zaui_food_block_demo_auto_login";
const DEFAULT_API_BASE_URL = "/api/v1";

function resolveApiBaseUrl() {
  const configuredBaseUrl =
    import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
  const normalized = configuredBaseUrl.replace(/\/$/, "");

  // If the mini app is served over HTTPS, direct calls to local HTTP endpoints
  // are blocked by browsers. Fall back to the same-origin API path so Vite proxy can handle it.
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    const localHttpPattern = /^http:\/\/(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)(:\d+)?(\/.*)?$/i;
    if (localHttpPattern.test(normalized)) {
      return DEFAULT_API_BASE_URL;
    }
  }

  return normalized;
}

const API_BASE_URL = resolveApiBaseUrl();
const DEMO_EMAIL = import.meta.env.VITE_API_DEMO_EMAIL || "customer@tmfood.local";
const DEMO_PASSWORD = import.meta.env.VITE_API_DEMO_PASSWORD || "12345678";

let cachedSession: Session | null = null;

function isAutoDemoLoginBlocked() {
  try {
    return localStorage.getItem(AUTO_DEMO_LOGIN_BLOCK_KEY) === "1";
  } catch (_error) {
    return false;
  }
}

function setAutoDemoLoginBlocked(blocked: boolean) {
  try {
    if (blocked) {
      localStorage.setItem(AUTO_DEMO_LOGIN_BLOCK_KEY, "1");
      return;
    }
    localStorage.removeItem(AUTO_DEMO_LOGIN_BLOCK_KEY);
  } catch (_error) {
    // Ignore storage errors on restricted environments
  }
}

function getApiBaseCandidates() {
  if (API_BASE_URL === DEFAULT_API_BASE_URL) {
    return [API_BASE_URL];
  }

  // When external API host is unreachable (expired tunnel, DNS issue),
  // retry same-origin API path so local proxy/backend can still serve requests.
  return [API_BASE_URL, DEFAULT_API_BASE_URL];
}

export async function readSession(): Promise<Session | null> {
  if (cachedSession) {
    return cachedSession;
  }

  try {
    let raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      try {
        const result = await getStorage({ keys: [SESSION_KEY] });
        if (result && result[SESSION_KEY]) {
          raw = String(result[SESSION_KEY]);
          localStorage.setItem(SESSION_KEY, raw);
        }
      } catch (e) {}
    }
    
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }
    cachedSession = parsed;
    return parsed;
  } catch (_error) {
    return null;
  }
}

function writeSession(session: Session | null) {
  cachedSession = session;

  try {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      setStorage({ data: { [SESSION_KEY]: "" } }).catch(() => {});
      return;
    }
    const sessionStr = JSON.stringify(session);
    localStorage.setItem(SESSION_KEY, sessionStr);
    setStorage({ data: { [SESSION_KEY]: sessionStr } }).catch(() => {});
  } catch (_error) {
    // Ignore storage errors on restricted environments
  }
}

function normalizeTextErrorMessage(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  // Avoid surfacing full HTML pages as toast messages.
  if (/^<!doctype html>/i.test(trimmed) || /^<html/i.test(trimmed)) {
    return "";
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  // Bypass ngrok browser warning for local testing via ngrok
  headers.set("ngrok-skip-browser-warning", "true");

  let response: Response | undefined;
  let lastNetworkError: unknown;
  let attemptedUrl = `${API_BASE_URL}${path}`;

  for (const baseUrl of getApiBaseCandidates()) {
    attemptedUrl = `${baseUrl}${path}`;
    try {
      response = await fetch(attemptedUrl, {
        ...init,
        headers,
      });
      break;
    } catch (error) {
      lastNetworkError = error;
    }
  }

  if (!response) {
    throw new ApiError(`Network error while calling ${attemptedUrl}`, 0, {
      cause: lastNetworkError,
    });
  }

  let payload: any = null;
  let rawTextPayload = "";
  try {
    payload = await response.clone().json();
  } catch (_error) {
    payload = null;
    try {
      rawTextPayload = await response.text();
    } catch (_textError) {
      rawTextPayload = "";
    }
  }

  if (!response.ok) {
    const textMessage = normalizeTextErrorMessage(rawTextPayload);
    const message = payload?.message || textMessage || `API request failed (${response.status})`;
    throw new ApiError(message, response.status, payload?.details);
  }

  return payload as T;
}

async function loginDemo(): Promise<Session> {
  const payload = await request<{
    tokens: Session;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      role: "CUSTOMER",
    }),
  });

  setAutoDemoLoginBlocked(false);
  writeSession(payload.tokens);
  return payload.tokens;
}

async function refreshAccessToken(current: Session): Promise<Session> {
  const payload = await request<{
    tokens: Session;
  }>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({
      refreshToken: current.refreshToken,
    }),
  });

  writeSession(payload.tokens);
  return payload.tokens;
}

export async function refreshSession(): Promise<Session | null> {
  const current = await readSession();
  if (!current) return null;
  try {
    return await refreshAccessToken(current);
  } catch (_error: any) {
    if (_error instanceof ApiError && _error.status === 0) {
      return current;
    }
    writeSession(null);
    return null;
  }
}

async function ensureSession() {
  const existing = await readSession();
  if (existing) {
    return existing;
  }
  throw new ApiError("Vui lòng đăng nhập để tiếp tục", 401);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options?: { auth?: boolean },
): Promise<T> {
  const auth = options?.auth ?? false;

  if (!auth) {
    return request<T>(path, init);
  }

  let session = await ensureSession();

  try {
    return await request<T>(path, init, session.accessToken);
  } catch (error) {
    if (error instanceof ApiError) {
      // 403 from requireRole → user has wrong role, force re-login
      if (error.status === 403 && error.message.includes("không có quyền")) {
        fireSessionExpired("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại bằng tài khoản khách hàng.");
        throw error;
      }

      if (error.status !== 401) {
        throw error;
      }
    } else {
      throw error;
    }

    try {
      session = await refreshAccessToken(session);
      return await request<T>(path, init, session.accessToken);
    } catch (_refreshError: any) {
      if (_refreshError instanceof ApiError && _refreshError.status === 0) {
        throw _refreshError;
      }
      fireSessionExpired("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      throw new ApiError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại", 401);
    }
  }
}

export function clearApiSession() {
  writeSession(null);
  setAutoDemoLoginBlocked(true);
}

export function resumeAutoDemoLogin() {
  setAutoDemoLoginBlocked(false);
}

export function isAutoDemoLoginDisabled() {
  return isAutoDemoLoginBlocked();
}

export async function loginWithCredentials(payload: LoginPayload): Promise<AuthUser> {
  const response = await request<{
    user: AuthUser;
    tokens: Session;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ ...payload, role: "CUSTOMER" }),
  });

  // Validate: only CUSTOMER role is allowed in this mini-app
  if (response.user.role !== "CUSTOMER") {
    throw new ApiError(
      "Tài khoản này không phải tài khoản khách hàng. Vui lòng đăng nhập bằng email khách hàng.",
      403,
    );
  }

  setAutoDemoLoginBlocked(false);
  writeSession(response.tokens);
  return response.user;
}

export async function registerCustomerAccount(
  payload: RegisterCustomerPayload,
): Promise<AuthUser> {
  const response = await request<{
    user: AuthUser;
    tokens: Session;
  }>("/auth/register/customer", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  setAutoDemoLoginBlocked(false);
  writeSession(response.tokens);
  return response.user;
}

export async function requestEmailOtp(email: string) {
  const response = await request<{
    message?: string;
    expiresInSeconds?: number;
    retryAfterSeconds?: number;
    debugOtp?: string;
  }>("/auth/email-otp/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  return response;
}


export async function fetchMyProfile(): Promise<AuthUser & { createdAt?: string }> {
  return apiFetch<AuthUser & { createdAt?: string }>("/auth/me", undefined, {
    auth: true,
  });
}

export async function updateMyProfile(payload: UpdateProfilePayload) {
  const response = await apiFetch<{
    data: AuthUser & { createdAt?: string };
    message?: string;
  }>(
    "/auth/me",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
  return response;
}

export async function changeMyPassword(currentPassword: string, newPassword: string) {
  const response = await apiFetch<{ message?: string }>(
    "/auth/change-password",
    {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    },
    { auth: true },
  );
  return response;
}

export async function requestCancelOrder(orderId: string, reason?: string) {
  return apiFetch<{ data: any }>(
    `/orders/${orderId}/request-cancel`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    { auth: true },
  );
}

export async function requestForgotPasswordOtp(email: string) {
  const response = await request<{
    message?: string;
    expiresInSeconds?: number;
    retryAfterSeconds?: number;
    debugOtp?: string;
  }>("/auth/forgot-password/request-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return response;
}

export async function verifyForgotPasswordOtp(email: string, otpCode: string) {
  const response = await request<{ verified: boolean; message?: string }>(
    "/auth/forgot-password/verify-otp",
    {
      method: "POST",
      body: JSON.stringify({ email, otpCode }),
    },
  );
  return response;
}

export async function resetPasswordWithOtp(payload: {
  email: string;
  otpCode: string;
  newPassword: string;
}) {
  const response = await request<{ message?: string }>(
    "/auth/forgot-password/reset",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return response;
}

export async function submitReview(orderId: string, payload: {
  storeRating: number;
  driverRating?: number;
  productRatings?: { productId: string; rating: number; comment?: string }[];
  comment?: string;
  driverComment?: string;
}) {
  return apiFetch<{ data: any; message?: string }>(
    `/orders/${orderId}/reviews`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );
}

export async function confirmReceived(orderId: string) {
  return apiFetch<{ data: any; message?: string }>(
    `/orders/${orderId}/confirm-received`,
    { method: "POST" },
    { auth: true },
  );
}

export interface DeliveryFeeEstimate {
  storeId: string;
  storeName: string;
  fee: number;
  straightLineKm: number;
  roadDistanceKm: number;
  breakdown: {
    baseFee: number;
    midTierFee: number;
    farTierFee: number;
    rawTotal: number;
  };
}

export async function estimateDeliveryFee(params: {
  storeId: string;
  addressId?: string;
  latitude?: number;
  longitude?: number;
}): Promise<DeliveryFeeEstimate> {
  const query = new URLSearchParams({ storeId: params.storeId });
  if (params.addressId) query.set("addressId", params.addressId);
  if (params.latitude != null) query.set("latitude", String(params.latitude));
  if (params.longitude != null) query.set("longitude", String(params.longitude));

  const response = await request<{ data: DeliveryFeeEstimate }>(
    `/orders/estimate-delivery-fee?${query.toString()}`,
  );
  return response.data;
}

/* ── Voucher APIs ───────────────────────────────── */

export interface VoucherInfo {
  id: string;
  code: string;
  description: string;
  scope: "ORDER" | "SHIPPING";
  discountType: "FIXED" | "PERCENT";
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue: number;
  maxUsagePerUser: number;
  expiresAt: string;
}

export interface VoucherMarketItem extends VoucherInfo {
  maxUsageTotal?: number | null;
  usedCount?: number;
  maxClaimTotal?: number | null;
  claimedCount?: number;
  remainingClaims?: number | null;
  isSoldOut?: boolean;
  hasClaimed?: boolean;
}

export interface MyVoucherItem extends VoucherInfo {
  claimedAt: string;
  used: boolean;
  usedCountForUser: number;
  isExpired: boolean;
  notStarted: boolean;
}

export interface VoucherValidation {
  code: string;
  description: string;
  scope: "ORDER" | "SHIPPING";
  discountType: "FIXED" | "PERCENT";
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue: number;
  discount: number;
  expiresAt: string;
}

export async function fetchVoucherMarket(): Promise<VoucherMarketItem[]> {
  const res = await apiFetch<{ data: VoucherMarketItem[] }>("/vouchers/market", undefined, { auth: true });
  return res.data;
}

export async function fetchMyVouchers(): Promise<MyVoucherItem[]> {
  const res = await apiFetch<{ data: MyVoucherItem[] }>("/vouchers/my", undefined, { auth: true });
  return res.data;
}

export async function claimVoucherApi(code: string) {
  const res = await apiFetch<{ message: string; data?: any }>(
    "/vouchers/claim",
    { method: "POST", body: JSON.stringify({ code }) },
    { auth: true },
  );
  return res;
}

export async function validateVoucherApi(
  code: string,
  subtotal: number,
  deliveryFee: number,
): Promise<VoucherValidation> {
  const res = await apiFetch<{ data: VoucherValidation }>(
    "/vouchers/validate",
    {
      method: "POST",
      body: JSON.stringify({ code, subtotal, deliveryFee }),
    },
    { auth: true },
  );
  return res.data;
}
