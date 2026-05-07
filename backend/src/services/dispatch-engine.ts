/**
 * Smart Dispatch Engine — Hệ thống phân phối đơn thông minh
 *
 * Flow: Build Pool → Score → Exclusive Offer (15s) → Timeout → Next → Broadcast Fallback
 */

import { DispatchStatus, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { listFreshDriverPresences, DriverPresence } from "./driver-presence";
import { haversineDistanceKm } from "./delivery-fee";
import { calculateRouteWithVietmap } from "./vietmap.service";
import { getIO } from "../socket";

/* ── Constants ────────────────────────────────────────── */

const OFFER_TIMEOUT_SECONDS = 15;
const MAX_DISPATCH_ATTEMPTS = 5;
const MIN_POOL_SIZE = 3;
const RADIUS_TIERS_KM = [2, 5, 10];
const EXPIRE_CHECK_INTERVAL_MS = 3000;

/* ── Scoring weights ──────────────────────────────────── */

const WEIGHT_DISTANCE = 0.4;
const WEIGHT_PERFORMANCE = 0.3;
const WEIGHT_BATCHING = 0.2;
const WEIGHT_IDLE = 0.1;

/* ── Types ────────────────────────────────────────────── */

interface ScoredCandidate {
  driverId: string;
  score: number;
  distanceKm: number | null;
  timeMinutes: number | null;
}

/* ── Candidate Pool Builder ───────────────────────────── */

async function buildCandidatePool(
  storeLat: number,
  storeLng: number,
  excludeDriverIds: string[] = [],
): Promise<DriverPresence[]> {
  // Get all online driver IDs from DB
  const onlineDrivers = await prisma.driverProfile.findMany({
    where: { isOnline: true },
    select: { userId: true },
  });

  const allPresences = listFreshDriverPresences(
    onlineDrivers.map((d) => d.userId),
  );

  // Exclude drivers already attempted
  const available = allPresences.filter(
    (p) => !excludeDriverIds.includes(p.driverId),
  );

  // Dynamic radius: expand until we have enough candidates
  for (const radiusKm of RADIUS_TIERS_KM) {
    const inRadius = available.filter((p) => {
      const dist = haversineDistanceKm(storeLat, storeLng, p.latitude, p.longitude);
      return dist <= radiusKm;
    });

    if (inRadius.length >= MIN_POOL_SIZE) {
      return inRadius;
    }
  }

  // If still not enough, return all available
  return available;
}

/* ── Scoring Engine ───────────────────────────────────── */

async function scoreCandidate(
  candidate: DriverPresence,
  storeLat: number,
  storeLng: number,
): Promise<ScoredCandidate> {
  // 1. Distance score (40%) — lower distance = higher score
  let distanceKm: number | null = null;
  let timeMinutes: number | null = null;

  const route = await calculateRouteWithVietmap(
    candidate.latitude,
    candidate.longitude,
    storeLat,
    storeLng,
  );

  if (route) {
    distanceKm = route.distanceKm;
    timeMinutes = route.timeMinutes;
  } else {
    distanceKm = haversineDistanceKm(
      candidate.latitude,
      candidate.longitude,
      storeLat,
      storeLng,
    ) * 1.4;
    timeMinutes = (distanceKm / 30) * 60; // ~30km/h city average
  }

  // Normalize: 0km = 1.0, 10km = 0.0
  const distanceScore = Math.max(0, 1 - distanceKm / 10);

  // 2. Performance score (30%) — completion rate
  const [delivered, cancelled] = await Promise.all([
    prisma.order.count({
      where: { driverId: candidate.driverId, status: OrderStatus.DELIVERED },
    }),
    prisma.order.count({
      where: {
        driverId: candidate.driverId,
        status: OrderStatus.CANCELLED,
        note: { contains: "Tài xế" },
      },
    }),
  ]);

  const totalOrders = delivered + cancelled;
  const completionRate = totalOrders > 0 ? delivered / totalOrders : 0.8; // default 80%
  const performanceScore = completionRate;

  // 3. Batching score (20%) — is driver delivering nearby?
  const activeOrder = await prisma.order.findFirst({
    where: {
      driverId: candidate.driverId,
      status: OrderStatus.PICKED_UP,
    },
    select: { deliveryAddress: true },
  });

  let batchingScore = 0.5; // neutral
  if (activeOrder) {
    const addr = activeOrder.deliveryAddress as any;
    if (addr?.latitude && addr?.longitude) {
      const deliveryToStore = haversineDistanceKm(
        addr.latitude,
        addr.longitude,
        storeLat,
        storeLng,
      );
      // If delivery destination is within 2km of new store → good for batching
      batchingScore = deliveryToStore <= 2 ? 1.0 : deliveryToStore <= 5 ? 0.5 : 0.1;
    }
  }

  // 4. Idle time score (10%) — how long since last completed order
  const lastOrder = await prisma.order.findFirst({
    where: { driverId: candidate.driverId, status: OrderStatus.DELIVERED },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });

  let idleScore = 0.5;
  if (lastOrder?.completedAt) {
    const idleMinutes = (Date.now() - lastOrder.completedAt.getTime()) / 60000;
    // More idle = higher score (max at 30 min)
    idleScore = Math.min(1, idleMinutes / 30);
  }

  // Final weighted score
  const score =
    distanceScore * WEIGHT_DISTANCE +
    performanceScore * WEIGHT_PERFORMANCE +
    batchingScore * WEIGHT_BATCHING +
    idleScore * WEIGHT_IDLE;

  return {
    driverId: candidate.driverId,
    score: Math.round(score * 1000) / 1000,
    distanceKm: distanceKm != null ? Math.round(distanceKm * 100) / 100 : null,
    timeMinutes: timeMinutes != null ? Math.round(timeMinutes * 10) / 10 : null,
  };
}

/* ── Start Dispatch ───────────────────────────────────── */

export async function startDispatch(orderId: string) {
  const existingDispatch = await prisma.orderDispatch.findUnique({
    where: { orderId },
    select: { id: true },
  });
  if (existingDispatch) {
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { store: true, items: true, payment: true },
  });

  if (!order || !order.store.latitude || !order.store.longitude) {
    console.error(`[Dispatch] Cannot dispatch order ${orderId}: missing store coords`);
    return broadcastOrder(orderId);
  }

  const storeLat = order.store.latitude;
  const storeLng = order.store.longitude;

  // Build candidate pool
  const pool = await buildCandidatePool(storeLat, storeLng);

  if (pool.length === 0) {
    console.log(`[Dispatch] No drivers available for order ${orderId}, broadcasting`);
    return broadcastOrder(orderId);
  }

  // Score all candidates
  const scored = await Promise.all(
    pool.map((candidate) => scoreCandidate(candidate, storeLat, storeLng)),
  );

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top N
  const topCandidates = scored.slice(0, MAX_DISPATCH_ATTEMPTS);

  // Create dispatch record
  const dispatch = await prisma.orderDispatch.create({
    data: {
      orderId,
      status: DispatchStatus.PENDING,
      maxAttempts: MAX_DISPATCH_ATTEMPTS,
      attempts: {
        create: topCandidates.map((c) => ({
          driverId: c.driverId,
          score: c.score,
          distanceKm: c.distanceKm,
          timeMinutes: c.timeMinutes,
          offered: false,
        })),
      },
    },
  });

  console.log(
    `[Dispatch] Created dispatch for order ${orderId} with ${topCandidates.length} candidates`,
  );

  // Offer to first candidate
  await offerToNextDriver(dispatch.id);
}

/* ── Offer to Next Driver ─────────────────────────────── */

async function offerToNextDriver(dispatchId: string) {
  const dispatch = await prisma.orderDispatch.findUnique({
    where: { id: dispatchId },
    include: {
      attempts: {
        where: { offered: false },
        orderBy: { score: "desc" },
        take: 1,
      },
      order: {
        include: { store: true, items: true, payment: true },
      },
    },
  });

  if (!dispatch || dispatch.status === DispatchStatus.ACCEPTED) {
    return;
  }

  // Check if order still needs a driver
  if (dispatch.order.driverId) {
    await prisma.orderDispatch.update({
      where: { id: dispatchId },
      data: { status: DispatchStatus.ACCEPTED },
    });
    return;
  }

  const nextAttempt = dispatch.attempts[0];

  if (!nextAttempt) {
    // No more candidates → broadcast fallback
    console.log(`[Dispatch] No more candidates for order ${dispatch.orderId}, broadcasting`);
    await broadcastOrder(dispatch.orderId);
    await prisma.orderDispatch.update({
      where: { id: dispatchId },
      data: { status: DispatchStatus.BROADCAST, broadcastAt: new Date() },
    });
    return;
  }

  const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_SECONDS * 1000);

  // Mark attempt as offered & update dispatch
  await prisma.$transaction([
    prisma.dispatchAttempt.update({
      where: { id: nextAttempt.id },
      data: { offered: true },
    }),
    prisma.orderDispatch.update({
      where: { id: dispatchId },
      data: {
        status: DispatchStatus.OFFERED,
        currentDriverId: nextAttempt.driverId,
        offerExpiresAt: expiresAt,
        attemptCount: { increment: 1 },
      },
    }),
  ]);

  // Build offer payload
  const order = dispatch.order;
  const offerPayload = {
    dispatchId: dispatch.id,
    orderId: order.id,
    timeoutSeconds: OFFER_TIMEOUT_SECONDS,
    expiresAt: expiresAt.toISOString(),
    store: {
      id: order.store.id,
      name: order.store.name,
      address: order.store.address,
    },
    deliveryAddress: order.deliveryAddress,
    total: order.total,
    driverPayout: order.driverPayout,
    deliveryFee: order.deliveryFee,
    paymentMethod: order.paymentMethod,
    itemCount: order.items.length,
    distanceKm: nextAttempt.distanceKm,
    timeMinutes: nextAttempt.timeMinutes,
  };

  // Send exclusive offer to this driver only
  try {
    getIO().to(`driver_${nextAttempt.driverId}`).emit("dispatch_offer", offerPayload);
    console.log(
      `[Dispatch] Offered order ${order.id} to driver ${nextAttempt.driverId} (score: ${nextAttempt.score}, expires: ${OFFER_TIMEOUT_SECONDS}s)`,
    );
  } catch (err) {
    console.error("[Dispatch] Socket emit failed", err);
  }
}

/* ── Accept Dispatch ──────────────────────────────────── */

export async function acceptDispatch(orderId: string, driverId: string) {
  const dispatch = await prisma.orderDispatch.findUnique({
    where: { orderId },
    include: { attempts: true },
  });

  if (!dispatch) {
    throw new Error("Dispatch not found");
  }

  if (dispatch.status === DispatchStatus.ACCEPTED) {
    throw new Error("Đơn hàng đã được tài xế khác nhận");
  }

  if (dispatch.currentDriverId !== driverId) {
    throw new Error("Đơn hàng này không được chỉ định cho bạn");
  }

  // Mark accepted
  const attempt = dispatch.attempts.find(
    (a) => a.driverId === driverId && a.offered,
  );

  await prisma.$transaction([
    ...(attempt
      ? [
          prisma.dispatchAttempt.update({
            where: { id: attempt.id },
            data: { accepted: true, respondedAt: new Date() },
          }),
        ]
      : []),
    prisma.orderDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: DispatchStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    }),
  ]);

  // Expire notification for this driver
  try {
    getIO()
      .to(`driver_${driverId}`)
      .emit("dispatch_offer_expired", { orderId });
  } catch (_) {}

  console.log(`[Dispatch] Driver ${driverId} accepted order ${orderId}`);
}

/* ── Reject Dispatch ──────────────────────────────────── */

export async function rejectDispatch(orderId: string, driverId: string) {
  const dispatch = await prisma.orderDispatch.findUnique({
    where: { orderId },
  });

  if (!dispatch || dispatch.currentDriverId !== driverId) {
    return; // silently ignore
  }

  const attempt = await prisma.dispatchAttempt.findFirst({
    where: { dispatchId: dispatch.id, driverId, offered: true },
  });

  if (attempt) {
    await prisma.dispatchAttempt.update({
      where: { id: attempt.id },
      data: { accepted: false, respondedAt: new Date() },
    });
  }

  console.log(`[Dispatch] Driver ${driverId} rejected order ${orderId}`);

  // Move to next driver
  await offerToNextDriver(dispatch.id);
}

/* ── Broadcast Fallback ───────────────────────────────── */

async function broadcastOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { store: true, items: true, payment: true },
  });

  if (!order) return;

  // Import toOrderResponse inline to avoid circular deps
  const payload = {
    ...order,
    _broadcast: true,
  };

  try {
    getIO().emit("new_order_to_driver", payload);
    console.log(`[Dispatch] Broadcast order ${orderId} to all drivers`);
  } catch (err) {
    console.error("[Dispatch] Broadcast failed", err);
  }
}

/* ── Expired Offer Processor ──────────────────────────── */

async function processExpiredOffers() {
  try {
    const expired = await prisma.orderDispatch.findMany({
      where: {
        status: DispatchStatus.OFFERED,
        offerExpiresAt: { lt: new Date() },
      },
    });

    for (const dispatch of expired) {
      console.log(
        `[Dispatch] Offer expired for order ${dispatch.orderId} (driver: ${dispatch.currentDriverId})`,
      );

      // Mark the expired attempt
      if (dispatch.currentDriverId) {
        const attempt = await prisma.dispatchAttempt.findFirst({
          where: {
            dispatchId: dispatch.id,
            driverId: dispatch.currentDriverId,
            offered: true,
            accepted: null,
          },
        });

        if (attempt) {
          await prisma.dispatchAttempt.update({
            where: { id: attempt.id },
            data: { expiredAt: new Date() },
          });
        }

        // Notify driver their offer expired
        try {
          getIO()
            .to(`driver_${dispatch.currentDriverId}`)
            .emit("dispatch_offer_expired", { orderId: dispatch.orderId });
        } catch (_) {}
      }

      // Move to next driver
      await offerToNextDriver(dispatch.id);
    }
  } catch (err) {
    console.error("[Dispatch] Error processing expired offers:", err);
  }
}

/* ── Start Background Timer ───────────────────────────── */

let expireInterval: NodeJS.Timeout | null = null;

export function startDispatchTimer() {
  if (expireInterval) return;
  expireInterval = setInterval(processExpiredOffers, EXPIRE_CHECK_INTERVAL_MS);
  console.log("[Dispatch] Expire timer started (every 3s)");
}

export function stopDispatchTimer() {
  if (expireInterval) {
    clearInterval(expireInterval);
    expireInterval = null;
  }
}
