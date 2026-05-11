import { DiscountType, VoucherClaimSource, VoucherScope } from "@prisma/client";
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
  voucher: {
    scope: VoucherScope;
    discountType: DiscountType;
    discountValue: number;
    maxDiscount: number | null;
  },
  baseAmount: number,
): number {
  if (voucher.discountType === DiscountType.FIXED) {
    return Math.min(voucher.discountValue, baseAmount);
  }
  // PERCENT
  if (!voucher.maxDiscount) {
    // Business rule: percent vouchers MUST have a max cap
    throw new HttpError(
      StatusCodes.BAD_REQUEST,
      "Voucher % bắt buộc phải có giới hạn giảm tối đa (max cap)",
    );
  }
  const raw = Math.round((baseAmount * voucher.discountValue) / 100);
  const capped = Math.min(raw, voucher.maxDiscount);
  return Math.min(capped, baseAmount);
}

async function validateVoucher(
  code: string,
  userId: string,
  subtotal: number,
  deliveryFee: number,
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

  // Must have claimed/saved voucher before using
  const claimed = await prisma.voucherClaim.findUnique({
    where: { voucherId_userId: { voucherId: voucher.id, userId } },
    select: { id: true },
  });
  if (!claimed) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Bạn cần lưu voucher này trước khi sử dụng");
  }

  if (voucher.scope === VoucherScope.SHIPPING && deliveryFee <= 0) {
    throw new HttpError(
      StatusCodes.BAD_REQUEST,
      "Vui lòng chọn địa chỉ giao hàng để tính phí ship trước khi áp dụng voucher freeship",
    );
  }

  const discountBase = voucher.scope === VoucherScope.SHIPPING ? deliveryFee : subtotal;
  const discount = calculateDiscount(voucher, discountBase);

  return { voucher, discount };
}

export { validateVoucher, calculateDiscount };

/* ── Customer: list available vouchers ──────────────────── */

async function listMarketVouchers(userId: string) {
  const now = new Date();

  const [vouchers, myClaims] = await Promise.all([
    prisma.voucher.findMany({
      where: {
        isActive: true,
        isClaimable: true,
        startsAt: { lte: now },
        expiresAt: { gte: now },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        description: true,
        scope: true,
        discountType: true,
        discountValue: true,
        maxDiscount: true,
        minOrderValue: true,
        maxUsagePerUser: true,
        maxUsageTotal: true,
        usedCount: true,
        maxClaimTotal: true,
        claimedCount: true,
        expiresAt: true,
      },
    }),
    prisma.voucherClaim.findMany({
      where: { userId },
      select: { voucherId: true },
    }),
  ]);

  const claimedSet = new Set(myClaims.map((c) => c.voucherId));

  return vouchers.map((v) => ({
    ...v,
    hasClaimed: claimedSet.has(v.id),
    remainingClaims:
      v.maxClaimTotal == null ? null : Math.max(0, v.maxClaimTotal - (v.claimedCount ?? 0)),
    isSoldOut: v.maxClaimTotal != null && (v.claimedCount ?? 0) >= v.maxClaimTotal,
  }));
}

/* ── Customer: market/list claimable vouchers ───────────── */

voucherRouter.get(
  ["/", "/market"],
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const data = await listMarketVouchers(userId);
    res.json({ data });
  }),
);

/* ── Customer: list my claimed vouchers ─────────────────── */

voucherRouter.get(
  "/my",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const now = new Date();

    const claims = await prisma.voucherClaim.findMany({
      where: { userId },
      orderBy: { claimedAt: "desc" },
      select: {
        claimedAt: true,
        voucher: {
          select: {
            id: true,
            code: true,
            description: true,
            scope: true,
            discountType: true,
            discountValue: true,
            maxDiscount: true,
            minOrderValue: true,
            maxUsagePerUser: true,
            expiresAt: true,
            startsAt: true,
            isActive: true,
          },
        },
      },
    });

    const voucherIds = claims.map((c) => c.voucher.id);
    const usedAgg = await prisma.voucherUsage.groupBy({
      by: ["voucherId"],
      where: { userId, voucherId: { in: voucherIds } },
      _count: { _all: true },
    });
    const usedMap = new Map<string, number>();
    usedAgg.forEach((u) => usedMap.set(u.voucherId, u._count._all));

    const data = claims.map((c) => {
      const isExpired = now > c.voucher.expiresAt;
      const notStarted = now < c.voucher.startsAt;
      const usedCountForUser = usedMap.get(c.voucher.id) ?? 0;
      return {
        ...c.voucher,
        claimedAt: c.claimedAt,
        used: usedCountForUser >= c.voucher.maxUsagePerUser,
        usedCountForUser,
        isExpired,
        notStarted,
      };
    });

    res.json({ data });
  }),
);

/* ── Customer: claim/save voucher ───────────────────────── */

const claimSchema = z.object({
  code: z.string().min(1).max(30).transform((v) => v.trim().toUpperCase()),
});

voucherRouter.post(
  "/claim",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { code } = claimSchema.parse(req.body);
    const now = new Date();

    const voucher = await prisma.voucher.findUnique({ where: { code } });
    if (!voucher) throw new HttpError(StatusCodes.NOT_FOUND, "Mã voucher không tồn tại");
    if (!voucher.isActive || !voucher.isClaimable) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Voucher này không thể lưu");
    }
    if (now < voucher.startsAt) throw new HttpError(StatusCodes.BAD_REQUEST, "Voucher chưa đến thời gian áp dụng");
    if (now > voucher.expiresAt) throw new HttpError(StatusCodes.BAD_REQUEST, "Voucher đã hết hạn");

    // Atomic: ensure limited quantity based on claim count
    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.voucher.findUnique({
          where: { id: voucher.id },
          select: { id: true, maxClaimTotal: true, claimedCount: true },
        });
        if (!current) throw new HttpError(StatusCodes.NOT_FOUND, "Voucher không tồn tại");
        if (current.maxClaimTotal != null && current.claimedCount >= current.maxClaimTotal) {
          throw new HttpError(StatusCodes.BAD_REQUEST, "Voucher đã hết lượt lưu");
        }

        await tx.voucherClaim.create({
          data: {
            voucherId: voucher.id,
            userId,
            source: VoucherClaimSource.MARKET,
          },
        });

        await tx.voucher.update({
          where: { id: voucher.id },
          data: { claimedCount: { increment: 1 } },
        });
      });
    } catch (error: any) {
      // Unique constraint: already claimed
      if (String(error?.code ?? "") === "P2002") {
        throw new HttpError(StatusCodes.BAD_REQUEST, "Bạn đã lưu voucher này rồi");
      }
      throw error;
    }

    res.status(StatusCodes.CREATED).json({ message: "Đã lưu voucher", data: { code } });
  }),
);

/* ── Customer: validate voucher ─────────────────────────── */

const validateSchema = z.object({
  code: z.string().min(1).max(30).transform((v) => v.trim().toUpperCase()),
  subtotal: z.number().int().min(0),
  deliveryFee: z.number().int().min(0).optional().default(0),
});

voucherRouter.post(
  "/validate",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { code, subtotal, deliveryFee } = validateSchema.parse(req.body);

    const { voucher, discount } = await validateVoucher(code, userId, subtotal, deliveryFee);

    res.json({
      data: {
        code: voucher.code,
        description: voucher.description,
        scope: voucher.scope,
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

const createVoucherSchema = z
  .object({
  code: z.string().min(3).max(30).transform((v) => v.trim().toUpperCase()),
  description: z.string().min(3).max(200),
  scope: z.nativeEnum(VoucherScope).default(VoucherScope.ORDER),
  isClaimable: z.coerce.boolean().optional().default(true),
  maxClaimTotal: z.number().int().positive().optional(),
  autoGrantOnRegister: z.coerce.boolean().optional().default(false),
  discountType: z.nativeEnum(DiscountType).default(DiscountType.FIXED),
  discountValue: z.number().int().positive(),
  maxDiscount: z.number().int().positive().optional(),
  minOrderValue: z.number().int().min(0).default(0),
  maxUsageTotal: z.number().int().positive().optional(),
  maxUsagePerUser: z.number().int().positive().default(1),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date(),
})
  .superRefine((data, ctx) => {
    if (data.discountType === DiscountType.PERCENT && !data.maxDiscount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Voucher % bắt buộc có maxDiscount (giảm tối đa).",
        path: ["maxDiscount"],
      });
    }
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
        scope: payload.scope,
        isClaimable: payload.isClaimable,
        maxClaimTotal: payload.maxClaimTotal ?? null,
        autoGrantOnRegister: payload.autoGrantOnRegister,
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

/* ── Admin: issue vouchers to customers (push/ phát voucher) ── */

const issueSchema = z.object({
  mode: z.enum(["ALL_CUSTOMERS", "EMAILS"]).default("ALL_CUSTOMERS"),
  emails: z.array(z.string().email()).optional().default([]),
  limit: z.coerce.number().int().positive().max(5000).optional().default(5000),
});

voucherRouter.post(
  "/:voucherId/issue",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { voucherId } = req.params;
    const { mode, emails, limit } = issueSchema.parse(req.body ?? {});
    const now = new Date();

    const voucher = await prisma.voucher.findUnique({
      where: { id: voucherId },
      select: {
        id: true,
        code: true,
        isActive: true,
        startsAt: true,
        expiresAt: true,
        maxClaimTotal: true,
        claimedCount: true,
      },
    });
    if (!voucher) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy voucher");
    if (!voucher.isActive) throw new HttpError(StatusCodes.BAD_REQUEST, "Voucher đang bị tắt");
    if (now < voucher.startsAt) throw new HttpError(StatusCodes.BAD_REQUEST, "Voucher chưa đến thời gian áp dụng");
    if (now > voucher.expiresAt) throw new HttpError(StatusCodes.BAD_REQUEST, "Voucher đã hết hạn");

    const users = await prisma.user.findMany({
      where:
        mode === "EMAILS"
          ? { role: "CUSTOMER", email: { in: emails.map((e) => e.trim().toLowerCase()) } }
          : { role: "CUSTOMER" },
      select: { id: true },
      take: mode === "EMAILS" ? undefined : limit,
    });
    const userIds = users.map((u) => u.id);
    if (!userIds.length) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Không tìm thấy khách hàng phù hợp để phát voucher");
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.voucher.findUnique({
        where: { id: voucher.id },
        select: { maxClaimTotal: true, claimedCount: true },
      });
      if (!current) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy voucher");

      const remaining =
        current.maxClaimTotal == null ? null : Math.max(0, current.maxClaimTotal - current.claimedCount);
      if (remaining !== null && remaining <= 0) {
        throw new HttpError(StatusCodes.BAD_REQUEST, "Voucher đã hết lượt lưu");
      }

      const existing = await tx.voucherClaim.findMany({
        where: { voucherId: voucher.id, userId: { in: userIds } },
        select: { userId: true },
      });
      const existingSet = new Set(existing.map((e) => e.userId));
      const notYetClaimed = userIds.filter((id) => !existingSet.has(id));

      const assignList =
        remaining == null ? notYetClaimed : notYetClaimed.slice(0, Math.min(remaining, notYetClaimed.length));
      if (!assignList.length) {
        return { created: 0, skipped: userIds.length };
      }

      const created = await tx.voucherClaim.createMany({
        data: assignList.map((userId) => ({
          voucherId: voucher.id,
          userId,
          source: VoucherClaimSource.ADMIN,
        })),
        skipDuplicates: true,
      });

      if (created.count > 0) {
        await tx.voucher.update({
          where: { id: voucher.id },
          data: { claimedCount: { increment: created.count } },
        });
      }

      return { created: created.count, skipped: userIds.length - created.count };
    });

    res.status(StatusCodes.CREATED).json({
      message: `Đã phát voucher ${voucher.code} cho ${result.created} khách`,
      data: result,
    });
  }),
);
