import { OrderStatus, PartnerApplicationStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { requireAuth, requireRole } from "../middlewares/auth";
import { prisma } from "../db/prisma";

const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(UserRole.ADMIN));

const listDriverApplicationsQuerySchema = z.object({
  status: z.nativeEnum(PartnerApplicationStatus).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

const driverApplicationActionParamsSchema = z.object({
  applicationId: z.string().min(8).max(100),
});

const approveDriverApplicationBodySchema = z.object({
  adminNote: z.string().trim().min(2).max(300).optional(),
});

const rejectDriverApplicationBodySchema = z.object({
  adminNote: z.string().trim().min(2).max(300),
});

const listStoreApplicationsQuerySchema = z.object({
  status: z.nativeEnum(PartnerApplicationStatus).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

const storeApplicationActionParamsSchema = z.object({
  applicationId: z.string().min(8).max(100),
});

const approveStoreApplicationBodySchema = z.object({
  adminNote: z.string().trim().min(2).max(300).optional(),
});

const rejectStoreApplicationBodySchema = z.object({
  adminNote: z.string().trim().min(2).max(300),
});

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
      pendingDriverApplications,
      pendingStoreApplications,
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
      prisma.driverApplication.count({
        where: { status: PartnerApplicationStatus.PENDING },
      }),
      prisma.storeApplication.count({
        where: { status: PartnerApplicationStatus.PENDING },
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
          pendingDriverApplications,
          pendingStoreApplications,
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

adminRouter.get(
  "/driver-applications",
  asyncHandler(async (req, res) => {
    const query = listDriverApplicationsQuerySchema.parse(req.query);
    const rows = await prisma.driverApplication.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        fullName: true,
        dateOfBirth: true,
        email: true,
        phone: true,
        vehicleType: true,
        licensePlate: true,
        portraitImageData: true,
        idCardImageData: true,
        driverLicenseImageData: true,
        portraitQualityScore: true,
        idCardQualityScore: true,
        driverLicenseQualityScore: true,
        status: true,
        adminNote: true,
        reviewedAt: true,
        createdAt: true,
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approvedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({ data: rows });
  }),
);

adminRouter.post(
  "/driver-applications/:applicationId/approve",
  asyncHandler(async (req, res) => {
    const { applicationId } = driverApplicationActionParamsSchema.parse(req.params);
    const payload = approveDriverApplicationBodySchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.driverApplication.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new HttpError(StatusCodes.NOT_FOUND, "Driver application not found");
      }

      if (application.status !== PartnerApplicationStatus.PENDING) {
        throw new HttpError(StatusCodes.CONFLICT, "Driver application is not pending");
      }

      const [emailExisted, plateExisted] = await Promise.all([
        tx.user.findFirst({
          where: { email: application.email, role: "DRIVER" },
          select: { id: true },
        }),
        tx.driverProfile.findUnique({
          where: { licensePlate: application.licensePlate },
          select: { id: true },
        }),
      ]);

      if (emailExisted) {
        throw new HttpError(StatusCodes.CONFLICT, "Applicant email already has an account");
      }

      if (plateExisted) {
        throw new HttpError(StatusCodes.CONFLICT, "License plate already linked to another driver");
      }

      const user = await tx.user.create({
        data: {
          name: application.fullName,
          email: application.email,
          phone: application.phone,
          passwordHash: application.passwordHash,
          role: UserRole.DRIVER,
          driverProfile: {
            create: {
              vehicleType: application.vehicleType,
              licensePlate: application.licensePlate,
              isOnline: false,
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      const reviewed = await tx.driverApplication.update({
        where: { id: application.id },
        data: {
          status: PartnerApplicationStatus.APPROVED,
          adminNote: payload.adminNote ?? null,
          reviewedAt: new Date(),
          reviewedById: req.user!.id,
          approvedUserId: user.id,
        },
        select: {
          id: true,
          status: true,
          reviewedAt: true,
          adminNote: true,
          approvedUserId: true,
        },
      });

      return { user, application: reviewed };
    });

    res.json({
      data: result,
      message: "Duyệt đơn ứng tuyển tài xế thành công",
    });
  }),
);

adminRouter.post(
  "/driver-applications/:applicationId/reject",
  asyncHandler(async (req, res) => {
    const { applicationId } = driverApplicationActionParamsSchema.parse(req.params);
    const payload = rejectDriverApplicationBodySchema.parse(req.body);

    const application = await prisma.driverApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true },
    });

    if (!application) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Driver application not found");
    }

    if (application.status !== PartnerApplicationStatus.PENDING) {
      throw new HttpError(StatusCodes.CONFLICT, "Driver application is not pending");
    }

    const reviewed = await prisma.driverApplication.update({
      where: { id: applicationId },
      data: {
        status: PartnerApplicationStatus.REJECTED,
        adminNote: payload.adminNote,
        reviewedAt: new Date(),
        reviewedById: req.user!.id,
      },
      select: {
        id: true,
        status: true,
        reviewedAt: true,
        adminNote: true,
      },
    });

    res.json({
      data: reviewed,
      message: "Đơn ứng tuyển tài xế đã bị từ chối",
    });
  }),
);

adminRouter.get(
  "/store-applications",
  asyncHandler(async (req, res) => {
    const query = listStoreApplicationsQuerySchema.parse(req.query);
    const rows = await prisma.storeApplication.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({ data: rows });
  }),
);

adminRouter.post(
  "/store-applications/:applicationId/approve",
  asyncHandler(async (req, res) => {
    const { applicationId } = storeApplicationActionParamsSchema.parse(req.params);
    const payload = approveStoreApplicationBodySchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.storeApplication.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn đăng ký cửa hàng");
      }

      if (application.status !== PartnerApplicationStatus.PENDING) {
        throw new HttpError(StatusCodes.CONFLICT, "Đơn đăng ký không ở trạng thái chờ duyệt");
      }

      // Check if user already manages a store
      const existingStore = await tx.store.findFirst({
        where: { managerId: application.applicantId },
      });

      if (existingStore) {
        throw new HttpError(StatusCodes.CONFLICT, "Người nộp đơn đã quản lý một cửa hàng khác");
      }

      // Create Store
      const store = await tx.store.create({
        data: {
          name: application.storeName,
          slug: `${application.storeName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")}-${Date.now()}`,
          address: application.storeAddress,
          latitude: application.storeLatitude,
          longitude: application.storeLongitude,
          etaMinutesMin: 20,
          etaMinutesMax: 35,
          isOpen: false,
          managerId: application.applicantId,
        },
      });

      // Update User Role
      await tx.user.update({
        where: { id: application.applicantId },
        data: { role: UserRole.STORE_MANAGER },
      });

      // Update Application Status
      const reviewed = await tx.storeApplication.update({
        where: { id: application.id },
        data: {
          status: PartnerApplicationStatus.APPROVED,
          adminNote: payload.adminNote ?? null,
          reviewedAt: new Date(),
          reviewedById: req.user!.id,
        },
      });

      return { store, application: reviewed };
    });

    res.json({
      data: result,
      message: "Store application approved successfully",
    });
  }),
);

adminRouter.post(
  "/store-applications/:applicationId/reject",
  asyncHandler(async (req, res) => {
    const { applicationId } = storeApplicationActionParamsSchema.parse(req.params);
    const payload = rejectStoreApplicationBodySchema.parse(req.body);

    const application = await prisma.storeApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true },
    });

    if (!application) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn đăng ký cửa hàng");
    }

    if (application.status !== PartnerApplicationStatus.PENDING) {
      throw new HttpError(StatusCodes.CONFLICT, "Đơn đăng ký không ở trạng thái chờ duyệt");
    }

    const reviewed = await prisma.storeApplication.update({
      where: { id: applicationId },
      data: {
        status: PartnerApplicationStatus.REJECTED,
        adminNote: payload.adminNote,
        reviewedAt: new Date(),
        reviewedById: req.user!.id,
      },
    });

    res.json({
      data: reviewed,
      message: "Store application rejected",
    });
  }),
);

// ── User Management ────────────────────────────

const listUsersQuerySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  page: z.coerce.number().int().min(1).optional().default(1),
});

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const query = listUsersQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { email: { contains: query.q, mode: "insensitive" as const } },
              { phone: { contains: query.q } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: users,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }),
);

const updateUserBodySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  name: z.string().trim().min(1).max(100).optional(),
});

adminRouter.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = updateUserBodySchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy người dùng");

    const updated = await prisma.user.update({
      where: { id },
      data: body,
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
    });

    res.json({ data: updated, message: "Đã cập nhật" });
  }),
);

adminRouter.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy người dùng");
    if (user.role === UserRole.ADMIN) throw new HttpError(StatusCodes.FORBIDDEN, "Không thể xóa tài khoản admin");

    await prisma.user.delete({ where: { id } });
    res.json({ message: "Đã xóa người dùng" });
  }),
);

export default adminRouter;
