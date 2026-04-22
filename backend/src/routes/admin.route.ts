import { OrderStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth, requireRole } from "../middlewares/auth";
import { prisma } from "../db/prisma";

const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(UserRole.ADMIN));

adminRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalStores,
      totalProducts,
      totalOrders,
      pendingOrders,
      preparingOrders,
      deliveringOrders,
      deliveredToday,
      cancelledToday,
      revenueToday,
      statusGroups,
      latestOrders,
    ] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      prisma.store.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { status: OrderStatus.PREPARING } }),
      prisma.order.count({ where: { status: OrderStatus.PICKED_UP } }),
      prisma.order.count({
        where: {
          status: OrderStatus.DELIVERED,
          createdAt: { gte: today },
        },
      }),
      prisma.order.count({
        where: {
          status: OrderStatus.CANCELLED,
          createdAt: { gte: today },
        },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.PICKED_UP, OrderStatus.DELIVERED] },
          createdAt: { gte: today },
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          total: true,
          createdAt: true,
          store: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    res.json({
      data: {
        metrics: {
          totalUsers,
          totalStores,
          totalProducts,
          totalOrders,
          pendingOrders,
          preparingOrders,
          deliveringOrders,
          deliveredToday,
          cancelledToday,
          revenueToday: revenueToday._sum.total ?? 0,
        },
        orderStatusDistribution: statusGroups.map((item) => ({
          status: item.status,
          count: item._count._all,
        })),
        latestOrders,
      },
    });
  }),
);

export default adminRouter;
