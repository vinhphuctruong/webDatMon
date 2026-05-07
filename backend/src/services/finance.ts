import {
  CodHoldStatus,
  Order,
  OrderItem,
  OrderPayment,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  UserRole,
  Wallet,
  WalletOwnerType,
  WalletTransactionType,
  WalletTxnDirection,
  WalletTxnStatus,
  WalletType,
} from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { randomUUID } from "node:crypto";
import { HttpError } from "../lib/http-error";

export const FINANCE_POLICY = {
  merchantCommissionRate: 0.2,
  driverAppFeeRate: 0.2,
  /** Phí nền tảng thu từ khách = 0 (giống Shopee Food / Grab Food) */
  platformFeeDefault: 0,
};

export type PrismaTx = Prisma.TransactionClient;

export interface SettlementBreakdown {
  merchantCommission: number;
  driverCommission: number;
  merchantPayout: number;
  driverPayout: number;
  platformRevenue: number;
}

export function calculateSettlementBreakdown(input: {
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
}): SettlementBreakdown {
  const merchantCommission = Math.round(
    Math.max(0, input.subtotal) * FINANCE_POLICY.merchantCommissionRate,
  );
  const driverCommission = Math.round(
    Math.max(0, input.deliveryFee) * FINANCE_POLICY.driverAppFeeRate,
  );

  const merchantPayout = Math.max(0, input.subtotal - merchantCommission);
  const driverPayout = Math.max(0, input.deliveryFee - driverCommission);
  const platformRevenue = Math.max(
    0,
    input.platformFee + merchantCommission + driverCommission,
  );

  return {
    merchantCommission,
    driverCommission,
    merchantPayout,
    driverPayout,
    platformRevenue,
  };
}

function buildWalletScopeKey(params: {
  ownerType: WalletOwnerType;
  type: WalletType;
  ownerUserId?: string | null;
  ownerStoreId?: string | null;
}): string {
  if (params.ownerType === WalletOwnerType.PLATFORM) {
    return `PLATFORM:${params.type}`;
  }

  if (params.ownerType === WalletOwnerType.USER) {
    if (!params.ownerUserId) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "ownerUserId is required for user wallet");
    }

    return `USER:${params.ownerUserId}:${params.type}`;
  }

  if (!params.ownerStoreId) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "ownerStoreId is required for store wallet");
  }

  return `STORE:${params.ownerStoreId}:${params.type}`;
}

interface EnsureWalletInput {
  ownerType: WalletOwnerType;
  type: WalletType;
  ownerUserId?: string | null;
  ownerStoreId?: string | null;
  initialAvailableBalance?: number;
}

export async function ensureWallet(tx: PrismaTx, input: EnsureWalletInput): Promise<Wallet> {
  const scopeKey = buildWalletScopeKey(input);

  const existing = await tx.wallet.findUnique({ where: { scopeKey } });
  if (existing) {
    return existing;
  }

  return tx.wallet.create({
    data: {
      ownerType: input.ownerType,
      type: input.type,
      ownerUserId: input.ownerUserId ?? null,
      ownerStoreId: input.ownerStoreId ?? null,
      scopeKey,
      availableBalance: input.initialAvailableBalance ?? 0,
    },
  });
}

export async function ensurePlatformWallet(
  tx: PrismaTx,
  type: WalletType,
): Promise<Wallet> {
  if (type !== WalletType.PLATFORM_ESCROW && type !== WalletType.PLATFORM_REVENUE) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid platform wallet type");
  }

  return ensureWallet(tx, {
    ownerType: WalletOwnerType.PLATFORM,
    type,
  });
}

export async function ensureMerchantWallet(tx: PrismaTx, storeId: string): Promise<Wallet> {
  return ensureWallet(tx, {
    ownerType: WalletOwnerType.STORE,
    ownerStoreId: storeId,
    type: WalletType.MERCHANT,
  });
}

export async function ensureDriverWallets(
  tx: PrismaTx,
  userId: string,
): Promise<{ creditWallet: Wallet; cashWallet: Wallet }> {
  const [creditWallet, cashWallet] = await Promise.all([
    ensureWallet(tx, {
      ownerType: WalletOwnerType.USER,
      ownerUserId: userId,
      type: WalletType.DRIVER_CREDIT,
      initialAvailableBalance: 0,
    }),
    ensureWallet(tx, {
      ownerType: WalletOwnerType.USER,
      ownerUserId: userId,
      type: WalletType.DRIVER_CASH,
      initialAvailableBalance: 0,
    }),
  ]);

  return { creditWallet, cashWallet };
}

interface WalletMutationInput {
  walletId: string;
  type: WalletTransactionType;
  direction: WalletTxnDirection;
  amount: number;
  availableDelta?: number;
  holdDelta?: number;
  status?: WalletTxnStatus;
  orderId?: string;
  paymentId?: string;
  payoutId?: string;
  topupId?: string;
  referenceCode?: string;
  note?: string;
  metadata?: Prisma.InputJsonValue;
}

async function mutateWallet(tx: PrismaTx, input: WalletMutationInput): Promise<Wallet> {
  const wallet = await tx.wallet.findUnique({ where: { id: input.walletId } });
  if (!wallet) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Wallet not found");
  }

  const availableBefore = wallet.availableBalance;
  const holdBefore = wallet.holdBalance;
  const availableAfter = availableBefore + (input.availableDelta ?? 0);
  const holdAfter = holdBefore + (input.holdDelta ?? 0);

  if (input.amount <= 0) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Amount must be greater than zero");
  }

  if (availableAfter < 0 || holdAfter < 0) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Insufficient wallet balance");
  }

  const updated = await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      availableBalance: availableAfter,
      holdBalance: holdAfter,
    },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      orderId: input.orderId,
      paymentId: input.paymentId,
      payoutId: input.payoutId,
      topupId: input.topupId,
      type: input.type,
      direction: input.direction,
      status: input.status ?? WalletTxnStatus.COMPLETED,
      amount: input.amount,
      availableBefore,
      availableAfter,
      holdBefore,
      holdAfter,
      referenceCode: input.referenceCode,
      note: input.note,
      metadata: input.metadata,
    },
  });

  return updated;
}

export async function creditWalletAvailable(
  tx: PrismaTx,
  input: Omit<WalletMutationInput, "direction" | "availableDelta" | "holdDelta">,
): Promise<Wallet> {
  return mutateWallet(tx, {
    ...input,
    direction: WalletTxnDirection.CREDIT,
    availableDelta: input.amount,
  });
}

export async function debitWalletAvailable(
  tx: PrismaTx,
  input: Omit<WalletMutationInput, "direction" | "availableDelta" | "holdDelta">,
): Promise<Wallet> {
  return mutateWallet(tx, {
    ...input,
    direction: WalletTxnDirection.DEBIT,
    availableDelta: -input.amount,
  });
}

export async function holdWalletAmount(
  tx: PrismaTx,
  input: Omit<WalletMutationInput, "direction" | "availableDelta" | "holdDelta">,
): Promise<Wallet> {
  return mutateWallet(tx, {
    ...input,
    direction: WalletTxnDirection.DEBIT,
    availableDelta: -input.amount,
    holdDelta: input.amount,
  });
}

export async function releaseHeldToAvailable(
  tx: PrismaTx,
  input: Omit<WalletMutationInput, "direction" | "availableDelta" | "holdDelta">,
): Promise<Wallet> {
  return mutateWallet(tx, {
    ...input,
    direction: WalletTxnDirection.CREDIT,
    availableDelta: input.amount,
    holdDelta: -input.amount,
  });
}

export async function consumeHeldBalance(
  tx: PrismaTx,
  input: Omit<WalletMutationInput, "direction" | "availableDelta" | "holdDelta">,
): Promise<Wallet> {
  return mutateWallet(tx, {
    ...input,
    direction: WalletTxnDirection.DEBIT,
    holdDelta: -input.amount,
  });
}

export function createSePayReference(prefix: string): string {
  const safePrefix = prefix.replace(/[^A-Z0-9_-]/gi, "").toUpperCase();
  return `${safePrefix}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function createSePayQrContent(input: {
  referenceCode: string;
  amount: number;
  note?: string;
}): string {
  const note = input.note ? `|NOTE:${input.note}` : "";
  return `SEPAY|REF:${input.referenceCode}|AMOUNT:${input.amount}${note}`;
}

async function getOrderForSettlement(tx: PrismaTx, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payment: true,
    },
  });

  if (!order) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Order not found");
  }

  return order;
}

interface SettleOrderOptions {
  orderId: string;
  settledBy?: "DRIVER" | "ADMIN";
}

export async function settleDeliveredOrder(tx: PrismaTx, options: SettleOrderOptions) {
  const order = await getOrderForSettlement(tx, options.orderId);

  if (order.status === OrderStatus.DELIVERED) {
    return order;
  }

  if (order.paymentMethod === PaymentMethod.SEPAY_QR) {
    if (order.paymentStatus !== PaymentStatus.SUCCEEDED) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        "Cashless payment has not been confirmed",
      );
    }

    const [escrowWallet, platformRevenueWallet, merchantWallet] = await Promise.all([
      ensurePlatformWallet(tx, WalletType.PLATFORM_ESCROW),
      ensurePlatformWallet(tx, WalletType.PLATFORM_REVENUE),
      ensureMerchantWallet(tx, order.storeId),
    ]);

    if (order.merchantPayout > 0) {
      await debitWalletAvailable(tx, {
        walletId: escrowWallet.id,
        type: WalletTransactionType.ORDER_MERCHANT_SETTLEMENT,
        amount: order.merchantPayout,
        orderId: order.id,
        paymentId: order.payment?.id,
        note: "Merchant settlement from escrow",
      });

      await creditWalletAvailable(tx, {
        walletId: merchantWallet.id,
        type: WalletTransactionType.ORDER_MERCHANT_SETTLEMENT,
        amount: order.merchantPayout,
        orderId: order.id,
        paymentId: order.payment?.id,
        note: "Merchant payout",
      });
    }

    if (order.driverPayout > 0 && order.driverId) {
      const { cashWallet } = await ensureDriverWallets(tx, order.driverId);

      await debitWalletAvailable(tx, {
        walletId: escrowWallet.id,
        type: WalletTransactionType.ORDER_DRIVER_SETTLEMENT,
        amount: order.driverPayout,
        orderId: order.id,
        paymentId: order.payment?.id,
        note: "Driver settlement from escrow",
      });

      await creditWalletAvailable(tx, {
        walletId: cashWallet.id,
        type: WalletTransactionType.ORDER_DRIVER_SETTLEMENT,
        amount: order.driverPayout,
        orderId: order.id,
        paymentId: order.payment?.id,
        note: "Driver payout",
      });
    }

    if (order.platformRevenue > 0) {
      await debitWalletAvailable(tx, {
        walletId: escrowWallet.id,
        type: WalletTransactionType.ORDER_PLATFORM_REVENUE,
        amount: order.platformRevenue,
        orderId: order.id,
        paymentId: order.payment?.id,
        note: "Capture platform revenue from escrow",
      });

      await creditWalletAvailable(tx, {
        walletId: platformRevenueWallet.id,
        type: WalletTransactionType.ORDER_PLATFORM_REVENUE,
        amount: order.platformRevenue,
        orderId: order.id,
        paymentId: order.payment?.id,
        note: "Platform revenue captured",
      });
    }
  } else {
    if (!order.driverId) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "COD order requires assigned driver");
    }

    if (order.codHoldStatus !== CodHoldStatus.HELD) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        "COD hold is not active for this order",
      );
    }

    const [platformRevenueWallet, merchantWallet, driverWallets] = await Promise.all([
      ensurePlatformWallet(tx, WalletType.PLATFORM_REVENUE),
      ensureMerchantWallet(tx, order.storeId),
      ensureDriverWallets(tx, order.driverId),
    ]);

    if (order.codHoldAmount > 0) {
      await consumeHeldBalance(tx, {
        walletId: driverWallets.creditWallet.id,
        type: WalletTransactionType.COD_HOLD_RELEASE,
        amount: order.codHoldAmount,
        orderId: order.id,
        paymentId: order.payment?.id,
        note: "Release COD hold to merchant settlement",
      });

      await creditWalletAvailable(tx, {
        walletId: merchantWallet.id,
        type: WalletTransactionType.ORDER_MERCHANT_SETTLEMENT,
        amount: order.codHoldAmount,
        orderId: order.id,
        paymentId: order.payment?.id,
        note: "Merchant settlement from COD hold",
      });
    }

    if (order.platformRevenue > 0) {
      await debitWalletAvailable(tx, {
        walletId: driverWallets.creditWallet.id,
        type: WalletTransactionType.DRIVER_APP_FEE,
        amount: order.platformRevenue,
        orderId: order.id,
        paymentId: order.payment?.id,
        note: "COD platform fee charged from driver credit wallet",
      });

      await creditWalletAvailable(tx, {
        walletId: platformRevenueWallet.id,
        type: WalletTransactionType.ORDER_PLATFORM_REVENUE,
        amount: order.platformRevenue,
        orderId: order.id,
        paymentId: order.payment?.id,
        note: "Platform revenue from COD order",
      });
    }
  }

  const now = new Date();

  await tx.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.DELIVERED,
      paymentStatus:
        order.paymentMethod === PaymentMethod.COD
          ? PaymentStatus.SUCCEEDED
          : order.paymentStatus,
      completedAt: now,
      codHoldStatus:
        order.paymentMethod === PaymentMethod.COD
          ? CodHoldStatus.RELEASED
          : order.codHoldStatus,
    },
  });

  await tx.orderPayment.updateMany({
    where: {
      orderId: order.id,
      status: PaymentStatus.PENDING,
    },
    data: {
      status: PaymentStatus.SUCCEEDED,
      paidAt: now,
    },
  });

  await Promise.all(
    order.items.map((item: OrderItem) =>
      tx.product.update({
        where: { id: item.productId },
        data: {
          soldCount: {
            increment: item.quantity,
          },
        },
      }),
    ),
  );

  return tx.order.findUnique({
    where: { id: order.id },
    include: {
      store: true,
      items: true,
    },
  });
}

interface ConfirmCashlessPaymentInput {
  orderId: string;
  sepayTransactionId?: string;
  promoteOrderStatus?: boolean;
}

export async function confirmCashlessPayment(
  tx: PrismaTx,
  input: ConfirmCashlessPaymentInput,
) {
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    include: {
      payment: true,
      store: {
        select: {
          autoAcceptOrders: true,
        },
      },
    },
  });

  if (!order) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Order not found");
  }

  if (order.paymentMethod !== PaymentMethod.SEPAY_QR) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Order is not a SePay cashless order");
  }

  if (order.paymentStatus === PaymentStatus.SUCCEEDED && order.payment?.paidAt) {
    return order;
  }

  const now = new Date();

  let payment = order.payment;
  if (!payment) {
    const referenceCode = createSePayReference("ORDER");
    payment = await tx.orderPayment.create({
      data: {
        orderId: order.id,
        method: PaymentMethod.SEPAY_QR,
        status: PaymentStatus.PENDING,
        amount: order.total,
        sepayReferenceCode: referenceCode,
        sepayQrContent: createSePayQrContent({
          referenceCode,
          amount: order.total,
          note: `ORDER:${order.id}`,
        }),
      },
    });
  }

  const escrowWallet = await ensurePlatformWallet(tx, WalletType.PLATFORM_ESCROW);

  await creditWalletAvailable(tx, {
    walletId: escrowWallet.id,
    type: WalletTransactionType.ORDER_ESCROW_IN,
    amount: order.total,
    orderId: order.id,
    paymentId: payment.id,
    referenceCode: payment.sepayReferenceCode ?? undefined,
    note: "Cashless payment moved to platform escrow",
  });

  await tx.orderPayment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.SUCCEEDED,
      paidAt: now,
      sepayTransactionId:
        input.sepayTransactionId ?? payment.sepayTransactionId ?? createSePayReference("SEPAYTXN"),
    },
  });

  const shouldPromoteOrderStatus =
    input.promoteOrderStatus ?? order.store?.autoAcceptOrders ?? false;

  return tx.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: PaymentStatus.SUCCEEDED,
      status:
        shouldPromoteOrderStatus && order.status === OrderStatus.PENDING
          ? OrderStatus.CONFIRMED
          : order.status,
    },
  });
}

interface CancelOrderSettlementInput {
  orderId: string;
  reason?: string;
}

export async function cancelOrderWithSettlementRollback(
  tx: PrismaTx,
  input: CancelOrderSettlementInput,
) {
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    include: {
      payment: true,
    },
  });

  if (!order) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Order not found");
  }

  if (order.status === OrderStatus.DELIVERED) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Cannot cancel delivered order");
  }

  if (order.paymentMethod === PaymentMethod.COD && order.codHoldStatus === CodHoldStatus.HELD) {
    if (!order.driverId) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Driver not assigned for COD hold rollback");
    }

    const { creditWallet } = await ensureDriverWallets(tx, order.driverId);
    await releaseHeldToAvailable(tx, {
      walletId: creditWallet.id,
      type: WalletTransactionType.COD_HOLD_REFUND,
      amount: order.codHoldAmount,
      orderId: order.id,
      paymentId: order.payment?.id,
      note: input.reason ?? "Refund COD hold on order cancellation",
    });
  }

  if (
    order.paymentMethod === PaymentMethod.SEPAY_QR &&
    order.paymentStatus === PaymentStatus.SUCCEEDED
  ) {
    const escrowWallet = await ensurePlatformWallet(tx, WalletType.PLATFORM_ESCROW);

    await debitWalletAvailable(tx, {
      walletId: escrowWallet.id,
      type: WalletTransactionType.ORDER_REFUND_OUT,
      amount: order.total,
      orderId: order.id,
      paymentId: order.payment?.id,
      note: input.reason ?? "Refund cashless payment to customer",
    });

    await tx.orderPayment.updateMany({
      where: { orderId: order.id },
      data: {
        status: PaymentStatus.REFUNDED,
      },
    });
  }

  return tx.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.CANCELLED,
      paymentStatus:
        order.paymentStatus === PaymentStatus.SUCCEEDED &&
        order.paymentMethod === PaymentMethod.SEPAY_QR
          ? PaymentStatus.REFUNDED
          : order.paymentStatus,
      codHoldStatus:
        order.codHoldStatus === CodHoldStatus.HELD
          ? CodHoldStatus.REFUNDED
          : order.codHoldStatus,
    },
  });
}

export async function assertRole(
  role: UserRole,
  allowedRoles: UserRole[],
  message = "Insufficient permissions",
) {
  if (!allowedRoles.includes(role)) {
    throw new HttpError(StatusCodes.FORBIDDEN, message);
  }
}
