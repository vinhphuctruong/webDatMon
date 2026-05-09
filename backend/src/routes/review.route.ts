import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { requireAuth } from "../middlewares/auth";

export const reviewRouter = Router();

/**
 * GET /reviews/my-reviews — Lấy danh sách đánh giá của tôi
 */
reviewRouter.get(
  "/my-reviews",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const reviews = await prisma.review.findMany({
      where: { userId },
      include: {
        store: { select: { name: true } },
        order: { select: { items: true, driverReview: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: reviews });
  })
);

/**
 * GET /reviews/store/:storeId — Lấy đánh giá của cửa hàng
 */
reviewRouter.get(
  "/store/:storeId",
  asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [reviews, total, aggregate] = await Promise.all([
      prisma.review.findMany({
        where: { storeId },
        skip,
        take: limit,
        include: {
          user: { select: { name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.review.count({ where: { storeId } }),
      prisma.review.aggregate({
        where: { storeId },
        _avg: { rating: true },
      }),
    ]);

    res.json({
      data: reviews,
      stats: {
        totalReviews: total,
        averageRating: aggregate._avg.rating ?? 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  })
);

/**
 * GET /reviews/driver/:driverId — Lấy đánh giá tài xế
 */
reviewRouter.get(
  "/driver/:driverId",
  asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [reviews, total, aggregate] = await Promise.all([
      prisma.driverReview.findMany({
        where: { driverId },
        skip,
        take: limit,
        include: {
          user: { select: { name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.driverReview.count({ where: { driverId } }),
      prisma.driverReview.aggregate({
        where: { driverId },
        _avg: { rating: true },
      }),
    ]);

    res.json({
      data: reviews,
      stats: {
        totalReviews: total,
        averageRating: aggregate._avg.rating ?? 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  })
);
