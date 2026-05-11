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
import { estimateDeliveryFee } from "../services/delivery-fee";
import { validateVoucher } from "./voucher.route";
import { startDispatch } from "../services/dispatch-engine";
import { getIO } from "../socket";

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
  voucherCode: z.string().max(30).optional(),
});

const listOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  cancelReason: z.string().max(255).optional(),
});

function toOrderResponse(order: any) {
  return {
    id: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    platformFee: order.platformFee,
    discount: order.discount,
    voucherCode: order.voucherCode,
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
    customerConfirmedAt: order.customerConfirmedAt ?? null,
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
    review: order.review ?? null,
    driverReview: order.driverReview ?? null,
  };
}

orderRouter.use(requireAuth);

/* ── Estimate delivery fee (preview before checkout) ─── */

const estimateFeeQuerySchema = z.object({
  storeId: z.string().min(1),
  addressId: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

orderRouter.get(
  "/estimate-delivery-fee",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = estimateFeeQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const store = await prisma.store.findUnique({
      where: { id: query.storeId },
      select: { id: true, name: true, latitude: true, longitude: true },
    });

    if (!store) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy cửa hàng");
    }

    let customerLat = query.latitude;
    let customerLon = query.longitude;

    // Nếu client truyền addressId thì lấy tọa độ từ DB
    if (query.addressId && (customerLat == null || customerLon == null)) {
      const address = await prisma.address.findFirst({
        where: { id: query.addressId, userId },
        select: { latitude: true, longitude: true },
      });
      if (address) {
        customerLat = address.latitude ?? undefined;
        customerLon = address.longitude ?? undefined;
      }
    }

    // Nếu vẫn chưa có tọa độ → lấy từ default address
    if (customerLat == null || customerLon == null) {
      const defaultAddress = await prisma.address.findFirst({
        where: { userId, isDefault: true },
        select: { latitude: true, longitude: true },
      });
      if (defaultAddress) {
        customerLat = defaultAddress.latitude ?? undefined;
        customerLon = defaultAddress.longitude ?? undefined;
      }
    }

    const estimate = await estimateDeliveryFee(
      { latitude: store.latitude, longitude: store.longitude },
      { latitude: customerLat, longitude: customerLon },
    );

    res.json({
      data: {
        storeId: store.id,
        storeName: store.name,
        ...estimate,
      },
    });
  }),
);

/* ── Create order ──────────────────────────────────────── */

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
      throw new HttpError(StatusCodes.BAD_REQUEST, "Giỏ hàng đang trống");
    }

    const storeIds = new Set(cartItems.map((item) => item.product.storeId));
    if (storeIds.size > 1) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        "Cart contains products from multiple stores. Please checkout one store at a time.",
      );
    }

    const selectedStore = cartItems[0].product.store;
    const shouldAutoAcceptOrders = selectedStore.autoAcceptOrders === true;
    const canAutoPromoteAtCreation =
      payload.paymentMethod === PaymentMethod.COD
      || (payload.paymentMethod === PaymentMethod.SEPAY_QR && payload.autoConfirmPayment);
    const shouldConfirmOnCreate = shouldAutoAcceptOrders && canAutoPromoteAtCreation;

    if (!selectedStore.isOpen) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Cửa hàng hiện đang đóng cửa, không thể nhận đơn");
    }

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

    // ── Resolve delivery address trước ────────────────────
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
        throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy địa chỉ");
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
        "Vui lòng cung cấp địa chỉ giao hàng",
      );
    }

    // ── Tính phí ship theo khoảng cách (giống Shopee Food / Grab Food) ──
    const feeEstimate = await estimateDeliveryFee(
      { latitude: selectedStore.latitude, longitude: selectedStore.longitude },
      { latitude: deliveryAddress.latitude, longitude: deliveryAddress.longitude },
    );
    const deliveryFee = feeEstimate.fee;
    const platformFee = FINANCE_POLICY.platformFeeDefault;

    // ── Voucher discount ──
    let discount = 0;
    let voucherCode: string | undefined;
    let voucherId: string | undefined;
    if (payload.voucherCode) {
      const code = payload.voucherCode.trim().toUpperCase();
      const result = await validateVoucher(code, userId, subtotal);
      discount = result.discount;
      voucherCode = result.voucher.code;
      voucherId = result.voucher.id;
    }

    const total = subtotal + deliveryFee + platformFee - discount;

    const settlement = calculateSettlementBreakdown({
      subtotal,
      deliveryFee,
      platformFee,
    });

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
          status: shouldConfirmOnCreate ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
          paymentMethod: payload.paymentMethod,
          paymentStatus: PaymentStatus.PENDING,
          subtotal,
          deliveryFee,
          platformFee,
          discount,
          voucherCode: voucherCode ?? null,
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
          promoteOrderStatus: shouldAutoAcceptOrders,
        });
      }

      await tx.cartItem.deleteMany({ where: { userId } });

      // Ghi nhận voucher usage
      if (voucherId && voucherCode) {
        await tx.voucherUsage.create({
          data: {
            voucherId,
            userId,
            orderId: order.id,
            discount,
          },
        });
        await tx.voucher.update({
          where: { id: voucherId },
          data: { usedCount: { increment: 1 } },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          store: true,
          items: true,
          payment: true,
        },
      });
    });

    const responseData = toOrderResponse(created);

    try {
      getIO().to(`store_${created.storeId}`).emit("new_order_to_store", responseData);
    } catch (err) {
      console.warn("[Socket] Unable to emit new_order_to_store", err);
    }

    if (created.status === "CONFIRMED") {
      // Smart Dispatch: find best driver instead of broadcasting
      startDispatch(created.id).catch((err) => {
        console.error("[Dispatch] Failed to start dispatch for order", created.id, err);
      });
    }
    
    res.status(StatusCodes.CREATED).json({
      data: responseData,
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
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
    }

    if (req.user!.role !== UserRole.ADMIN && existing.userId !== req.user!.id) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Không có quyền xác nhận thanh toán đơn hàng này");
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

    if (updated.status === OrderStatus.CONFIRMED) {
      startDispatch(updated.id).catch((err) => {
        console.error("[Dispatch] Failed to start dispatch for payment confirm", updated.id, err);
      });
    }

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
        throw new HttpError(StatusCodes.FORBIDDEN, "Bạn chưa được cấp quyền quản lý cửa hàng nào");
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
          review: true,
          driverReview: true,
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
      throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
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
        throw new HttpError(StatusCodes.FORBIDDEN, "Không có quyền xem đơn hàng này");
      }

      return res.json({ data: toOrderResponse(order) });
    }

    if (role === UserRole.DRIVER) {
      if (order.driverId !== req.user!.id) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Không có quyền xem đơn hàng này");
      }

      return res.json({ data: toOrderResponse(order) });
    }

    if (order.userId !== req.user!.id) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Không có quyền xem đơn hàng này");
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
      await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const existing = await tx.order.findUnique({ where: { id: orderId } });
      if (!existing) {
        throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
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
// Store Manager Order Actions
// --------------------------------------------------------------------------------
orderRouter.post(
  "/:orderId/store-confirm",
  requireRole(UserRole.STORE_MANAGER),
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const user = req.user!;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");

      const store = await tx.store.findUnique({ where: { managerId: user.id } });
      if (!store || order.storeId !== store.id) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Không phải đơn hàng của cửa hàng bạn");
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new HttpError(StatusCodes.BAD_REQUEST, "Đơn hàng phải ở trạng thái CHỞ để xác nhận");
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { store: true, items: true, payment: true },
      });
    });

    const responseData = toOrderResponse(updated);

    // Smart Dispatch: find best driver for this newly confirmed order
    startDispatch(updated.id).catch((err) => {
      console.error("[Dispatch] Failed to start dispatch for store-confirm", updated.id, err);
    });

    res.json({ data: responseData });
  }),
);

orderRouter.post(
  "/:orderId/store-ready",
  requireRole(UserRole.STORE_MANAGER),
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const user = req.user!;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");

      const store = await tx.store.findUnique({ where: { managerId: user.id } });
      if (!store || order.storeId !== store.id) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Không phải đơn hàng của cửa hàng bạn");
      }

      if (order.status !== OrderStatus.CONFIRMED) {
        throw new HttpError(StatusCodes.BAD_REQUEST, "Đơn hàng phải ở trạng thái ĐÃ XÁC NHẬN để chuẩn bị");
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PREPARING },
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
      await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");

      if (user.role === UserRole.CUSTOMER) {
        if (order.userId !== user.id) {
          throw new HttpError(StatusCodes.FORBIDDEN, "Không phải đơn hàng của bạn");
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
          throw new HttpError(StatusCodes.FORBIDDEN, "Không phải đơn hàng của cửa hàng bạn");
        }
        if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PREPARING) {
          throw new HttpError(StatusCodes.FORBIDDEN, "Chỉ có thể hủy khi đơn đang chờ hoặc đang chuẩn bị.");
        }
      } else if (user.role !== UserRole.ADMIN) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Không có quyền huỷ đơn hàng");
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
      await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
      
      if (order.driverId !== user.id) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Không phải đơn hàng được giao cho bạn");
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
      await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
      
      if (order.driverId !== user.id) {
        throw new HttpError(StatusCodes.FORBIDDEN, "Không phải đơn hàng được giao cho bạn");
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

/* ── Confirm Received ─────────────────────────────────── */

orderRouter.post(
  "/:orderId/confirm-received",
  requireRole(UserRole.CUSTOMER),
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const user = req.user!;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
    if (order.userId !== user.id) throw new HttpError(StatusCodes.FORBIDDEN, "Đây không phải đơn hàng của bạn");
    if (order.status !== OrderStatus.DELIVERED) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Chỉ có thể xác nhận nhận hàng khi đơn đã giao");
    }
    if (order.customerConfirmedAt) {
      throw new HttpError(StatusCodes.CONFLICT, "Bạn đã xác nhận nhận hàng rồi");
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { customerConfirmedAt: new Date() },
      include: { store: true, items: true, payment: true, review: true, driverReview: true },
    });

    res.json({ data: toOrderResponse(updated), message: "Xác nhận nhận hàng thành công" });
  }),
);

/* ── Comprehensive Review (Store + Driver + Products) ── */

const comprehensiveReviewSchema = z.object({
  storeRating: z.number().int().min(1).max(5),
  driverRating: z.number().int().min(1).max(5).optional(),
  productRatings: z.array(z.object({
    productId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
  })).optional(),
  comment: z.string().max(1000).optional(),
  driverComment: z.string().max(1000).optional(),
});

orderRouter.post(
  "/:orderId/reviews",
  requireRole(UserRole.CUSTOMER),
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const payload = comprehensiveReviewSchema.parse(req.body);
    const user = req.user!;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, review: true, driverReview: true },
      });

      if (!order) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy đơn hàng");
      if (order.userId !== user.id) throw new HttpError(StatusCodes.FORBIDDEN, "Đây không phải đơn hàng của bạn");
      if (order.status !== OrderStatus.DELIVERED) {
        throw new HttpError(StatusCodes.BAD_REQUEST, "Chỉ có thể đánh giá đơn hàng đã giao thành công");
      }
      if (!order.customerConfirmedAt) {
        throw new HttpError(StatusCodes.BAD_REQUEST, "Vui lòng xác nhận đã nhận hàng trước khi đánh giá");
      }
      if (order.review) {
        throw new HttpError(StatusCodes.CONFLICT, "Bạn đã đánh giá đơn hàng này rồi");
      }

      // 1. Store review
      const review = await tx.review.create({
        data: {
          orderId: order.id,
          userId: user.id,
          storeId: order.storeId,
          rating: payload.storeRating,
          comment: payload.comment,
        },
      });

      // 2. Driver review (if driver assigned and driverRating provided)
      let driverReview = null;
      if (order.driverId && payload.driverRating && !order.driverReview) {
        driverReview = await tx.driverReview.create({
          data: {
            orderId: order.id,
            userId: user.id,
            driverId: order.driverId,
            rating: payload.driverRating,
            comment: payload.driverComment,
          },
        });
      }

      // 3. Product reviews
      const uniqueProductIds = Array.from(new Set(order.items.map(item => item.productId)));
      const productRatingsMap = new Map(payload.productRatings?.map(p => [p.productId, p]) ?? []);

      for (const productId of uniqueProductIds) {
        const productRatingData = productRatingsMap.get(productId);
        const rating = productRatingData?.rating ?? payload.storeRating;
        const comment = productRatingData?.comment;
        await tx.productReview.create({
          data: {
            orderId: order.id,
            productId: productId,
            userId: user.id,
            rating: rating,
            comment: comment,
          },
        });
      }

      // 4. Update store average rating
      const storeAggregate = await tx.review.aggregate({
        _avg: { rating: true },
        where: { storeId: order.storeId },
      });
      await tx.store.update({
        where: { id: order.storeId },
        data: { rating: storeAggregate._avg.rating ?? 0 },
      });

      // 5. Update product average ratings
      for (const productId of uniqueProductIds) {
        const productAggregate = await tx.productReview.aggregate({
          _avg: { rating: true },
          where: { productId: productId },
        });
        await tx.product.update({
          where: { id: productId },
          data: { rating: productAggregate._avg.rating ?? 0 },
        });
      }

      return { review, driverReview };
    });

    res.json({ data: result, message: "Đánh giá thành công! Cảm ơn bạn." });
  }),
);

export default orderRouter;
