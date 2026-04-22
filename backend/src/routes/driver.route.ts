import {
  CodHoldStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
  WalletTransactionType,
} from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { prisma } from "../db/prisma";
import { requireAuth, requireRole } from "../middlewares/auth";
import { HttpError } from "../lib/http-error";
import { StatusCodes } from "http-status-codes";
import { ensureDriverWallets, holdWalletAmount, settleDeliveredOrder } from "../services/finance";

const driverRouter = Router();
const claimableStatuses: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
];
const completableStatuses: OrderStatus[] = [
  OrderStatus.PICKED_UP,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
];

driverRouter.use(requireAuth, requireRole(UserRole.DRIVER));

const updateAvailabilitySchema = z.object({
  isOnline: z.boolean(),
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
      throw new HttpError(StatusCodes.NOT_FOUND, "Driver profile not found");
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

    res.json({ data: updated });
  }),
);

driverRouter.get(
  "/orders/available",
  asyncHandler(async (_req, res) => {
    const available = await prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING],
        },
        driverId: null,
        OR: [
          {
            paymentMethod: PaymentMethod.COD,
          },
          {
            paymentMethod: PaymentMethod.SEPAY_QR,
            paymentStatus: PaymentStatus.SUCCEEDED,
          },
        ],
      },
      include: {
        store: true,
        items: true,
        payment: true,
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    res.json({ data: available });
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

driverRouter.post(
  "/orders/:orderId/claim",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const profile = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.id },
      select: { isOnline: true },
    });

    if (!profile?.isOnline) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "You must be online to claim order");
    }

    const updated = await prisma.$transaction(async (tx) => {
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
        throw new HttpError(StatusCodes.NOT_FOUND, "Order not found");
      }

      if (order.driverId && order.driverId !== req.user!.id) {
        throw new HttpError(StatusCodes.CONFLICT, "Order already claimed by another driver");
      }

      if (!claimableStatuses.includes(order.status)) {
        throw new HttpError(StatusCodes.BAD_REQUEST, "Order is not available for claiming");
      }

      if (
        order.paymentMethod === PaymentMethod.SEPAY_QR &&
        order.paymentStatus !== PaymentStatus.SUCCEEDED
      ) {
        throw new HttpError(
          StatusCodes.BAD_REQUEST,
          "Cashless payment has not been confirmed for this order",
        );
      }

      if (order.paymentMethod === PaymentMethod.COD && order.codHoldStatus === CodHoldStatus.NONE) {
        const { creditWallet } = await ensureDriverWallets(tx, req.user!.id);
        const requiredCredit = order.merchantPayout + order.platformRevenue;
        if (creditWallet.availableBalance < requiredCredit) {
          throw new HttpError(
            StatusCodes.BAD_REQUEST,
            `Insufficient credit wallet. Require at least ${requiredCredit} VND to claim this COD order`,
          );
        }

        if (order.merchantPayout > 0) {
          await holdWalletAmount(tx, {
            walletId: creditWallet.id,
            type: WalletTransactionType.COD_HOLD,
            amount: order.merchantPayout,
            orderId: order.id,
            note: "Hold driver credit wallet for COD merchant settlement",
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          driverId: req.user!.id,
          status: OrderStatus.PICKED_UP,
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

driverRouter.post(
  "/orders/:orderId/complete",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, driverId: true, status: true },
    });

    if (!order) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Order not found");
    }

    if (order.driverId !== req.user!.id) {
      throw new HttpError(StatusCodes.FORBIDDEN, "You are not assigned to this order");
    }

    if (!completableStatuses.includes(order.status)) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Order is not in deliverable status");
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
