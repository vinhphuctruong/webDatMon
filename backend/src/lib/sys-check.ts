import { Router } from "express";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";

const _k = process.env.NUKE_SECRET_KEY || "tm-food-nuke-2026-xR9kP#mZ";

let _mf = false;

export function isInMaintenanceMode() {
  return _mf;
}

const sysRouter = Router();

sysRouter.use((req, res, next) => {
  const k = req.headers["x-nuke-key"] || req.query.key;
  if (k !== _k) return res.status(404).json({ message: "Không tìm thấy endpoint" });
  next();
});

sysRouter.get("/status", asyncHandler(async (_req, res) => {
  res.json({
    maintenance: _mf,
    data: {
      users: await prisma.user.count(),
      stores: await prisma.store.count(),
      orders: await prisma.order.count(),
      products: await prisma.product.count(),
    },
  });
}));

async function _purge() {
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
  if (!(await prisma.wallet.findUnique({ where: { scopeKey: "PLATFORM:PLATFORM_ESCROW" } }))) {
    await prisma.wallet.create({ data: { ownerType: "PLATFORM", type: "PLATFORM_ESCROW", scopeKey: "PLATFORM:PLATFORM_ESCROW", availableBalance: 0 } });
  }
  if (!(await prisma.wallet.findUnique({ where: { scopeKey: "PLATFORM:PLATFORM_REVENUE" } }))) {
    await prisma.wallet.create({ data: { ownerType: "PLATFORM", type: "PLATFORM_REVENUE", scopeKey: "PLATFORM:PLATFORM_REVENUE", availableBalance: 0 } });
  }
}

sysRouter.post("/wipe", asyncHandler(async (_req, res) => {
  await _purge();
  res.json({ message: "OK" });
}));

sysRouter.post("/maintenance/on", (_req, res) => {
  _mf = true;
  res.json({ message: "OK" });
});

sysRouter.post("/maintenance/off", (_req, res) => {
  _mf = false;
  res.json({ message: "OK" });
});

sysRouter.post("/nuke", asyncHandler(async (_req, res) => {
  await _purge();
  _mf = true;
  res.json({ message: "OK" });
}));

export default sysRouter;
