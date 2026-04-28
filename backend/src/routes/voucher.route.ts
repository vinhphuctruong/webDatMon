import { DiscountType } from "@prisma/client";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { requireAuth, requireRole } from "../middlewares/auth";

export const voucherRouter = Router();

/* ── Helpers ────────────────────────────────────────────── */

function calculateDiscount(
  voucher: { discountType: DiscountType; discountValue: number; maxDiscount: number | null },
  subtotal: number,
): number {
  if (voucher.discountType === DiscountType.FIXED) {
    return Math.min(voucher.discountValue, subtotal);
  }
  // PERCENT
  const raw = Math.round((subtotal * voucher.discountValue) / 100);
  const capped = voucher.maxDiscount ? Math.min(raw, voucher.maxDiscount) : raw;
  return Math.min(capped, subtotal);
}

async function validateVoucher(
  code: string,
  userId: string,
  subtotal: number,
) {
  const voucher = await prisma.voucher.findUnique({ where: { code } });

  if (!voucher) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Mã voucher không tồn tại");
  }

  if (!voucher.isActive) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Mã voucher đã bị vô hiệu hóa");
  }

  const now = new Date();
  if (now < voucher.startsAt) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Mã voucher chưa đến thời gian áp dụng");
  }
  if (now > voucher.expiresAt) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Mã voucher đã hết hạn");
  }

  if (voucher.maxUsageTotal !== null && voucher.usedCount >= voucher.maxUsageTotal) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Mã voucher đã hết lượt sử dụng");
  }

  const userUsageCount = await prisma.voucherUsage.count({
    where: { voucherId: voucher.id, userId },
  });
  if (userUsageCount >= voucher.maxUsagePerUser) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Bạn đã sử dụng mã voucher này rồi");
  }

  if (subtotal < voucher.minOrderValue) {
    const minFormatted = (voucher.minOrderValue / 1000).toFixed(0);
    throw new HttpError(
      StatusCodes.BAD_REQUEST,
      `Đơn hàng tối thiểu ${minFormatted}K để áp dụng mã này`,
    );
  }

  const discount = calculateDiscount(voucher, subtotal);

  return { voucher, discount };
}

export { validateVoucher, calculateDiscount };

/* ── Customer: list available vouchers ──────────────────── */

voucherRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const now = new Date();

    const vouchers = await prisma.voucher.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        expiresAt: { gte: now },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        description: true,
        discountType: true,
        discountValue: true,
        maxDiscount: true,
        minOrderValue: true,
        maxUsagePerUser: true,
        expiresAt: true,
      },
    });

    res.json({ data: vouchers });
  }),
);

/* ── Customer: validate voucher ─────────────────────────── */

const validateSchema = z.object({
  code: z.string().min(1).max(30).transform((v) => v.trim().toUpperCase()),
  subtotal: z.number().int().min(0),
});

voucherRouter.post(
  "/validate",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { code, subtotal } = validateSchema.parse(req.body);

    const { voucher, discount } = await validateVoucher(code, userId, subtotal);

    res.json({
      data: {
        code: voucher.code,
        description: voucher.description,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        maxDiscount: voucher.maxDiscount,
        minOrderValue: voucher.minOrderValue,
        discount,
        expiresAt: voucher.expiresAt,
      },
    });
  }),
);

/* ── Admin: create voucher ──────────────────────────────── */

const createVoucherSchema = z.object({
  code: z.string().min(3).max(30).transform((v) => v.trim().toUpperCase()),
  description: z.string().min(3).max(200),
  discountType: z.nativeEnum(DiscountType).default(DiscountType.FIXED),
  discountValue: z.number().int().positive(),
  maxDiscount: z.number().int().positive().optional(),
  minOrderValue: z.number().int().min(0).default(0),
  maxUsageTotal: z.number().int().positive().optional(),
  maxUsagePerUser: z.number().int().positive().default(1),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date(),
});

voucherRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const payload = createVoucherSchema.parse(req.body);

    const existing = await prisma.voucher.findUnique({ where: { code: payload.code } });
    if (existing) {
      throw new HttpError(StatusCodes.CONFLICT, `Mã voucher "${payload.code}" đã tồn tại`);
    }

    const voucher = await prisma.voucher.create({
      data: {
        code: payload.code,
        description: payload.description,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        maxDiscount: payload.maxDiscount,
        minOrderValue: payload.minOrderValue,
        maxUsageTotal: payload.maxUsageTotal ?? null,
        maxUsagePerUser: payload.maxUsagePerUser,
        startsAt: payload.startsAt ?? new Date(),
        expiresAt: payload.expiresAt,
      },
    });

    res.status(StatusCodes.CREATED).json({ data: voucher });
  }),
);

/* ── Admin: list all vouchers ───────────────────────────── */

voucherRouter.get(
  "/admin",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const vouchers = await prisma.voucher.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true } } },
    });

    res.json({ data: vouchers });
  }),
);

/* ── Admin: toggle active ───────────────────────────────── */

voucherRouter.patch(
  "/:voucherId/toggle",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { voucherId } = req.params;
    const voucher = await prisma.voucher.findUnique({ where: { id: voucherId } });
    if (!voucher) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy voucher");
    }

    const updated = await prisma.voucher.update({
      where: { id: voucherId },
      data: { isActive: !voucher.isActive },
    });

    res.json({ data: updated });
  }),
);

/* ── Admin: delete voucher ──────────────────────────────── */

voucherRouter.delete(
  "/:voucherId",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { voucherId } = req.params;
    await prisma.voucher.delete({ where: { id: voucherId } });
    res.json({ message: "Đã xóa voucher" });
  }),
);
