import { PaymentStatus, UserRole, WalletTransactionType } from "@prisma/client";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { requireAuth } from "../middlewares/auth";
import {
  confirmCashlessPayment,
  createSePayReference,
  creditWalletAvailable,
} from "../services/finance";

const paymentRouter = Router();

const webhookSchema = z.object({
  referenceCode: z.string().min(3),
  sepayTransactionId: z.string().min(3).optional(),
  status: z.enum(["SUCCESS", "FAILED"]).default("SUCCESS"),
});

paymentRouter.post(
  "/sepay/webhook",
  asyncHandler(async (req, res) => {
    const payload = webhookSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      const payment = await tx.orderPayment.findUnique({
        where: {
          sepayReferenceCode: payload.referenceCode,
        },
      });

      if (payment) {
        if (payload.status === "FAILED") {
          await tx.orderPayment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.FAILED,
            },
          });
          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              paymentStatus: PaymentStatus.FAILED,
            },
          });
          return;
        }

        await confirmCashlessPayment(tx, {
          orderId: payment.orderId,
          sepayTransactionId:
            payload.sepayTransactionId ?? payment.sepayTransactionId ?? createSePayReference("SEPAYTXN"),
        });
        return;
      }

      const topup = await tx.sePayTopupRequest.findUnique({
        where: { referenceCode: payload.referenceCode },
      });

      if (!topup) {
        throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy mã tham chiếu SePay");
      }

      if (payload.status === "FAILED") {
        await tx.sePayTopupRequest.update({
          where: { id: topup.id },
          data: {
            status: "CANCELED",
          },
        });
        return;
      }

      if (topup.status !== "CONFIRMED") {
        await creditWalletAvailable(tx, {
          walletId: topup.walletId,
          type: WalletTransactionType.TOPUP_SEPAY,
          amount: topup.amount,
          topupId: topup.id,
          referenceCode: topup.referenceCode,
          note: "Driver credit wallet topup from SePay webhook",
        });
      }

      await tx.sePayTopupRequest.update({
        where: { id: topup.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          sepayTransactionId:
            payload.sepayTransactionId ?? topup.sepayTransactionId ?? createSePayReference("SEPAYTXN"),
        },
      });
    });

    res.status(StatusCodes.NO_CONTENT).send();
  }),
);

paymentRouter.use(requireAuth);

paymentRouter.get(
  "/orders/:orderId",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        storeId: true,
        driverId: true,
      },
    });

    if (!order) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
    }

    if (req.user!.role === UserRole.STORE_MANAGER) {
      const managedStore = await prisma.store.findFirst({
        where: { managerId: req.user!.id },
        select: { id: true },
      });

      if (!managedStore || managedStore.id !== order.storeId) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Không có quyền xem thanh toán này");
      }
    } else if (req.user!.role === UserRole.DRIVER) {
      if (order.driverId !== req.user!.id) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Không có quyền xem thanh toán này");
      }
    } else if (req.user!.role !== UserRole.ADMIN && order.userId !== req.user!.id) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Không có quyền xem thanh toán này");
    }

    const payment = await prisma.orderPayment.findUnique({
      where: { orderId },
    });

    if (!payment) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy bản ghi thanh toán");
    }

    res.json({ data: payment });
  }),
);

paymentRouter.post(
  "/orders/:orderId/sepay/confirm",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!order) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
    }

    if (req.user!.role !== UserRole.ADMIN && order.userId !== req.user!.id) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Không có quyền xác nhận thanh toán này");
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      await confirmCashlessPayment(tx, {
        orderId,
        sepayTransactionId: createSePayReference("SEPAY-MANUAL"),
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          payment: true,
        },
      });
    });

    res.json({ data: updatedOrder });
  }),
);

export default paymentRouter;
