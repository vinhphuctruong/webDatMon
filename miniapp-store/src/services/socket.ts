import { io, Socket } from "socket.io-client";

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

export function initSocket() {
  if (socket) return socket;

  const rawSession = localStorage.getItem("zaui_food_session");
  let token = "";
  if (rawSession) {
    try {
      const session = JSON.parse(rawSession);
      token = session.accessToken || "";
    } catch (e) {}
  }

  if (!token) return null;

  socket = io(resolveSocketUrl(), {
    auth: {
      token
    }
  });

  socket.on("connect", () => {
    console.log("Connected to Socket.io server", socket?.id);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from Socket.io server");
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
