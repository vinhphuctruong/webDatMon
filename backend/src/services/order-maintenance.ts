import { DispatchStatus, OrderStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { cancelOrderWithSettlementRollback } from "./finance";

const MAINTENANCE_INTERVAL_MS = 60_000;
const PENDING_AUTO_CANCEL_MS = 15 * 60_000;
const READY_NO_DRIVER_AUTO_CANCEL_MS = 30 * 60_000;
let hasLoggedMaintenanceSchemaMismatch = false;

function isMissingCancelRequestStatusColumn(error: unknown) {
  const err = error as { code?: string; meta?: { column?: string } };
  return err?.code === "P2022" && String(err?.meta?.column ?? "").includes("Order.cancelRequestStatus");
}

async function autoCancelPendingOrders() {
  const cutoff = new Date(Date.now() - PENDING_AUTO_CANCEL_MS);
  const staleOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING,
      createdAt: { lt: cutoff },
    },
    select: { id: true },
    take: 200,
  });

  for (const order of staleOrders) {
    await prisma.$transaction(async (tx) => {
      await cancelOrderWithSettlementRollback(tx, {
        orderId: order.id,
        reason: "Tự động huỷ: đơn PENDING quá 15 phút",
      });
    });
  }
}

async function autoCancelReadyWithoutDriverOrders() {
  const cutoff = new Date(Date.now() - READY_NO_DRIVER_AUTO_CANCEL_MS);
  const staleOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PREPARING,
      driverId: null,
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
    take: 200,
  });

  for (const order of staleOrders) {
    await prisma.$transaction(async (tx) => {
      await cancelOrderWithSettlementRollback(tx, {
        orderId: order.id,
        reason: "Tự động huỷ: đơn READY/PREPARING không có tài xế quá 30 phút",
      });
    });
  }
}

async function cleanupCancelledDispatches() {
  await prisma.orderDispatch.updateMany({
    where: {
      status: { in: [DispatchStatus.PENDING, DispatchStatus.OFFERED, DispatchStatus.BROADCAST] },
      order: {
        status: OrderStatus.CANCELLED,
      },
    },
    data: {
      status: DispatchStatus.EXPIRED,
      currentDriverId: null,
      offerExpiresAt: null,
    },
  });
}

async function runMaintenanceCycle() {
  await autoCancelPendingOrders();
  await autoCancelReadyWithoutDriverOrders();
  await cleanupCancelledDispatches();
}

let maintenanceInterval: NodeJS.Timeout | null = null;

export function startOrderMaintenanceTimer() {
  if (maintenanceInterval) return;
  maintenanceInterval = setInterval(() => {
    runMaintenanceCycle().catch((error) => {
      if (isMissingCancelRequestStatusColumn(error)) {
        if (!hasLoggedMaintenanceSchemaMismatch) {
          hasLoggedMaintenanceSchemaMismatch = true;
          console.error(
            "[OrderMaintenance] Missing DB column Order.cancelRequestStatus. Pausing maintenance timer. Run Prisma migration to resume.",
          );
        }
        if (maintenanceInterval) {
          clearInterval(maintenanceInterval);
          maintenanceInterval = null;
        }
        return;
      }
      console.error("[OrderMaintenance] maintenance cycle failed", error);
    });
  }, MAINTENANCE_INTERVAL_MS);
}

export function stopOrderMaintenanceTimer() {
  if (!maintenanceInterval) return;
  clearInterval(maintenanceInterval);
  maintenanceInterval = null;
}
