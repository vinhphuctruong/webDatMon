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
        tx.user.findUnique({
          where: { email: application.email },
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
      message: "Driver application approved successfully",
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
      message: "Driver application rejected",
    });
  }),
);

export default adminRouter;
