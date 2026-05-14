/**
 * BullMQ Queue Infrastructure
 *
 * Provides order-related background job processing:
 * - Auto-cancel PENDING orders after timeout (store didn't respond)
 * - Auto-cancel PREPARING orders without driver after extended timeout
 * - Future: notification jobs, settlement retry, etc.
 */
import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { cancelOrderWithSettlementRollback } from "./finance";
import { getIO } from "../socket";
import {
  OrderStatus,
  UserRole,
  CancelRequestStatus,
} from "@prisma/client";

// ── Redis Connection ──────────────────────────────────

let connection: IORedis | null = null;

function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
    });
    connection.on("error", (err) => {
      console.warn("[Redis] Connection error:", err.message);
    });
    connection.on("connect", () => {
      console.log("[Redis] Connected to", env.REDIS_URL);
    });
  }
  return connection;
}

// ── Queue Definitions ─────────────────────────────────

const QUEUE_NAME = "order-timeout";

let orderTimeoutQueue: Queue | null = null;

export function getOrderTimeoutQueue(): Queue {
  if (!orderTimeoutQueue) {
    orderTimeoutQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return orderTimeoutQueue;
}

// ── Job Types ─────────────────────────────────────────

interface OrderTimeoutPayload {
  orderId: string;
  type: "PENDING_TIMEOUT" | "NO_DRIVER_TIMEOUT";
}

// ── Constants ─────────────────────────────────────────

/** 10 minutes for store to accept a PENDING order */
export const PENDING_TIMEOUT_MS = 10 * 60_000;

/** 30 minutes for a PREPARING order without driver */
export const NO_DRIVER_TIMEOUT_MS = 30 * 60_000;

// ── Job Scheduling ────────────────────────────────────

/**
 * Schedule an auto-cancel job for a newly created order.
 * Called right after order creation (or payment confirmation).
 */
export async function scheduleOrderPendingTimeout(orderId: string) {
  const queue = getOrderTimeoutQueue();
  const jobId = `pending-timeout:${orderId}`;
  try {
    await queue.add(
      "pending-timeout",
      { orderId, type: "PENDING_TIMEOUT" } satisfies OrderTimeoutPayload,
      {
        delay: PENDING_TIMEOUT_MS,
        jobId, // deduplicate
      },
    );
    console.log(
      `[Queue] Scheduled PENDING_TIMEOUT for order ${orderId} in ${PENDING_TIMEOUT_MS / 1000}s`,
    );
  } catch (err: any) {
    console.warn(
      `[Queue] Không schedule được PENDING_TIMEOUT cho order ${orderId} (Redis/Queue chưa sẵn sàng):`,
      err?.message ?? err,
    );
  }
}

/**
 * Schedule an auto-cancel job when order is confirmed but no driver found.
 * Called right after store confirms the order.
 */
export async function scheduleNoDriverTimeout(orderId: string) {
  const queue = getOrderTimeoutQueue();
  const jobId = `no-driver-timeout:${orderId}`;
  try {
    await queue.add(
      "no-driver-timeout",
      { orderId, type: "NO_DRIVER_TIMEOUT" } satisfies OrderTimeoutPayload,
      {
        delay: NO_DRIVER_TIMEOUT_MS,
        jobId, // deduplicate
      },
    );
    console.log(
      `[Queue] Scheduled NO_DRIVER_TIMEOUT for order ${orderId} in ${NO_DRIVER_TIMEOUT_MS / 1000}s`,
    );
  } catch (err: any) {
    console.warn(
      `[Queue] Không schedule được NO_DRIVER_TIMEOUT cho order ${orderId} (Redis/Queue chưa sẵn sàng):`,
      err?.message ?? err,
    );
  }
}

/**
 * Remove timeout jobs when an order progresses past a cancellable state.
 * E.g., store confirms → remove pending timeout.
 */
export async function removeOrderTimeoutJobs(orderId: string) {
  const queue = getOrderTimeoutQueue();
  try {
    await queue.remove(`pending-timeout:${orderId}`);
  } catch (_err) { /* job may not exist / queue down */ }
  try {
    await queue.remove(`no-driver-timeout:${orderId}`);
  } catch (_err) { /* job may not exist / queue down */ }
}

// ── Worker Logic ──────────────────────────────────────

async function processOrderTimeout(job: Job<OrderTimeoutPayload>) {
  const { orderId, type } = job.data;
  console.log(`[Queue] Processing ${type} for order ${orderId}`);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, driverId: true, userId: true },
  });

  if (!order) {
    console.log(`[Queue] Order ${orderId} not found, skipping`);
    return;
  }

  if (type === "PENDING_TIMEOUT") {
    if (order.status !== OrderStatus.PENDING) {
      console.log(`[Queue] Order ${orderId} is no longer PENDING (${order.status}), skipping`);
      return;
    }

    const reason = "Tự động huỷ: quán không xác nhận đơn trong 10 phút";

    const updated = await prisma.$transaction(async (tx) => {
      await cancelOrderWithSettlementRollback(tx, { orderId, reason });

      // Log cancellation
      await tx.orderCancellationLog.create({
        data: {
          orderId,
          userId: null, // system
          stage: OrderStatus.PENDING,
          reason,
          status: CancelRequestStatus.APPROVED, // auto-approved by system
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    });

    try {
      getIO().to(`user_${updated.userId}`).emit("order_cancellation_notice", {
        orderId: updated.id,
        action: "AUTO_CANCELLED",
        actorRole: "SYSTEM",
        cancelReason: reason,
      });
    } catch (err) {
      console.warn("[Socket] Unable to emit order_cancellation_notice", err);
    }

    console.log(`[Queue] Order ${orderId} auto-cancelled (PENDING_TIMEOUT)`);
  }

  if (type === "NO_DRIVER_TIMEOUT") {
    if (![OrderStatus.CONFIRMED, OrderStatus.PREPARING].includes(order.status as any)) {
      console.log(`[Queue] Order ${orderId} is ${order.status}, not eligible for NO_DRIVER timeout`);
      return;
    }
    if (order.driverId) {
      console.log(`[Queue] Order ${orderId} already has driver, skipping`);
      return;
    }

    const reason = "Tự động huỷ: không tìm được tài xế trong 30 phút";

    const updated = await prisma.$transaction(async (tx) => {
      await cancelOrderWithSettlementRollback(tx, { orderId, reason });

      await tx.orderCancellationLog.create({
        data: {
          orderId,
          userId: null,
          stage: order.status as OrderStatus,
          reason,
          status: CancelRequestStatus.APPROVED,
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    });

    try {
      getIO().to(`user_${updated.userId}`).emit("order_cancellation_notice", {
        orderId: updated.id,
        action: "AUTO_CANCELLED",
        actorRole: "SYSTEM",
        cancelReason: reason,
      });
    } catch (err) {
      console.warn("[Socket] Unable to emit order_cancellation_notice", err);
    }

    console.log(`[Queue] Order ${orderId} auto-cancelled (NO_DRIVER_TIMEOUT)`);
  }
}

// ── Worker Startup ────────────────────────────────────

let worker: Worker | null = null;

export function startOrderTimeoutWorker() {
  if (worker) return;

  const redis = getRedisConnection();

  // Start worker asynchronously so the API can still boot even if Redis is down.
  void (async () => {
    try {
      // Ensure Redis is reachable before creating Worker (avoid infinite error spam)
      await redis.connect();
      await redis.ping();
    } catch (err: any) {
      console.warn(
        "[Queue] Redis không sẵn sàng, tạm thời KHÔNG khởi động worker. " +
          "Hãy bật Redis hoặc cấu hình REDIS_URL đúng. Lỗi:",
        err?.message ?? err,
      );
      try {
        redis.disconnect();
      } catch { /* ignore */ }
      connection = null;
      return;
    }

    worker = new Worker(QUEUE_NAME, processOrderTimeout, {
      connection: redis,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1_000,
      },
    });

    worker.on("completed", (job) => {
      console.log(`[Queue] Job ${job.id} completed`);
    });

    worker.on("failed", (job, err) => {
      console.error(`[Queue] Job ${job?.id} failed:`, err.message);
    });

    worker.on("error", (err) => {
      console.warn("[Queue] Worker error:", err.message);
    });

    console.log("[Queue] Order timeout worker started");
  })();
}

/**
 * Graceful shutdown
 */
export async function stopOrderTimeoutWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (orderTimeoutQueue) {
    await orderTimeoutQueue.close();
    orderTimeoutQueue = null;
  }
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}
