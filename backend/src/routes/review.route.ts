import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { requireAuth } from "../middlewares/auth";

export const reviewRouter = Router();

const createReviewSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

reviewRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { orderId, rating, comment } = createReviewSchema.parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
    }
    if (order.userId !== userId) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Bạn không có quyền đánh giá đơn hàng này");
    }
    if (order.status !== "DELIVERED") {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Chỉ có thể đánh giá đơn hàng đã giao thành công");
    }

    const existingReview = await prisma.review.findUnique({
      where: { orderId },
    });
    if (existingReview) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Đơn hàng này đã được đánh giá");
    }

    // Create review and update store/product rating in a transaction
    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          orderId,
          userId,
          storeId: order.storeId,
          rating,
          comment,
        },
      });

      // Simple rating update for store (average of all reviews)
      const storeReviews = await tx.review.aggregate({
        where: { storeId: order.storeId },
        _avg: { rating: true },
      });
      await tx.store.update({
        where: { id: order.storeId },
        data: { rating: storeReviews._avg.rating || rating },
      });

      return newReview;
    });

    res.status(StatusCodes.CREATED).json({ data: review });
  })
);

reviewRouter.get(
  "/my-reviews",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const reviews = await prisma.review.findMany({
      where: { userId },
      include: { store: { select: { name: true } }, order: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: reviews });
  })
);
