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

export interface DriverApplicationPayload {
  fullName: string;
  dateOfBirth: string;
  email: string;
  password: string;
  phone?: string;
  vehicleType: string;
  licensePlate: string;
  portraitImageData: string;
  idCardImageData: string;
  driverLicenseImageData: string;
  portraitQualityScore: number;
  idCardQualityScore: number;
  driverLicenseQualityScore: number;
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
const DEMO_EMAIL = import.meta.env.VITE_API_DEMO_EMAIL || "customer@zauifood.local";
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

function readSession(): Session | null {
  if (cachedSession) {
    return cachedSession;
  }

  try {
    const raw = localStorage.getItem(SESSION_KEY);
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
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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

async function ensureSession() {
  const existing = readSession();
  if (existing) {
    return existing;
  }
  if (isAutoDemoLoginBlocked()) {
    throw new ApiError("Vui lòng đăng nhập để tiếp tục", 401);
  }
  return loginDemo();
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
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    try {
      session = await refreshAccessToken(session);
      return await request<T>(path, init, session.accessToken);
    } catch (_refreshError) {
      writeSession(null);
      if (isAutoDemoLoginBlocked()) {
        throw new ApiError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại", 401);
      }
      session = await loginDemo();
      return request<T>(path, init, session.accessToken);
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
    body: JSON.stringify(payload),
  });

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

export async function submitDriverApplication(payload: DriverApplicationPayload) {
  const response = await request<{
    data: {
      id: string;
      status: string;
      createdAt: string;
    };
    message?: string;
  }>("/auth/partner/driver-application", {
    method: "POST",
    body: JSON.stringify(payload),
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

export async function cancelOrder(orderId: string, reason?: string) {
  return apiFetch<{ data: any }>(
    `/orders/${orderId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    { auth: true },
  );
}

export async function rejectOrderDriver(orderId: string, reason?: string) {
  return apiFetch<{ data: any }>(
    `/orders/${orderId}/driver-reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    { auth: true },
  );
}

export async function markOrderFailedDriver(orderId: string, reason?: string) {
  return apiFetch<{ data: any }>(
    `/orders/${orderId}/driver-failed`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    { auth: true },
  );
}
