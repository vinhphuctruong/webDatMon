import { CancelRequestStatus, DispatchStatus, OrderStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { DriverPresence, listFreshDriverPresences } from "./driver-presence";
import { haversineDistanceKm } from "./delivery-fee";
import { calculateRouteWithVietmap } from "./vietmap.service";
import { getIO } from "../socket";

const OFFER_TIMEOUT_SECONDS = 15;
const EXPIRE_CHECK_INTERVAL_MS = 3000;
const DISPATCH_SCAN_INTERVAL_MS = 5000;
const MAX_DISPATCH_ATTEMPTS = 5;
const MIN_DRIVER_CREDIT_BALANCE = 10_000;
const MAX_ACTIVE_ORDERS_PER_DRIVER = 2;
const CANDIDATE_RADIUS_KM = [2, 5, 10, 20];
const ACTIVE_DRIVER_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.PICKED_UP,
];

const WEIGHT_DISTANCE = 0.45;
const WEIGHT_PERFORMANCE = 0.3;
const WEIGHT_STACKING = 0.15;
const WEIGHT_TIER = 0.1;
let hasLoggedDispatchSchemaMismatch = false;

type DispatchOfferKind = "PRIORITY" | "STACKED_PRIORITY" | "AUTO";
type ExpirePenaltyType = "SKIP" | "REJECT";

interface ScoredCandidate {
  driverId: string;
  score: number;
  distanceKm: number | null;
  timeMinutes: number | null;
}

interface DispatchDebugDriver {
  driverId: string;
  isOnline: boolean;
  hasFreshLocation: boolean;
  activeOrders: number;
  walletBalance: number;
  distanceKm: number | null;
  passHardFilters: boolean;
  reasons: string[];
}

function classifyDispatchOfferKind(input: {
  autoAcceptOrders?: boolean | null;
  isStackedOffer?: boolean;
}): DispatchOfferKind {
  if (input.autoAcceptOrders) return "AUTO";
  if (input.isStackedOffer) return "STACKED_PRIORITY";
  return "PRIORITY";
}

function getExpirePenaltyForOfferKind(kind: DispatchOfferKind): {
  penaltyType: ExpirePenaltyType;
  acceptanceDelta: number;
  cancellationDelta: number;
} {
  if (kind === "AUTO") {
    return {
      penaltyType: "REJECT",
      acceptanceDelta: -0.05,
      cancellationDelta: 0.01,
    };
  }
  return {
    penaltyType: "SKIP",
    acceptanceDelta: -0.03,
    cancellationDelta: 0,
  };
}

function isMissingCancelRequestStatusColumn(error: unknown) {
  const err = error as { code?: string; meta?: { column?: string } };
  return err?.code === "P2022" && String(err?.meta?.column ?? "").includes("Order.cancelRequestStatus");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getTierBoost(tier?: string | null) {
  switch ((tier || "BASIC").toUpperCase()) {
    case "PLATINUM":
      return 1;
    case "PRO":
      return 0.7;
    case "GOLD":
      return 0.55;
    case "SILVER":
      return 0.4;
    default:
      return 0.2;
  }
}

async function adjustDriverPerformanceRates(
  driverId: string,
  change: { acceptanceDelta?: number; cancellationDelta?: number },
) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { acceptanceRate: true, cancellationRate: true },
  });
  if (!profile) return;

  await prisma.driverProfile.update({
    where: { userId: driverId },
    data: {
      acceptanceRate: clamp(profile.acceptanceRate + (change.acceptanceDelta ?? 0), 0, 1),
      cancellationRate: clamp(profile.cancellationRate + (change.cancellationDelta ?? 0), 0, 1),
    },
  });
}

async function buildCandidatePool(
  storeLat: number,
  storeLng: number,
  options?: { requireCreditBalance?: boolean },
): Promise<DriverPresence[]> {
  const onlineProfiles = await prisma.driverProfile.findMany({
    where: { isOnline: true },
    select: { userId: true },
  });
  if (!onlineProfiles.length) return [];

  const onlineIds = onlineProfiles.map((p) => p.userId);
  const freshPresences = listFreshDriverPresences(onlineIds);
  if (!freshPresences.length) return [];

  const requireCreditBalance = options?.requireCreditBalance === true;

  const [activeCounts, creditWallets] = await Promise.all([
    prisma.order.groupBy({
      by: ["driverId"],
      where: {
        driverId: { in: onlineIds },
        status: { in: ACTIVE_DRIVER_ORDER_STATUSES },
      },
      _count: { _all: true },
    }),
    requireCreditBalance
      ? prisma.wallet.findMany({
          where: {
            ownerUserId: { in: onlineIds },
            type: "DRIVER_CREDIT",
          },
          select: { ownerUserId: true, availableBalance: true },
        })
      : Promise.resolve([]),
  ]);

  const activeMap = new Map<string, number>();
  activeCounts.forEach((item) => {
    if (item.driverId) activeMap.set(item.driverId, item._count._all);
  });
  const walletMap = new Map<string, number>();
  creditWallets.forEach((item) => {
    if (item.ownerUserId) walletMap.set(item.ownerUserId, item.availableBalance);
  });

  const hardFiltered = freshPresences.filter((presence) => {
    const activeOrders = activeMap.get(presence.driverId) ?? 0;
    const walletBalance = walletMap.get(presence.driverId) ?? 0;
    const hasEnoughCredit = !requireCreditBalance || walletBalance >= MIN_DRIVER_CREDIT_BALANCE;
    return activeOrders < MAX_ACTIVE_ORDERS_PER_DRIVER && hasEnoughCredit;
  });
  if (!hardFiltered.length) return [];

  for (const radiusKm of CANDIDATE_RADIUS_KM) {
    const inRadius = hardFiltered.filter((presence) => {
      const dist = haversineDistanceKm(storeLat, storeLng, presence.latitude, presence.longitude);
      return dist <= radiusKm;
    });
    if (inRadius.length > 0) return inRadius;
  }

  return hardFiltered;
}

async function scoreCandidate(
  candidate: DriverPresence,
  storeLat: number,
  storeLng: number,
): Promise<ScoredCandidate> {
  const [profile, ratingAgg, activeOrder] = await Promise.all([
    prisma.driverProfile.findUnique({
      where: { userId: candidate.driverId },
      select: { acceptanceRate: true, cancellationRate: true, tier: true },
    }),
    prisma.driverReview.aggregate({
      _avg: { rating: true },
      where: { driverId: candidate.driverId },
    }),
    prisma.order.findFirst({
      where: { driverId: candidate.driverId, status: OrderStatus.PICKED_UP },
      orderBy: { updatedAt: "desc" },
      select: { deliveryAddress: true },
    }),
  ]);

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
    distanceKm =
      haversineDistanceKm(candidate.latitude, candidate.longitude, storeLat, storeLng) * 1.35;
    timeMinutes = (distanceKm / 28) * 60;
  }

  const distanceScore = clamp(1 - distanceKm / 12, 0, 1);
  const normalizedRating = clamp((ratingAgg._avg.rating ?? 4) / 5, 0, 1);
  const acceptanceRate = clamp(profile?.acceptanceRate ?? 0.8, 0, 1);
  const cancellationRate = clamp(profile?.cancellationRate ?? 0.1, 0, 1);
  const performanceScore = clamp(
    acceptanceRate * 0.65 + normalizedRating * 0.3 - cancellationRate * 0.15,
    0,
    1,
  );

  let stackingScore = 0.35;
  const addr = activeOrder?.deliveryAddress as { latitude?: number; longitude?: number } | null;
  if (addr?.latitude != null && addr?.longitude != null) {
    const detourKm = haversineDistanceKm(addr.latitude, addr.longitude, storeLat, storeLng);
    stackingScore = detourKm <= 2 ? 1 : detourKm <= 5 ? 0.55 : 0.15;
  }

  const tierScore = getTierBoost(profile?.tier);

  const score =
    distanceScore * WEIGHT_DISTANCE +
    performanceScore * WEIGHT_PERFORMANCE +
    stackingScore * WEIGHT_STACKING +
    tierScore * WEIGHT_TIER;

  return {
    driverId: candidate.driverId,
    score: Number(score.toFixed(4)),
    distanceKm: Number(distanceKm.toFixed(2)),
    timeMinutes: Number(timeMinutes.toFixed(1)),
  };
}

async function buildDispatchAttempts(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { store: true },
  });
  if (!order) return null;
  if (order.status === OrderStatus.CANCELLED || order.driverId) return null;
  if (!order.store.latitude || !order.store.longitude) return null;

  const pool = await buildCandidatePool(order.store.latitude, order.store.longitude, {
    // Credit threshold only matters for COD flows.
    requireCreditBalance: order.paymentMethod === "COD",
  });
  if (!pool.length) return [];

  const scored = await Promise.all(
    pool.map((candidate) => scoreCandidate(candidate, order.store.latitude!, order.store.longitude!)),
  );
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_DISPATCH_ATTEMPTS);
}

async function offerToNextDriver(dispatchId: string) {
  const dispatch = await prisma.orderDispatch.findUnique({
    where: { id: dispatchId },
    include: {
      attempts: {
        where: { offered: false },
        orderBy: { score: "desc" },
        take: 1,
      },
      order: { include: { store: true, items: true } },
    },
  });
  if (!dispatch || dispatch.status === DispatchStatus.ACCEPTED) return;
  if (dispatch.order.status === OrderStatus.CANCELLED) {
    await prisma.orderDispatch.update({
      where: { id: dispatch.id },
      data: { status: DispatchStatus.EXPIRED, currentDriverId: null, offerExpiresAt: null },
    });
    return;
  }
  if (dispatch.order.driverId) {
    await prisma.orderDispatch.update({
      where: { id: dispatch.id },
      data: { status: DispatchStatus.ACCEPTED, offerExpiresAt: null, currentDriverId: null },
    });
    return;
  }

  const next = dispatch.attempts[0];
  if (!next) {
    await prisma.orderDispatch.update({
      where: { id: dispatch.id },
      data: { status: DispatchStatus.EXPIRED, currentDriverId: null, offerExpiresAt: null },
    });
    return;
  }

  const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_SECONDS * 1000);
  const activeOrderCountForDriver = await prisma.order.count({
    where: {
      driverId: next.driverId,
      status: { in: ACTIVE_DRIVER_ORDER_STATUSES },
    },
  });
  const isStackedOffer = activeOrderCountForDriver > 0;
  const bundleCount = isStackedOffer ? activeOrderCountForDriver + 1 : 1;
  const offerKind = classifyDispatchOfferKind({
    autoAcceptOrders: dispatch.order.store.autoAcceptOrders,
    isStackedOffer,
  });

  await prisma.$transaction([
    prisma.dispatchAttempt.update({
      where: { id: next.id },
      data: { offered: true },
    }),
    prisma.orderDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: DispatchStatus.OFFERED,
        currentDriverId: next.driverId,
        offerExpiresAt: expiresAt,
        attemptCount: { increment: 1 },
      },
    }),
  ]);

  try {
    getIO().to(`driver_${next.driverId}`).emit("dispatch_offer", {
      dispatchId: dispatch.id,
      orderId: dispatch.order.id,
      timeoutSeconds: OFFER_TIMEOUT_SECONDS,
      expiresAt: expiresAt.toISOString(),
      store: {
        id: dispatch.order.store.id,
        name: dispatch.order.store.name,
        address: dispatch.order.store.address,
        latitude: dispatch.order.store.latitude,
        longitude: dispatch.order.store.longitude,
      },
      deliveryAddress: dispatch.order.deliveryAddress,
      total: dispatch.order.total,
      driverPayout: dispatch.order.driverPayout,
      deliveryFee: dispatch.order.deliveryFee,
      paymentMethod: dispatch.order.paymentMethod,
      itemCount: dispatch.order.items.length,
      distanceKm: next.distanceKm,
      timeMinutes: next.timeMinutes,
      isStacked: isStackedOffer,
      bundleCount,
      offerKind,
    });
  } catch (error) {
    console.error("[Dispatch] Emit dispatch_offer failed", error);
  }
}

export async function startDispatch(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, driverId: true },
  });
  if (!order) return;
  if (order.status === OrderStatus.CANCELLED || order.driverId) return;
  if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PREPARING) return;

  const existing = await prisma.orderDispatch.findUnique({
    where: { orderId },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== DispatchStatus.EXPIRED) return;

  if (existing) {
    await prisma.orderDispatch.delete({ where: { id: existing.id } });
  }
  const attempts = await buildDispatchAttempts(orderId);
  if (!attempts || attempts.length === 0) return;

  const dispatch = await prisma.orderDispatch.create({
    data: {
      orderId,
      status: DispatchStatus.PENDING,
      maxAttempts: MAX_DISPATCH_ATTEMPTS,
      attempts: {
        create: attempts.map((item) => ({
          driverId: item.driverId,
          score: item.score,
          distanceKm: item.distanceKm,
          timeMinutes: item.timeMinutes,
          offered: false,
        })),
      },
    },
  });
  await offerToNextDriver(dispatch.id);
}

export async function restartDispatch(orderId: string) {
  const existing = await prisma.orderDispatch.findUnique({
    where: { orderId },
    select: { id: true },
  });
  if (existing) {
    await prisma.orderDispatch.delete({ where: { id: existing.id } });
  }
  await startDispatch(orderId);
}

export async function cancelDispatchForOrder(orderId: string, reason?: string) {
  const dispatch = await prisma.orderDispatch.findUnique({
    where: { orderId },
    include: {
      attempts: {
        where: { offered: true, accepted: null },
        select: { driverId: true },
      },
    },
  });
  if (!dispatch) return;

  const affectedDriverIds = new Set<string>();
  if (dispatch.currentDriverId) {
    affectedDriverIds.add(dispatch.currentDriverId);
  }
  dispatch.attempts.forEach((attempt) => {
    if (attempt.driverId) affectedDriverIds.add(attempt.driverId);
  });

  await prisma.orderDispatch.update({
    where: { id: dispatch.id },
    data: {
      status: DispatchStatus.EXPIRED,
      currentDriverId: null,
      offerExpiresAt: null,
    },
  });

  for (const driverId of affectedDriverIds) {
    try {
      getIO().to(`driver_${driverId}`).emit("dispatch_offer_cancelled", {
        orderId,
        reason: reason || "Đơn đã bị huỷ",
      });
    } catch {}
  }
}

export async function getDispatchDebugReport(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      store: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
        },
      },
      dispatch: {
        include: {
          attempts: {
            orderBy: { score: "desc" },
          },
        },
      },
    },
  });

  if (!order) {
    return {
      orderFound: false,
      reasons: ["ORDER_NOT_FOUND"],
    };
  }

  const orderReasons: string[] = [];
  if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PREPARING) {
    orderReasons.push("ORDER_STATUS_NOT_DISPATCHABLE");
  }
  if (order.status === OrderStatus.CANCELLED) {
    orderReasons.push("ORDER_CANCELLED");
  }
  if (order.driverId) {
    orderReasons.push("ORDER_ALREADY_HAS_DRIVER");
  }
  if (!order.store.latitude || !order.store.longitude) {
    orderReasons.push("STORE_LOCATION_MISSING");
  }
  if (order.cancelRequestStatus === CancelRequestStatus.APPROVED) {
    orderReasons.push("ORDER_CANCEL_APPROVED");
  }

  const onlineProfiles = await prisma.driverProfile.findMany({
    where: { isOnline: true },
    select: { userId: true },
  });
  const onlineIds = onlineProfiles.map((p) => p.userId);
  const freshPresences = listFreshDriverPresences(onlineIds);
  const freshPresenceMap = new Map<string, DriverPresence>();
  freshPresences.forEach((presence) => freshPresenceMap.set(presence.driverId, presence));

  const [activeCounts, creditWallets] = await Promise.all([
    onlineIds.length
      ? prisma.order.groupBy({
          by: ["driverId"],
          where: {
            driverId: { in: onlineIds },
            status: { in: ACTIVE_DRIVER_ORDER_STATUSES },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    onlineIds.length
      ? prisma.wallet.findMany({
          where: {
            ownerUserId: { in: onlineIds },
            type: "DRIVER_CREDIT",
          },
          select: { ownerUserId: true, availableBalance: true },
        })
      : Promise.resolve([]),
  ]);

  const activeMap = new Map<string, number>();
  activeCounts.forEach((item) => {
    if (item.driverId) activeMap.set(item.driverId, item._count._all);
  });
  const walletMap = new Map<string, number>();
  creditWallets.forEach((item) => {
    if (item.ownerUserId) walletMap.set(item.ownerUserId, item.availableBalance);
  });

  const hasStoreCoordinates = order.store.latitude != null && order.store.longitude != null;
  const requireCreditBalance = order.paymentMethod === "COD";
  const drivers: DispatchDebugDriver[] = onlineIds.map((driverId) => {
    const presence = freshPresenceMap.get(driverId);
    const activeOrders = activeMap.get(driverId) ?? 0;
    const walletBalance = walletMap.get(driverId) ?? 0;
    const reasons: string[] = [];

    if (!presence) reasons.push("DRIVER_LOCATION_STALE_OR_MISSING");
    if (activeOrders >= MAX_ACTIVE_ORDERS_PER_DRIVER) reasons.push("DRIVER_AT_CAPACITY");
    if (requireCreditBalance && walletBalance < MIN_DRIVER_CREDIT_BALANCE) {
      reasons.push("DRIVER_WALLET_BELOW_THRESHOLD");
    }

    let distanceKm: number | null = null;
    if (presence && hasStoreCoordinates) {
      distanceKm = haversineDistanceKm(
        order.store.latitude!,
        order.store.longitude!,
        presence.latitude,
        presence.longitude,
      );
      const inAnyRadius = CANDIDATE_RADIUS_KM.some((radius) => distanceKm! <= radius);
      if (!inAnyRadius) reasons.push("DRIVER_OUTSIDE_SEARCH_RADIUS");
    }

    return {
      driverId,
      isOnline: true,
      hasFreshLocation: Boolean(presence),
      activeOrders,
      walletBalance,
      distanceKm: distanceKm != null ? Number(distanceKm.toFixed(2)) : null,
      passHardFilters: reasons.length === 0,
      reasons,
    };
  });

  return {
    orderFound: true,
    order: {
      id: order.id,
      status: order.status,
      driverId: order.driverId,
      cancelRequestStatus: order.cancelRequestStatus,
      storeId: order.storeId,
      storeName: order.store.name,
      storeLatitude: order.store.latitude,
      storeLongitude: order.store.longitude,
    },
    dispatch: order.dispatch
      ? {
          id: order.dispatch.id,
          status: order.dispatch.status,
          currentDriverId: order.dispatch.currentDriverId,
          attemptCount: order.dispatch.attemptCount,
          maxAttempts: order.dispatch.maxAttempts,
          offerExpiresAt: order.dispatch.offerExpiresAt,
          attempts: order.dispatch.attempts.map((item) => ({
            driverId: item.driverId,
            score: item.score,
            offered: item.offered,
            accepted: item.accepted,
            distanceKm: item.distanceKm,
            timeMinutes: item.timeMinutes,
            respondedAt: item.respondedAt,
            expiredAt: item.expiredAt,
          })),
        }
      : null,
    thresholds: {
      minDriverCreditBalance: MIN_DRIVER_CREDIT_BALANCE,
      maxActiveOrdersPerDriver: MAX_ACTIVE_ORDERS_PER_DRIVER,
      candidateRadiusKm: CANDIDATE_RADIUS_KM,
    },
    summary: {
      onlineDriverCount: onlineIds.length,
      freshLocationCount: freshPresences.length,
      eligibleDriverCount: drivers.filter((driver) => driver.passHardFilters).length,
    },
    orderReasons,
    drivers,
  };
}

export async function acceptDispatch(orderId: string, driverId: string) {
  const dispatch = await prisma.orderDispatch.findUnique({
    where: { orderId },
    include: { attempts: true },
  });
  if (!dispatch) throw new Error("Dispatch not found");
  if (dispatch.status === DispatchStatus.ACCEPTED) throw new Error("Đơn hàng đã có tài xế nhận");
  if (dispatch.currentDriverId !== driverId) throw new Error("Đơn hàng không được phân cho bạn");

  const attempt = dispatch.attempts.find((item) => item.driverId === driverId && item.offered);
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
      data: { status: DispatchStatus.ACCEPTED, acceptedAt: new Date(), offerExpiresAt: null },
    }),
  ]);
  await adjustDriverPerformanceRates(driverId, { acceptanceDelta: 0.02 });
}

export async function rejectDispatch(orderId: string, driverId: string) {
  const dispatch = await prisma.orderDispatch.findUnique({
    where: { orderId },
    include: {
      order: {
        select: {
          status: true,
        },
      },
    },
  });
  if (!dispatch || dispatch.currentDriverId !== driverId) return;
  if (dispatch.order.status === OrderStatus.CANCELLED) {
    await prisma.orderDispatch.update({
      where: { id: dispatch.id },
      data: { status: DispatchStatus.EXPIRED, currentDriverId: null, offerExpiresAt: null },
    });
    return;
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
  await adjustDriverPerformanceRates(driverId, { acceptanceDelta: -0.05, cancellationDelta: 0.01 });
  await offerToNextDriver(dispatch.id);
}

async function processExpiredOffers() {
  const expired = await prisma.orderDispatch.findMany({
    where: { status: DispatchStatus.OFFERED, offerExpiresAt: { lt: new Date() } },
    include: {
      order: {
        select: {
          status: true,
          store: {
            select: {
              autoAcceptOrders: true,
            },
          },
        },
      },
    },
  });
  for (const item of expired) {
    if (item.order.status === OrderStatus.CANCELLED) {
      await prisma.orderDispatch.update({
        where: { id: item.id },
        data: { status: DispatchStatus.EXPIRED, currentDriverId: null, offerExpiresAt: null },
      });
      continue;
    }
    if (item.currentDriverId) {
      const activeOrderCountForDriver = await prisma.order.count({
        where: {
          driverId: item.currentDriverId,
          status: { in: ACTIVE_DRIVER_ORDER_STATUSES },
        },
      });
      const offerKind = classifyDispatchOfferKind({
        autoAcceptOrders: item.order.store.autoAcceptOrders,
        isStackedOffer: activeOrderCountForDriver > 0,
      });
      const penalty = getExpirePenaltyForOfferKind(offerKind);

      await adjustDriverPerformanceRates(item.currentDriverId, {
        acceptanceDelta: penalty.acceptanceDelta,
        cancellationDelta: penalty.cancellationDelta,
      });

      const attempt = await prisma.dispatchAttempt.findFirst({
        where: {
          dispatchId: item.id,
          driverId: item.currentDriverId,
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
      try {
        getIO().to(`driver_${item.currentDriverId}`).emit("dispatch_offer_expired", {
          orderId: item.orderId,
          offerKind,
          penaltyType: penalty.penaltyType,
        });
      } catch {}
    }
    await offerToNextDriver(item.id);
  }
}

async function processPendingDispatchOrders() {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING] },
      driverId: null,
      cancelRequestStatus: { not: CancelRequestStatus.APPROVED },
    },
    select: { id: true },
    take: 100,
  });
  for (const order of orders) {
    try {
      await startDispatch(order.id);
    } catch (error) {
      console.error("[Dispatch] startDispatch loop failed", order.id, error);
    }
  }
}

let expireInterval: NodeJS.Timeout | null = null;
let pendingDispatchInterval: NodeJS.Timeout | null = null;

export function startDispatchTimer() {
  if (!expireInterval) {
    expireInterval = setInterval(() => {
      processExpiredOffers().catch((error) =>
        console.error("[Dispatch] processExpiredOffers failed", error),
      );
    }, EXPIRE_CHECK_INTERVAL_MS);
  }
  if (!pendingDispatchInterval) {
    pendingDispatchInterval = setInterval(() => {
      processPendingDispatchOrders().catch((error) => {
        if (isMissingCancelRequestStatusColumn(error)) {
          if (!hasLoggedDispatchSchemaMismatch) {
            hasLoggedDispatchSchemaMismatch = true;
            console.error(
              "[Dispatch] Missing DB column Order.cancelRequestStatus. Pausing dispatch scan timer. Run Prisma migration to resume.",
            );
          }
          if (pendingDispatchInterval) {
            clearInterval(pendingDispatchInterval);
            pendingDispatchInterval = null;
          }
          return;
        }
        console.error("[Dispatch] processPendingDispatchOrders failed", error);
      });
    }, DISPATCH_SCAN_INTERVAL_MS);
  }
}

export function stopDispatchTimer() {
  if (expireInterval) {
    clearInterval(expireInterval);
    expireInterval = null;
  }
  if (pendingDispatchInterval) {
    clearInterval(pendingDispatchInterval);
    pendingDispatchInterval = null;
  }
}
