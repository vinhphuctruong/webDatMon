import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { startDispatchTimer } from "./services/dispatch-engine";
import { updateDriverPresence } from "./services/driver-presence";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        console.warn("[SocketAuth] Missing token", {
          ip: socket.handshake.address,
          userAgent: socket.handshake.headers["user-agent"],
        });
        return next(new Error("Authentication error"));
      }

      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        sub?: string;
        id?: string;
        role?: string;
      };
      const userId = decoded.sub ?? decoded.id;
      if (!userId) {
        console.warn("[SocketAuth] Token payload missing user id", {
          hasSub: Boolean(decoded.sub),
          hasId: Boolean(decoded.id),
        });
        return next(new Error("Authentication error"));
      }
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { managedStore: true }
      });

      if (!user) {
        console.warn("[SocketAuth] User not found from token", { userId });
        return next(new Error("User not found"));
      }

      socket.data.user = user;
      next();
    } catch (err) {
      console.warn("[SocketAuth] Verify token failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user;
    console.log(`User connected: ${user.id} (${user.role})`);

    // Join room based on user role and id
    socket.join(`user_${user.id}`);
    if (user.role === "STORE_MANAGER") {
      socket.join(`store_manager_${user.id}`);
      if (user.managedStore?.id) {
         socket.join(`store_${user.managedStore.id}`);
      }
    } else if (user.role === "DRIVER") {
      socket.join(`driver_${user.id}`);
    }

    socket.on("driver_location_update", async (data: { latitude: number; longitude: number }) => {
      if (user.role !== "DRIVER") return;
      
      try {
        // Update in-memory presence so dispatch engine can find this driver
        updateDriverPresence(user.id, {
          latitude: data.latitude,
          longitude: data.longitude,
          isOnline: true,
        });

        const activeOrders = await prisma.order.findMany({
          where: {
            driverId: user.id,
            status: {
              in: ["CONFIRMED", "PREPARING", "PICKED_UP"]
            }
          },
          select: { id: true }
        });
        
        for (const order of activeOrders) {
          io.to(`order_${order.id}`).emit("driver_location_update", data);
        }
      } catch (err) {
        console.error("Error broadcasting driver location:", err);
      }
    });

    // Dispatch accept/reject via socket is intentionally disabled.
    // Driver must confirm from exclusive popup and call REST APIs:
    //   POST /drivers/orders/:orderId/accept-dispatch
    //   POST /drivers/orders/:orderId/reject-dispatch

    socket.on("join_order", (orderId: string) => {
      socket.join(`order_${orderId}`);
      console.log(`User ${user.id} joined order room ${orderId}`);
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${user.id}`);
    });
  });

  // Start the dispatch expire timer
  startDispatchTimer();

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
