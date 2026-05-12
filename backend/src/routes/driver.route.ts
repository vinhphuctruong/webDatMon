import {
  CodHoldStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
  WalletTransactionType,
  DispatchStatus,
} from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { prisma } from "../db/prisma";
import { requireAuth, requireRole } from "../middlewares/auth";
import { HttpError } from "../lib/http-error";
import { StatusCodes } from "http-status-codes";
import { ensureDriverWallets, holdWalletAmount, settleDeliveredOrder } from "../services/finance";
import {
  setDriverOnlineStatus,
  updateDriverPresence,
} from "../services/driver-presence";
import { acceptDispatch, rejectDispatch, classifyDispatchOfferKind } from "../services/dispatch-engine";

const driverRouter = Router();

driverRouter.use(requireAuth, requireRole(UserRole.DRIVER));

driverRouter.get(
  "/orders/dispatch/pending",
  asyncHandler(async (req, res) => {
    const driverId = req.user!.id;
    const now = new Date();

    const dispatches = await prisma.orderDispatch.findMany({
      where: {
        currentDriverId: driverId,
        status: DispatchStatus.OFFERED,
        offerExpiresAt: { gt: now },
        order: {
          status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING] },
        },
      },
      include: {
        order: {
          include: { store: true, items: true },
        },
        attempts: {
          where: { driverId, offered: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (dispatches.length === 0) {
      res.json({ data: [] });
      return;
    }

    const activeOrderCountForDriver = await prisma.order.count({
      where: {
        driverId,
        status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.PICKED_UP] },
      },
    });

    const payload = dispatches.map((dispatch) => {
      const attempt = dispatch.attempts[0];
      const isStackedOffer = activeOrderCountForDriver > 0;
      const bundleCount = isStackedOffer ? activeOrderCountForDriver + 1 : 1;
      const offerKind = classifyDispatchOfferKind({
        autoAcceptOrders: dispatch.order.store.autoAcceptOrders,
        isStackedOffer,
      });

      return {
        dispatchId: dispatch.id,
        orderId: dispatch.order.id,
        timeoutSeconds: 15,
        expiresAt: dispatch.offerExpiresAt?.toISOString(),
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
        distanceKm: attempt?.distanceKm,
        timeMinutes: attempt?.timeMinutes,
        isStacked: isStackedOffer,
        bundleCount,
        offerKind,
      };
    });

    res.json({ data: payload });
  }),
);
const claimableStatuses: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
];
const completableStatuses: OrderStatus[] = [
  OrderStatus.PICKED_UP,
];


const updateAvailabilitySchema = z.object({
  isOnline: z.boolean(),
});
const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
driverRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    if (!profile) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy hồ sơ tài xế");
    }

    res.json({ data: profile });
  }),
);

driverRouter.patch(
  "/availability",
  asyncHandler(async (req, res) => {
    const payload = updateAvailabilitySchema.parse(req.body);

    const updated = await prisma.driverProfile.update({
      where: { userId: req.user!.id },
      data: {
        isOnline: payload.isOnline,
      },
    });

    setDriverOnlineStatus(req.user!.id, payload.isOnline);

    res.json({ data: updated });
  }),
);

driverRouter.patch(
  "/location",
  asyncHandler(async (req, res) => {
    const payload = updateLocationSchema.parse(req.body);

    const profile = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.id },
      select: { isOnline: true },
    });

    if (!profile) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy hồ sơ tài xế");
    }

    const presence = updateDriverPresence(req.user!.id, {
      latitude: payload.latitude,
      longitude: payload.longitude,
      isOnline: profile.isOnline,
    });

    res.json({
      data: {
        latitude: presence.latitude,
        longitude: presence.longitude,
        isOnline: presence.isOnline,
        updatedAt: new Date(presence.updatedAt).toISOString(),
      },
    });
  }),
);

driverRouter.get(
  "/orders/available",
  asyncHandler(async (_req, res) => {
    // Free-pick flow has been deprecated.
    res.json({ data: [] });
  }),
);

driverRouter.get(
  "/orders/mine",
  asyncHandler(async (req, res) => {
    const myOrders = await prisma.order.findMany({
      where: {
        driverId: req.user!.id,
      },
      include: {
        store: true,
        items: true,
        payment: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ data: myOrders });
  }),
);

// ── Smart Dispatch: Accept exclusive offer ──────────────────────
driverRouter.post(
  "/orders/:orderId/accept-dispatch",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const driverId = req.user!.id;

    await acceptDispatch(orderId, driverId);

    // Now claim the order (same logic as claim)
    const profile = await prisma.driverProfile.findUnique({
      where: { userId: driverId },
      select: { isOnline: true },
    });

    if (!profile?.isOnline) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Bạn phải bật trạng thái online để nhận đơn");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          driverId: true,
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          codHoldStatus: true,
          merchantPayout: true,
          platformRevenue: true,
        },
      });

      if (!order) {
        throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new HttpError(StatusCodes.GONE, "Đơn hàng đã bị huỷ");
      }

      if (order.driverId && order.driverId !== driverId) {
        throw new HttpError(StatusCodes.CONFLICT, "Đơn hàng đã được tài xế khác nhận");
      }

      if (!claimableStatuses.includes(order.status)) {
        throw new HttpError(StatusCodes.BAD_REQUEST, "Đơn hàng không sẵn sàng để nhận");
      }

      if (
        order.paymentMethod === PaymentMethod.SEPAY_QR &&
        order.paymentStatus !== PaymentStatus.SUCCEEDED
      ) {
        throw new HttpError(StatusCodes.BAD_REQUEST, "Chưa thanh toán online cho đơn này");
      }

      if (order.paymentMethod === PaymentMethod.COD && order.codHoldStatus === CodHoldStatus.NONE) {
        const { creditWallet } = await ensureDriverWallets(tx, driverId);

        // ShopeeFood model: No minimum balance check.
        // Driver's wallet can go negative (debt). They keep the physical
        // cash collected from the customer to offset the debt.

        if (order.merchantPayout > 0) {
          await holdWalletAmount(tx, {
            walletId: creditWallet.id,
            type: WalletTransactionType.COD_HOLD,
            amount: order.merchantPayout,
            orderId: order.id,
            note: "Hold driver credit wallet for COD merchant settlement",
            allowNegativeAvailable: true,
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          driverId,
          // Don't change status to PICKED_UP - driver needs to go to store first
          codHoldAmount:
            order.paymentMethod === PaymentMethod.COD && order.codHoldStatus === CodHoldStatus.NONE
              ? order.merchantPayout
              : undefined,
          codHoldStatus:
            order.paymentMethod === PaymentMethod.COD && order.codHoldStatus === CodHoldStatus.NONE
              ? CodHoldStatus.HELD
              : undefined,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { store: true, items: true, payment: true },
      });
    });

    res.json({ data: updated });
  }),
);

// ── Smart Dispatch: Reject exclusive offer ──────────────────────
driverRouter.post(
  "/orders/:orderId/reject-dispatch",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    await rejectDispatch(orderId, req.user!.id);
    res.json({ message: "Đã từ chối đơn hàng" });
  }),
);

driverRouter.post(
  "/orders/:orderId/claim",
  asyncHandler(async (req, res) => {
    throw new HttpError(
      StatusCodes.GONE,
      "Luồng nhận đơn tự do đã bị tắt. Vui lòng nhận đơn từ pop-up phân công tự động.",
    );
  }),
);

// ── Mark food picked up from store ──────────────────────────────
driverRouter.post(
  "/orders/:orderId/pickup",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, driverId: true, status: true },
    });

    if (!order) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
    }

    if (order.driverId !== req.user!.id) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Bạn không được giao đơn hàng này");
    }

    if (order.status === OrderStatus.PICKED_UP) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Đơn hàng đã được lấy rồi");
    }

    if (order.status !== OrderStatus.PREPARING) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Quán chưa báo món xong, không thể lấy hàng");
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PICKED_UP },
      include: { store: true, items: true },
    });

    // Notify customer
    try {
      const io = (await import("../socket")).getIO();
      io.to(`order_${orderId}`).emit("order_status", { orderId, status: "PICKED_UP" });
    } catch (_) {}

    res.json({ data: updated });
  }),
);

driverRouter.post(
  "/orders/:orderId/complete",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, driverId: true, status: true },
    });

    if (!order) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
    }

    if (order.driverId !== req.user!.id) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Bạn không được giao đơn hàng này");
    }

    if (!completableStatuses.includes(order.status)) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Đơn hàng không ở trạng thái có thể giao");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await settleDeliveredOrder(tx, {
        orderId,
        settledBy: "DRIVER",
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          store: true,
          items: true,
          payment: true,
        },
      });
    });

    res.json({ data: updated });
  }),
);

export default driverRouter;
