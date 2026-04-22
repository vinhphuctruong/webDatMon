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

const SESSION_KEY = "zaui_food_session";
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
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || `API request failed (${response.status})`;
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
      session = await loginDemo();
      return request<T>(path, init, session.accessToken);
    }
  }
}

export function clearApiSession() {
  writeSession(null);
}
