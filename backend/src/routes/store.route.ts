import { OrderStatus, PaymentMethod, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth, requireRole } from "../middlewares/auth";
import { HttpError } from "../lib/http-error";
import { StatusCodes } from "http-status-codes";
import { toProductResponse } from "../utils/mapper";

const storeRouter = Router();

const listStoreQuerySchema = z.object({
  q: z.string().optional(),
  isOpen: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === "true";
    }),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

const adminCreateStoreSchema = z.object({
  name: z.string().min(2).max(160),
  address: z.string().min(4).max(300),
  rating: z.coerce.number().min(0).max(5).optional().default(0),
  etaMinutesMin: z.coerce.number().int().min(5).max(120).optional().default(20),
  etaMinutesMax: z.coerce.number().int().min(5).max(180).optional().default(35),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  isOpen: z.boolean().optional().default(true),
  managerName: z.string().min(2).max(120),
  managerEmail: z.string().email(),
  managerPassword: z.string().min(8).max(64),
});

const adminUpdateStoreSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  address: z.string().min(4).max(300).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  etaMinutesMin: z.coerce.number().int().min(5).max(120).optional(),
  etaMinutesMax: z.coerce.number().int().min(5).max(180).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  isOpen: z.boolean().optional(),
});

const managerUpdateStoreSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  address: z.string().min(4).max(300).optional(),
  etaMinutesMin: z.coerce.number().int().min(5).max(120).optional(),
  etaMinutesMax: z.coerce.number().int().min(5).max(180).optional(),
  isOpen: z.boolean().optional(),
});

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

storeRouter.get(
  "/managed/me",
  requireAuth,
  requireRole(UserRole.STORE_MANAGER),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findFirst({
      where: { managerId: req.user!.id },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!store) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Chưa có cửa hàng nào được gán cho quản lý này");
    }

    res.json({ data: store });
  }),
);

storeRouter.patch(
  "/managed/me",
  requireAuth,
  requireRole(UserRole.STORE_MANAGER),
  asyncHandler(async (req, res) => {
    const payload = managerUpdateStoreSchema.parse(req.body);

    const store = await prisma.store.findFirst({
      where: { managerId: req.user!.id },
      select: { id: true },
    });

    if (!store) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Chưa có cửa hàng nào được gán cho quản lý này");
    }

    if (
      payload.etaMinutesMin !== undefined &&
      payload.etaMinutesMax !== undefined &&
      payload.etaMinutesMin > payload.etaMinutesMax
    ) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        "etaMinutesMin must be less than or equal etaMinutesMax",
      );
    }

    const updated = await prisma.store.update({
      where: { id: store.id },
      data: payload,
    });

    res.json({ data: updated });
  }),
);

storeRouter.patch(
  "/managed/toggle-open",
  requireAuth,
  requireRole(UserRole.STORE_MANAGER),
  asyncHandler(async (req, res) => {
    const payload = z.object({ isOpen: z.boolean() }).parse(req.body);

    const store = await prisma.store.findFirst({
      where: { managerId: req.user!.id },
      select: { id: true, isOpen: true },
    });

    if (!store) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Chưa có cửa hàng nào được gán cho quản lý này");
    }

    const updated = await prisma.store.update({
      where: { id: store.id },
      data: { isOpen: payload.isOpen },
    });

    res.json({ data: updated });
  }),
);

storeRouter.get(
  "/managed/dashboard",
  requireAuth,
  requireRole(UserRole.STORE_MANAGER),
  asyncHandler(async (req, res) => {
    const managedStore = await prisma.store.findFirst({
      where: { managerId: req.user!.id },
      select: {
        id: true,
        name: true,
        address: true,
        isOpen: true,
        rating: true,
        etaMinutesMin: true,
        etaMinutesMax: true,
      },
    });

    if (!managedStore) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Chưa có cửa hàng nào được gán cho quản lý này");
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - 6);

    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const [today, week, month, total, recentDelivered, topProducts, recentOrders] =
      await Promise.all([
        prisma.order.aggregate({
          where: {
            storeId: managedStore.id,
            status: OrderStatus.DELIVERED,
            completedAt: { gte: todayStart },
          },
          _sum: {
            merchantPayout: true,
            total: true,
          },
          _count: { _all: true },
        }),
        prisma.order.aggregate({
          where: {
            storeId: managedStore.id,
            status: OrderStatus.DELIVERED,
            completedAt: { gte: weekStart },
          },
          _sum: {
            merchantPayout: true,
            total: true,
          },
          _count: { _all: true },
        }),
        prisma.order.aggregate({
          where: {
            storeId: managedStore.id,
            status: OrderStatus.DELIVERED,
            completedAt: { gte: monthStart },
          },
          _sum: {
            merchantPayout: true,
            total: true,
          },
          _count: { _all: true },
        }),
        prisma.order.aggregate({
          where: {
            storeId: managedStore.id,
            status: OrderStatus.DELIVERED,
          },
          _sum: {
            merchantPayout: true,
            total: true,
          },
          _count: { _all: true },
        }),
        prisma.order.findMany({
          where: {
            storeId: managedStore.id,
            status: OrderStatus.DELIVERED,
            completedAt: { gte: weekStart },
          },
          select: {
            id: true,
            completedAt: true,
            merchantPayout: true,
          },
          orderBy: { completedAt: "asc" },
        }),
        prisma.orderItem.groupBy({
          by: ["productId", "productName"],
          where: {
            order: {
              storeId: managedStore.id,
              status: OrderStatus.DELIVERED,
            },
          },
          _sum: {
            quantity: true,
            lineTotal: true,
          },
          _count: {
            id: true,
          },
          orderBy: {
            _sum: {
              quantity: "desc",
            },
          },
          take: 8,
        }),
        prisma.order.findMany({
          where: { storeId: managedStore.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            paymentMethod: true,
            paymentStatus: true,
            total: true,
            merchantPayout: true,
            platformRevenue: true,
            createdAt: true,
            completedAt: true,
            driver: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        }),
      ]);

    const trendMap = new Map<string, { date: string; revenue: number; orders: number }>();
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = toDayKey(d);
      trendMap.set(key, {
        date: key,
        revenue: 0,
        orders: 0,
      });
    }

    recentDelivered.forEach((order) => {
      if (!order.completedAt) return;
      const key = toDayKey(order.completedAt);
      const current = trendMap.get(key);
      if (!current) return;
      current.revenue += order.merchantPayout;
      current.orders += 1;
    });

    const [cashlessOrders, codOrders] = await Promise.all([
      prisma.order.count({
        where: {
          storeId: managedStore.id,
          status: OrderStatus.DELIVERED,
          paymentMethod: PaymentMethod.SEPAY_QR,
        },
      }),
      prisma.order.count({
        where: {
          storeId: managedStore.id,
          status: OrderStatus.DELIVERED,
          paymentMethod: PaymentMethod.COD,
        },
      }),
    ]);

    res.json({
      data: {
        store: managedStore,
        summary: {
          todayRevenue: today._sum.merchantPayout ?? 0,
          todayGross: today._sum.total ?? 0,
          todayOrders: today._count._all,
          weekRevenue: week._sum.merchantPayout ?? 0,
          weekGross: week._sum.total ?? 0,
          weekOrders: week._count._all,
          monthRevenue: month._sum.merchantPayout ?? 0,
          monthGross: month._sum.total ?? 0,
          monthOrders: month._count._all,
          totalRevenue: total._sum.merchantPayout ?? 0,
          totalGross: total._sum.total ?? 0,
          totalDeliveredOrders: total._count._all,
          cashlessOrders,
          codOrders,
        },
        trend7Days: Array.from(trendMap.values()),
        topProducts: topProducts.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantitySold: item._sum.quantity ?? 0,
          grossSales: item._sum.lineTotal ?? 0,
          orderLines: item._count.id,
        })),
        recentOrders,
      },
    });
  }),
);

storeRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listStoreQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where = {
      ...(query.q
        ? {
            name: {
              contains: query.q,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(query.isOpen === undefined ? {} : { isOpen: query.isOpen }),
    };

    const [data, total] = await Promise.all([
      prisma.store.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ isOpen: "desc" }, { rating: "desc" }],
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.store.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  }),
);

// ── GET /stores/:storeId — Chi tiết cửa hàng + menu sản phẩm ──
storeRouter.get(
  "/:storeId",
  asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true, name: true, address: true,
        rating: true, isOpen: true,
        etaMinutesMin: true, etaMinutesMax: true,
        latitude: true, longitude: true,
      },
    });
    if (!store) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy cửa hàng");
    }
    const products = await prisma.product.findMany({
      where: { storeId, isAvailable: true },
      orderBy: [{ soldCount: "desc" }, { rating: "desc" }],
      include: {
        store: true,
        categories: { include: { category: true } },
        optionGroups: { include: { options: true } },
      },
    });

    res.json({
      data: {
        ...store,
        products: products.map(toProductResponse),
      },
    });
  }),
);

storeRouter.post(
  "/",
  requireAuth,
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const payload = adminCreateStoreSchema.parse(req.body);

    if (payload.etaMinutesMin > payload.etaMinutesMax) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        "etaMinutesMin must be less than or equal etaMinutesMax",
      );
    }

    const emailExisted = await prisma.user.findFirst({
      where: { email: payload.managerEmail, role: "STORE_MANAGER" },
      select: { id: true },
    });

    if (emailExisted) {
      throw new HttpError(StatusCodes.CONFLICT, "Email quản lý đã tồn tại");
    }

    const created = await prisma.$transaction(async (tx) => {
      const manager = await tx.user.create({
        data: {
          name: payload.managerName,
          email: payload.managerEmail,
          passwordHash: await bcrypt.hash(payload.managerPassword, 12),
          role: UserRole.STORE_MANAGER,
        },
      });

      return tx.store.create({
        data: {
          name: payload.name,
          slug: `${slugify(payload.name)}-${Date.now()}`,
          address: payload.address,
          rating: payload.rating,
          etaMinutesMin: payload.etaMinutesMin,
          etaMinutesMax: payload.etaMinutesMax,
          latitude: payload.latitude,
          longitude: payload.longitude,
          isOpen: payload.isOpen,
          managerId: manager.id,
        },
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });

    res.status(StatusCodes.CREATED).json({ data: created });
  }),
);

storeRouter.patch(
  "/:storeId",
  requireAuth,
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const payload = adminUpdateStoreSchema.parse(req.body);
    const { storeId } = req.params;

    const existing = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    });

    if (!existing) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy cửa hàng");
    }

    if (
      payload.etaMinutesMin !== undefined &&
      payload.etaMinutesMax !== undefined &&
      payload.etaMinutesMin > payload.etaMinutesMax
    ) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        "etaMinutesMin must be less than or equal etaMinutesMax",
      );
    }

    const updated = await prisma.store.update({
      where: { id: storeId },
      data: payload,
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({ data: updated });
  }),
);

export default storeRouter;
