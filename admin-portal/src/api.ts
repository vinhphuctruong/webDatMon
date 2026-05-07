import type { SessionTokens, AdminUser, LoginResponse } from "./types";

const SESSION_KEY = "zaui_food_admin_portal_session";

function normalizeApiBase(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "/api/v1";
  return value.trim().replace(/\/+$/, "");
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

export const state: {
  tokens: SessionTokens | null;
  user: AdminUser | null;
} = { tokens: null, user: null };

export function saveSession() {
  if (!state.tokens || !state.user) return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ tokens: state.tokens, user: state.user }));
}

export function loadSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;
  try {
    const p = JSON.parse(raw) as { tokens: SessionTokens; user: AdminUser };
    state.tokens = p.tokens;
    state.user = p.user;
  } catch { localStorage.removeItem(SESSION_KEY); }
}

export function clearSession() {
  state.tokens = null;
  state.user = null;
  localStorage.removeItem(SESSION_KEY);
}

async function refreshAccessToken(): Promise<boolean> {
  if (!state.tokens?.refreshToken) return false;
  const r = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
  });
  if (!r.ok) { clearSession(); return false; }
  const p = (await r.json()) as LoginResponse;
  state.tokens = p.tokens; state.user = p.user; saveSession();
  return true;
}

let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: () => void) { onUnauthorized = fn; }

export async function api<T>(path: string, init: RequestInit = {}, auth = true, retry = true): Promise<T> {
  const h = new Headers(init.headers);
  const body = init.body;
  if (body && !(body instanceof FormData) && !h.has("Content-Type")) h.set("Content-Type", "application/json");
  if (auth && state.tokens?.accessToken) h.set("Authorization", `Bearer ${state.tokens.accessToken}`);

  const r = await fetch(`${API_BASE}${path}`, { ...init, headers: h });
  let payload: unknown = null;
  try { payload = await r.json(); } catch { payload = null; }

  if (r.status === 401 && auth && retry) {
    const ok = await refreshAccessToken();
    if (ok) return api<T>(path, init, auth, false);
  }

  if (!r.ok) {
    const msg = typeof payload === "object" && payload !== null
      ? (payload as any).message ?? (payload as any).error : undefined;
    if (r.status === 401 && auth) {
      clearSession();
      onUnauthorized?.();
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    throw new Error(msg || `Request failed (${r.status})`);
  }
  return payload as T;
}
