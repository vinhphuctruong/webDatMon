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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

const SESSION_KEY = "zaui_food_session";
const DEFAULT_API_BASE_URL = "/api/v1";

function resolveApiBaseUrl() {
  const configuredBaseUrl =
    import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
  const normalized = configuredBaseUrl.replace(/\/$/, "");

  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    const localHttpPattern = /^http:\/\/(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)(:\d+)?(\/.*)?$/i;
    if (localHttpPattern.test(normalized)) {
      return DEFAULT_API_BASE_URL;
    }
  }

  return normalized;
}

const API_BASE_URL = resolveApiBaseUrl();

let cachedSession: Session | null = null;

import { getStorage } from "zmp-sdk";

function readSessionSync(): Session | null {
  if (cachedSession) return cachedSession;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    cachedSession = parsed;
    return parsed;
  } catch (_error) {
    return null;
  }
}

export async function readSession(): Promise<Session | null> {
  if (cachedSession) return cachedSession;

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

    if (!raw) return null;

    const parsed = JSON.parse(raw) as Session;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    
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
  } catch (_error) {}
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

  headers.set("ngrok-skip-browser-warning", "true");

  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, { ...init, headers });

  let payload: any = null;
  try {
    payload = await response.clone().json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || `API request failed (${response.status})`;
    throw new ApiError(message, response.status, payload?.details);
  }

  return payload as T;
}

async function refreshAccessToken(current: Session): Promise<Session> {
  const payload = await request<{ tokens: Session }>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  writeSession(payload.tokens);
  return payload.tokens;
}

async function ensureSession() {
  const existing = await readSession();
  if (existing) return existing;
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
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    try {
      session = await refreshAccessToken(session);
      return await request<T>(path, init, session.accessToken);
    } catch (_refreshError) {
      writeSession(null);
      throw new ApiError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại", 401);
    }
  }
}

export function clearApiSession() {
  writeSession(null);
}

export async function loginWithCredentials(payload: LoginPayload): Promise<AuthUser> {
  const response = await request<{ user: AuthUser; tokens: Session }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ ...payload, role: "DRIVER" }),
  });
  writeSession(response.tokens);
  return response.user;
}

export async function registerDriverAccount(payload: {
  name: string;
  email: string;
  password: string;
  phone: string;
  vehicleType: string;
  licensePlate: string;
  otpCode: string;
}): Promise<AuthUser> {
  const response = await request<{ user: AuthUser; tokens: Session }>("/auth/register/driver", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  writeSession(response.tokens);
  return response.user;
}

export async function requestEmailOtp(email: string) {
  return request<{ message?: string; debugOtp?: string }>("/auth/email-otp/request-any", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function fetchMyProfile(): Promise<AuthUser & { createdAt?: string }> {
  return apiFetch<AuthUser & { createdAt?: string }>("/auth/me", undefined, { auth: true });
}

export async function updateMyProfile(payload: { name?: string; phone?: string | null }) {
  return apiFetch<{ data: AuthUser; message?: string }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  }, { auth: true });
}

export async function changeMyPassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ message?: string }>("/auth/change-password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  }, { auth: true });
}

export async function requestForgotPasswordOtp(email: string) {
  return request<{ message?: string; debugOtp?: string }>("/auth/forgot-password/request-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyForgotPasswordOtp(email: string, otpCode: string) {
  return request<{ verified: boolean; message?: string }>("/auth/forgot-password/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otpCode }),
  });
}

export async function resetPasswordWithOtp(payload: { email: string; otpCode: string; newPassword: string }) {
  return request<{ message?: string }>("/auth/forgot-password/reset", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function hasSession(): boolean {
  return !!readSessionSync();
}
