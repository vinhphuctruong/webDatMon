import { io, Socket } from "socket.io-client";
import { fetchMyProfile, readSession, refreshSession } from "./api";

let socket: Socket | null = null;

const DEFAULT_API_BASE_URL = "/api/v1";

function resolveSocketUrl() {
  const configuredBaseUrl =
    import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
  
  try {
    const url = new URL(configuredBaseUrl);
    return `${url.protocol}//${url.host}`;
  } catch (e) {
    if (typeof window !== "undefined") {
        return window.location.origin;
    }
    return "http://localhost:3000";
  }
}

function decodeJwtPayload(token: string) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded) as { sub?: string; role?: string; exp?: number };
  } catch (_error) {
    return null;
  }
}

export async function initSocket() {
  // If socket exists and is connected, reuse it
  if (socket && socket.connected) return socket;

  // If socket exists but disconnected, clean it up
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  // Force auth refresh path once so socket does not reuse stale access token forever
  try {
    await fetchMyProfile();
  } catch (_error) {}

  let session = await readSession();
  let token = session?.accessToken || "";

  // Refresh once proactively before connecting socket.
  const refreshedSession = await refreshSession();
  if (refreshedSession?.accessToken) {
    session = refreshedSession;
    token = refreshedSession.accessToken;
  }

  if (!token) {
    console.error("[Socket] Missing access token, skip socket connection");
    return null;
  }

  const jwt = decodeJwtPayload(token);
  const expiresInSec = jwt?.exp ? Math.floor(jwt.exp - Date.now() / 1000) : null;
  console.log("[Socket] Connecting", {
    socketUrl: resolveSocketUrl(),
    userId: jwt?.sub,
    role: jwt?.role,
    expiresInSec,
  });

  socket = io(resolveSocketUrl(), {
    auth: {
      token
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    console.log("Connected to Socket.io server", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("Disconnected from Socket.io server:", reason);
  });

  socket.on("connect_error", (error: any) => {
    console.error("[Socket] connect_error", {
      message: error?.message,
      description: error?.description,
      context: error?.context,
      data: error?.data,
    });
  });

  // If server rejects token, refresh once and reconnect with a fresh access token.
  socket.on("connect_error", async (error: any) => {
    if (error?.message !== "Authentication error") return;
    const latest = await refreshSession();
    const latestToken = latest?.accessToken;
    if (!latestToken) return;
    socket!.auth = { token: latestToken };
    socket!.connect();
  });

  // Wait for connection or timeout
  await new Promise<void>((resolve) => {
    if (socket!.connected) return resolve();
    const timeout = setTimeout(() => resolve(), 5000);
    socket!.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
