import { io, Socket } from "socket.io-client";
import { readSession } from "./api";

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

export async function initSocket() {
  // If socket exists and is connected, reuse it
  if (socket && socket.connected) return socket;

  // If socket exists but disconnected, clean it up
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const session = await readSession();
  const token = session?.accessToken || "";

  if (!token) return null;

  socket = io(resolveSocketUrl(), {
    auth: {
      token
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  });

  socket.on("connect", () => {
    console.log("Connected to Socket.io server", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("Disconnected from Socket.io server:", reason);
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
