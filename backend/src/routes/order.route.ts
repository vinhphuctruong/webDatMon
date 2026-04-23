import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from "@prisma/client";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  FINANCE_POLICY,
  calculateSettlementBreakdown,
  cancelOrderWithSettlementRollback,
  confirmCashlessPayment,
  createSePayQrContent,
  createSePayReference,
  settleDeliveredOrder,
} from "../services/finance";
import { calculateUnitPrice } from "../utils/pricing";

const orderRouter = Router();

const deliveryAddressSchema = z.object({
  receiverName: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  street: z.string().min(2).max(160),
  ward: z.string().min(2).max(120),
  district: z.string().min(2).max(120),
  city: z.string().min(2).max(120),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const createOrderSchema = z.object({
  addressId: z.string().optional(),
  note: z.string().max(500).optional(),
  deliveryAddress: deliveryAddressSchema.optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.SEPAY_QR),
  autoConfirmPayment: z.boolean().optional().default(true),
});

const listOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  cancelReason: z.string().max(255).optional(),
});

function toOrderResponse(order: {
  id: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  total: number;
  merchantCommission: number;
  driverCommission: number;
  merchantPayout: number;
  driverPayout: number;
  platformRevenue: number;
  codHoldAmount: number;
  codHoldStatus: string;
  note: string | null;
  deliveryAddress: unknown;
  estimatedDeliveryAt: Date | null;
  completedAt: Date | null;
  placedAt: Date;
  createdAt: Date;
  userId: string;
  driverId: string | null;
  store: {
    id: string;
    name: string;
    address: string;
    etaMinutesMin: number;
    etaMinutesMax: number;
  };
  payment?: {
    id: string;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: number;
    sepayReferenceCode: string | null;
    sepayQrContent: string | null;
    sepayTransactionId: string | null;
    paidAt: Date | null;
    createdAt: Date;
  } | null;
  items: {
    id: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    selectedOptions: unknown;
  }[];
}) {
  return {
    id: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    platformFee: order.platformFee,
    total: order.total,
    settlement: {
      merchantCommission: order.merchantCommission,
      driverCommission: order.driverCommission,
      merchantPayout: order.merchantPayout,
      driverPayout: order.driverPayout,
      platformRevenue: order.platformRevenue,
      codHoldAmount: order.codHoldAmount,
      codHoldStatus: order.codHoldStatus,
    },
    note: order.note,
    deliveryAddress: order.deliveryAddress,
    estimatedDeliveryAt: order.estimatedDeliveryAt,
    completedAt: order.completedAt,
    placedAt: order.placedAt,
    createdAt: order.createdAt,
    userId: order.userId,
    driverId: order.driverId,
    store: order.store,
    payment: order.payment
      ? {
          id: order.payment.id,
          method: order.payment.method,
          status: order.payment.status,
          amount: order.payment.amount,
          sepayReferenceCode: order.payment.sepayReferenceCode,
          sepayQrContent: order.payment.sepayQrContent,
          sepayTransactionId: order.payment.sepayTransactionId,
          paidAt: order.payment.paidAt,
          createdAt: order.payment.createdAt,
        }
      : null,
    items: order.items,
  };
}

orderRouter.use(requireAuth);

orderRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const payload = createOrderSchema.parse(req.body);

    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            store: true,
            optionGroups: {
              include: {
                options: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (cartItems.length === 0) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Cart is empty");
    }

    const storeIds = new Set(cartItems.map((item) => item.product.storeId));
    if (storeIds.size > 1) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        "Cart contains products from multiple stores. Please checkout one store at a time.",
      );
    }

    const selectedStore = cartItems[0].product.store;

    const lineItems = cartItems.map((item) => {
      const { unitPrice, selectedOptions } = calculateUnitPrice(item.product, item.selectedOptions);
      return {
        productId: item.product.id,
        productName: item.product.name,
        unitPrice,
        quantity: item.quantity,
        lineTotal: unitPrice * item.quantity,
        selectedOptions,
      };
    });

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const deliveryFee = Math.max(...cartItems.map((item) => item.product.deliveryFee));
    const platformFee = FINANCE_POLICY.platformFeeDefault;
    const total = subtotal + deliveryFee + platformFee;

    const settlement = calculateSettlementBreakdown({
      subtotal,
      deliveryFee,
      platformFee,
    });

    let deliveryAddress = payload.deliveryAddress;
    let addressId: string | undefined;

    if (payload.addressId) {
      const address = await prisma.address.findFirst({
        where: {
          id: payload.addressId,
          userId,
        },
      });

      if (!address) {
        throw new HttpError(StatusCodes.NOT_FOUND, "Address not found");
      }

      addressId = address.id;
      deliveryAddress = {
        receiverName: address.receiverName,
        phone: address.phone,
        street: address.street,
        ward: address.ward,
        district: address.district,
        city: address.city,
        latitude: address.latitude ?? undefined,
        longitude: address.longitude ?? undefined,
      };
    }

    if (!deliveryAddress) {
      const defaultAddress = await prisma.address.findFirst({
        where: {
          userId,
          isDefault: true,
        },
      });

      if (defaultAddress) {
        addressId = defaultAddress.id;
        deliveryAddress = {
          receiverName: defaultAddress.receiverName,
          phone: defaultAddress.phone,
          street: defaultAddress.street,
          ward: defaultAddress.ward,
          district: defaultAddress.district,
          city: defaultAddress.city,
          latitude: defaultAddress.latitude ?? undefined,
          longitude: defaultAddress.longitude ?? undefined,
        };
      }
    }

    if (!deliveryAddress) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        "deliveryAddress is required when no default address exists",
      );
    }

    const estimatedDeliveryAt = new Date(
      Date.now() + selectedStore.etaMinutesMax * 60_000,
    );

    const created = await prisma.$transaction(async (tx) => {
      const referenceCode = createSePayReference("ORDER");
      const sepayQrContent = createSePayQrContent({
        referenceCode,
        amount: total,
        note: `ORDER:${userId}`,
      });

      const order = await tx.order.create({
        data: {
          userId,
          storeId: selectedStore.id,
          addressId,
          status: OrderStatus.PENDING,
          paymentMethod: payload.paymentMethod,
          paymentStatus: PaymentStatus.PENDING,
          subtotal,
          deliveryFee,
          platformFee,
          total,
          merchantCommission: settlement.merchantCommission,
          driverCommission: settlement.driverCommission,
          merchantPayout: settlement.merchantPayout,
          driverPayout: settlement.driverPayout,
          platformRevenue: settlement.platformRevenue,
          note: payload.note,
          deliveryAddress,
          estimatedDeliveryAt,
          items: {
            create: lineItems,
          },
          payment: {
            create: {
              method: payload.paymentMethod,
              status: PaymentStatus.PENDING,
              amount: total,
              sepayReferenceCode:
                payload.paymentMethod === PaymentMethod.SEPAY_QR ? referenceCode : null,
              sepayQrContent:
                payload.paymentMethod === PaymentMethod.SEPAY_QR ? sepayQrContent : null,
            },
          },
        },
        include: {
          store: true,
          items: true,
          payment: true,
        },
      });

      if (payload.paymentMethod === PaymentMethod.SEPAY_QR && payload.autoConfirmPayment) {
        await confirmCashlessPayment(tx, {
          orderId: order.id,
          sepayTransactionId: createSePayReference("SEPAY-AUTO"),
        });
      }

      await tx.cartItem.deleteMany({ where: { userId } });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          store: true,
          items: true,
          payment: true,
        },
      });
    });

    res.status(StatusCodes.CREATED).json({
      data: toOrderResponse(created),
    });
  }),
);

orderRouter.post(
  "/:orderId/payments/confirm-sepay",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existing) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Order not found");
    }

    if (req.user!.role !== UserRole.ADMIN && existing.userId !== req.user!.id) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Not allowed to confirm payment for this order");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await confirmCashlessPayment(tx, {
        orderId,
        sepayTransactionId: createSePayReference("SEPAY-MANUAL"),
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          store: true,
          items: true,
          payment: true,
        },
      });
    });

    res.json({ data: toOrderResponse(updated) });
  }),
);

orderRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listOrderQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const role = req.user!.role;
    let scopedWhere: Record<string, unknown> = {};

    if (role === UserRole.ADMIN) {
      scopedWhere = {};
    } else if (role === UserRole.STORE_MANAGER) {
      const managedStore = await prisma.store.findFirst({
        where: { managerId: req.user!.id },
        select: { id: true },
      });

      if (!managedStore) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Store manager is not assigned to a store");
      }

      scopedWhere = { storeId: managedStore.id };
    } else if (role === UserRole.DRIVER) {
      scopedWhere = { driverId: req.user!.id };
    } else {
      scopedWhere = { userId: req.user!.id };
    }

    const where = {
      ...scopedWhere,
      ...(query.status ? { status: query.status } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: query.limit,
        include: {
          store: true,
          items: true,
          payment: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      data: orders.map(toOrderResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  }),
);

orderRouter.get(
  "/:orderId",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: true,
        items: true,
        payment: true,
      },
    });

    if (!order) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Order not found");
    }

    const role = req.user!.role;
    if (role === UserRole.ADMIN) {
      return res.json({ data: toOrderResponse(order) });
    }

    if (role === UserRole.STORE_MANAGER) {
      const managedStore = await prisma.store.findFirst({
        where: { managerId: req.user!.id },
        select: { id: true },
      });

      if (!managedStore || managedStore.id !== order.storeId) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Not allowed to view this order");
      }

      return res.json({ data: toOrderResponse(order) });
    }

    if (role === UserRole.DRIVER) {
      if (order.driverId !== req.user!.id) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Not allowed to view this order");
      }

      return res.json({ data: toOrderResponse(order) });
    }

    if (order.userId !== req.user!.id) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Not allowed to view this order");
    }

    res.json({ data: toOrderResponse(order) });
  }),
);

orderRouter.patch(
  "/:orderId/status",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const payload = updateStatusSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id: orderId } });
      if (!existing) {
        throw new HttpError(StatusCodes.NOT_FOUND, "Order not found");
      }

      if (payload.status === OrderStatus.CANCELLED) {
        await cancelOrderWithSettlementRollback(tx, {
          orderId,
          reason: payload.cancelReason,
        });
      } else if (payload.status === OrderStatus.DELIVERED) {
        await settleDeliveredOrder(tx, {
          orderId,
          settledBy: "ADMIN",
        });
      } else {
        await tx.order.update({
          where: { id: orderId },
          data: { status: payload.status },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          store: true,
          items: true,
          payment: true,
        },
      });
    });

    res.json({ data: toOrderResponse(updated) });
  }),
);

// --------------------------------------------------------------------------------
// Order Cancellation logic (Khách hàng & Quán)
// --------------------------------------------------------------------------------
orderRouter.post(
  "/:orderId/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { reason } = req.body;
    const user = req.user!;

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new HttpError(StatusCodes.NOT_FOUND, "Order not found");

      if (user.role === UserRole.CUSTOMER) {
        if (order.userId !== user.id) {
          throw new HttpError(StatusCodes.FORBIDDEN, "Not your order");
        }
        if (order.status !== OrderStatus.PENDING) {
          throw new HttpError(
            StatusCodes.FORBIDDEN,
            "Chỉ có thể tự hủy khi đơn đang chờ xác nhận. Quán đã nhận đơn, vui lòng gọi điện để yêu cầu hủy."
          );
        }
      } else if (user.role === UserRole.STORE_MANAGER) {
        const store = await tx.store.findUnique({ where: { managerId: user.id } });
        if (!store || order.storeId !== store.id) {
          throw new HttpError(StatusCodes.FORBIDDEN, "Not your store's order");
        }
        if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PREPARING) {
          throw new HttpError(StatusCodes.FORBIDDEN, "Chỉ có thể hủy khi đơn đang chờ hoặc đang chuẩn bị.");
        }
      } else if (user.role !== UserRole.ADMIN) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Unauthorized role to cancel");
      }

      await cancelOrderWithSettlementRollback(tx, {
        orderId,
        reason: reason || "User cancelled",
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { store: true, items: true, payment: true },
      });
    });

    res.json({ data: toOrderResponse(updated) });
  }),
);

// --------------------------------------------------------------------------------
// Driver Reject Order (Nhả đơn)
// --------------------------------------------------------------------------------
orderRouter.post(
  "/:orderId/driver-reject",
  requireRole(UserRole.DRIVER),
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { reason } = req.body;
    const user = req.user!;

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new HttpError(StatusCodes.NOT_FOUND, "Order not found");
      
      if (order.driverId !== user.id) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Not your assigned order");
      }
      
      if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PREPARING) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Không thể nhả đơn ở trạng thái này.");
      }

      // Nhả đơn: Bỏ driverId, cho phép tài xế khác nhận
      await tx.order.update({
        where: { id: orderId },
        data: { 
          driverId: null,
          note: order.note ? `${order.note} | Tài xế huỷ nhận chuyến: ${reason}` : `Tài xế huỷ nhận chuyến: ${reason}`
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { store: true, items: true, payment: true },
      });
    });

    res.json({ data: toOrderResponse(updated) });
  }),
);

// --------------------------------------------------------------------------------
// Driver Failed Order (Giao thất bại / Khách bom hàng)
// --------------------------------------------------------------------------------
orderRouter.post(
  "/:orderId/driver-failed",
  requireRole(UserRole.DRIVER),
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { reason } = req.body;
    const user = req.user!;

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new HttpError(StatusCodes.NOT_FOUND, "Order not found");
      
      if (order.driverId !== user.id) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Not your assigned order");
      }
      
      if (order.status !== OrderStatus.PICKED_UP) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Chỉ có thể báo giao thất bại khi đang đi giao.");
      }

      await cancelOrderWithSettlementRollback(tx, {
        orderId,
        reason: reason ? `Giao thất bại: ${reason}` : "Giao thất bại (Khách bom hàng)",
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { store: true, items: true, payment: true },
      });
    });

    res.json({ data: toOrderResponse(updated) });
  }),
);

export default orderRouter;
