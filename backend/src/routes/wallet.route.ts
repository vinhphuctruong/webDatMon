import {
  PayoutStatus,
  SePayTopupStatus,
  UserRole,
  WalletOwnerType,
  WalletTransactionType,
  WalletType,
} from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { requireAuth } from "../middlewares/auth";
import {
  createSePayQrContent,
  createSePayReference,
  creditWalletAvailable,
  debitWalletAvailable,
  ensureDriverWallets,
  ensureMerchantWallet,
  ensurePlatformWallet,
} from "../services/finance";

const walletRouter = Router();
walletRouter.use(requireAuth);

const listTxnQuerySchema = z.object({
  walletId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const topupSchema = z.object({
  amount: z.coerce.number().int().min(10000).max(100000000),
});

const confirmTopupSchema = z.object({
  sepayTransactionId: z.string().min(3).max(120).optional(),
});

const withdrawSchema = z.object({
  amount: z.coerce.number().int().min(10000).max(500000000),
  bankCode: z.string().min(2).max(20),
  bankAccountNumber: z.string().min(6).max(32),
  bankAccountName: z.string().min(2).max(120),
  note: z.string().max(255).optional(),
});

async function getStoreIdByManager(userId: string) {
  const managedStore = await prisma.store.findFirst({
    where: { managerId: userId },
    select: { id: true },
  });

  return managedStore?.id;
}

async function getAccessibleWalletIds(userId: string, role: UserRole): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    if (role === UserRole.DRIVER) {
      const { creditWallet, cashWallet } = await ensureDriverWallets(tx, userId);
      return [creditWallet.id, cashWallet.id];
    }

    if (role === UserRole.STORE_MANAGER) {
      const storeId = await getStoreIdByManager(userId);
      if (!storeId) return [];
      const merchantWallet = await ensureMerchantWallet(tx, storeId);
      return [merchantWallet.id];
    }

    if (role === UserRole.ADMIN) {
      const [escrow, revenue] = await Promise.all([
        ensurePlatformWallet(tx, WalletType.PLATFORM_ESCROW),
        ensurePlatformWallet(tx, WalletType.PLATFORM_REVENUE),
      ]);
      return [escrow.id, revenue.id];
    }

    return [];
  });
}

walletRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const role = req.user!.role;
    const userId = req.user!.id;

    if (role === UserRole.DRIVER) {
      const wallets = await prisma.$transaction(async (tx) => ensureDriverWallets(tx, userId));
      return res.json({
        data: {
          role,
          wallets: {
            credit: wallets.creditWallet,
            cash: wallets.cashWallet,
          },
        },
      });
    }

    if (role === UserRole.STORE_MANAGER) {
      const storeId = await getStoreIdByManager(userId);
      if (!storeId) {
        throw new HttpError(StatusCodes.NOT_FOUND, "Chưa có cửa hàng nào được gán cho quản lý này");
      }

      const wallet = await prisma.$transaction(async (tx) => ensureMerchantWallet(tx, storeId));
      return res.json({
        data: {
          role,
          wallets: {
            merchant: wallet,
          },
        },
      });
    }

    if (role === UserRole.ADMIN) {
      const wallets = await prisma.$transaction(async (tx) => {
        const [escrow, revenue] = await Promise.all([
          ensurePlatformWallet(tx, WalletType.PLATFORM_ESCROW),
          ensurePlatformWallet(tx, WalletType.PLATFORM_REVENUE),
        ]);

        return { escrow, revenue };
      });

      return res.json({
        data: {
          role,
          wallets,
        },
      });
    }

    return res.json({
      data: {
        role,
        wallets: null,
      },
    });
  }),
);

walletRouter.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const query = listTxnQuerySchema.parse(req.query);
    const accessibleWalletIds = await getAccessibleWalletIds(req.user!.id, req.user!.role);

    if (!accessibleWalletIds.length) {
      return res.json({ data: [] });
    }

    if (query.walletId && !accessibleWalletIds.includes(query.walletId)) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Not allowed to access this wallet");
    }

    const rows = await prisma.walletTransaction.findMany({
      where: {
        walletId: query.walletId ?? { in: accessibleWalletIds },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
    });

    res.json({ data: rows });
  }),
);

walletRouter.get(
  "/topups",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== UserRole.DRIVER) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Only drivers can access topups");
    }

    const rows = await prisma.sePayTopupRequest.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ data: rows });
  }),
);

walletRouter.post(
  "/topups/sepay",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== UserRole.DRIVER) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Only drivers can top up credit wallet");
    }

    const payload = topupSchema.parse(req.body);

    const created = await prisma.$transaction(async (tx) => {
      const { creditWallet } = await ensureDriverWallets(tx, req.user!.id);
      const referenceCode = createSePayReference("TOPUP");
      const qrContent = createSePayQrContent({
        referenceCode,
        amount: payload.amount,
        note: `DRIVER_TOPUP:${req.user!.id}`,
      });

      return tx.sePayTopupRequest.create({
        data: {
          userId: req.user!.id,
          walletId: creditWallet.id,
          amount: payload.amount,
          status: SePayTopupStatus.PENDING,
          referenceCode,
          qrContent,
        },
      });
    });

    res.status(StatusCodes.CREATED).json({ data: created });
  }),
);

walletRouter.post(
  "/topups/sepay/:referenceCode/confirm",
  asyncHandler(async (req, res) => {
    const { referenceCode } = req.params;
    const payload = confirmTopupSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const topup = await tx.sePayTopupRequest.findUnique({
        where: { referenceCode },
      });

      if (!topup) {
        throw new HttpError(StatusCodes.NOT_FOUND, "Topup request not found");
      }

      if (req.user!.role !== UserRole.ADMIN && topup.userId !== req.user!.id) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Not allowed to confirm this topup");
      }

      if (topup.status === SePayTopupStatus.CONFIRMED) {
        return topup;
      }

      await creditWalletAvailable(tx, {
        walletId: topup.walletId,
        type: WalletTransactionType.TOPUP_SEPAY,
        amount: topup.amount,
        topupId: topup.id,
        referenceCode: topup.referenceCode,
        note: "Driver credit wallet topup via SePay",
      });

      return tx.sePayTopupRequest.update({
        where: { id: topup.id },
        data: {
          status: SePayTopupStatus.CONFIRMED,
          confirmedAt: new Date(),
          sepayTransactionId:
            payload.sepayTransactionId ?? topup.sepayTransactionId ?? createSePayReference("SEPAYTXN"),
        },
      });
    });

    res.json({ data: updated });
  }),
);

walletRouter.get(
  "/payouts",
  asyncHandler(async (req, res) => {
    const walletIds = await getAccessibleWalletIds(req.user!.id, req.user!.role);
    if (!walletIds.length) {
      return res.json({ data: [] });
    }

    const rows = await prisma.walletPayout.findMany({
      where: {
        walletId: { in: walletIds },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ data: rows });
  }),
);

walletRouter.post(
  "/payouts",
  asyncHandler(async (req, res) => {
    const payload = withdrawSchema.parse(req.body);

    if (req.user!.role !== UserRole.DRIVER && req.user!.role !== UserRole.STORE_MANAGER) {
      throw new HttpError(
        StatusCodes.FORBIDDEN,
        "Only driver and store manager can request payouts",
      );
    }

    const payout = await prisma.$transaction(async (tx) => {
      let sourceWalletId: string;

      if (req.user!.role === UserRole.DRIVER) {
        const { cashWallet } = await ensureDriverWallets(tx, req.user!.id);
        sourceWalletId = cashWallet.id;
      } else {
        const storeId = await getStoreIdByManager(req.user!.id);
        if (!storeId) {
          throw new HttpError(StatusCodes.NOT_FOUND, "Chưa có cửa hàng nào được gán cho quản lý này");
        }

        const wallet = await ensureMerchantWallet(tx, storeId);
        sourceWalletId = wallet.id;
      }

      await debitWalletAvailable(tx, {
        walletId: sourceWalletId,
        type: WalletTransactionType.WITHDRAW_COMPLETED,
        amount: payload.amount,
        note: "Wallet payout completed via SePay",
      });

      return tx.walletPayout.create({
        data: {
          walletId: sourceWalletId,
          requestedByUserId: req.user!.id,
          amount: payload.amount,
          fee: 0,
          netAmount: payload.amount,
          bankCode: payload.bankCode,
          bankAccountNumber: payload.bankAccountNumber,
          bankAccountName: payload.bankAccountName,
          status: PayoutStatus.COMPLETED,
          note: payload.note,
          processedAt: new Date(),
          sepayReferenceCode: createSePayReference("PAYOUT"),
        },
      });
    });

    res.status(StatusCodes.CREATED).json({ data: payout });
  }),
);

walletRouter.get(
  "/policy",
  asyncHandler(async (_req, res) => {
    res.json({
      data: {
        merchantCommissionRate: 0.2,
        driverAppFeeRate: 0.2,
        platformFeeDefault: 3000,
        description:
          "Internal wallet settlement model: cashless uses escrow; COD uses driver credit hold and platform fee debit",
      },
    });
  }),
);

export default walletRouter;
