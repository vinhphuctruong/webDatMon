import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { acceptDispatch, rejectDispatch, startDispatchTimer } from "./services/dispatch-engine";

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
        return next(new Error("Authentication error"));
      }

      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { id: string; role: string };
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { managedStore: true }
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.data.user = user;
      next();
    } catch (err) {
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

    // Smart Dispatch: Driver accepts exclusive offer
    socket.on("dispatch_accept", async (data: { orderId: string }) => {
      if (user.role !== "DRIVER" || !data?.orderId) return;
      try {
        await acceptDispatch(data.orderId, user.id);
      } catch (err: any) {
        socket.emit("dispatch_error", { orderId: data.orderId, message: err.message });
      }
    });

    // Smart Dispatch: Driver rejects exclusive offer
    socket.on("dispatch_reject", async (data: { orderId: string }) => {
      if (user.role !== "DRIVER" || !data?.orderId) return;
      try {
        await rejectDispatch(data.orderId, user.id);
      } catch (err: any) {
        console.error("[Socket] Dispatch reject error:", err);
      }
    });

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
