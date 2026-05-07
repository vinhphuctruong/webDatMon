/**
 * Script: Boost a specific driver to become "top 1" in the dispatch ranking.
 *
 * The dispatch engine scores drivers by:
 *   1. Distance (40%)  — real-time GPS (not controllable from DB)
 *   2. Performance (30%) — delivered / (delivered + cancelled), higher is better
 *   3. Batching (20%)  — neutral by default
 *   4. Idle time (10%) — longer since last delivery = higher
 *
 * This script seeds 20 DELIVERED orders (100% completion rate → perf = 1.0)
 * and sets the last completion 30+ minutes ago (idle score = 1.0).
 * It also ensures the driver profile is marked as online.
 *
 * Usage:  npx tsx src/scripts/boost-driver.ts
 */

import {
  CodHoldStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
} from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────────────
// ⚠️  CHANGE THIS to match the driver you want to boost
// ──────────────────────────────────────────────────────────────
const TARGET_DRIVER_EMAIL = "truongvinhphuc99@gmail.com";

async function main() {
  // 1. Find the driver user
  const driver = await prisma.user.findFirst({
    where: { email: { contains: TARGET_DRIVER_EMAIL }, role: "DRIVER" },
    include: { driverProfile: true },
  });

  if (!driver) {
    console.error(`❌ Không tìm thấy tài xế với email: ${TARGET_DRIVER_EMAIL}`);
    process.exit(1);
  }

  console.log(`✅ Tìm thấy tài xế: ${driver.name} (${driver.id})`);

  // 2. Ensure driver profile exists & is ONLINE
  if (!driver.driverProfile) {
    console.error("❌ Tài xế chưa có DriverProfile. Hãy duyệt đơn đăng ký trước.");
    process.exit(1);
  }

  await prisma.driverProfile.update({
    where: { userId: driver.id },
    data: { isOnline: true },
  });
  console.log("✅ Đã set tài xế isOnline = true");

  // 3. Find a store to attach the fake orders to
  const store = await prisma.store.findFirst({
    include: { products: { take: 1 } },
  });

  if (!store || store.products.length === 0) {
    console.error("❌ Không tìm thấy store/product nào trong DB.");
    process.exit(1);
  }

  const product = store.products[0];

  // 4. Find or create a customer to be the "buyer"
  let customer = await prisma.user.findFirst({
    where: { role: "CUSTOMER" },
  });

  if (!customer) {
    console.error("❌ Không tìm thấy customer nào.");
    process.exit(1);
  }

  // 5. Seed DELIVERED orders for this driver
  const ORDER_COUNT = 20;
  const now = Date.now();

  console.log(`📦 Tạo ${ORDER_COUNT} đơn DELIVERED cho tài xế...`);

  for (let i = 0; i < ORDER_COUNT; i++) {
    // Spread completedAt over the last 7 days, most recent = 35 min ago (idle ≥ 30 → score 1.0)
    const minutesAgo = 35 + i * 60 * 4; // 35 min, ~4h apart
    const completedAt = new Date(now - minutesAgo * 60_000);
    const placedAt = new Date(completedAt.getTime() - 30 * 60_000);

    const subtotal = product.price * 2;
    const deliveryFee = product.deliveryFee;
    const platformFee = 3000;
    const merchantCommission = Math.round(subtotal * 0.2);
    const driverCommission = Math.round(deliveryFee * 0.2);
    const merchantPayout = subtotal - merchantCommission;
    const driverPayout = deliveryFee - driverCommission;
    const platformRevenue = platformFee + merchantCommission + driverCommission;

    await prisma.order.create({
      data: {
        userId: customer.id,
        storeId: store.id,
        driverId: driver.id,
        status: OrderStatus.DELIVERED,
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.SUCCEEDED,
        subtotal,
        deliveryFee,
        platformFee,
        total: subtotal + deliveryFee + platformFee,
        merchantCommission,
        driverCommission,
        merchantPayout,
        driverPayout,
        platformRevenue,
        codHoldAmount: merchantPayout,
        codHoldStatus: CodHoldStatus.RELEASED,
        note: `[BOOST] Test order #${i + 1}`,
        deliveryAddress: {
          receiverName: customer.name,
          phone: customer.phone ?? "0900000000",
          street: "Test Address",
          ward: "Test Ward",
          district: "Test District",
          city: "Bình Dương",
        },
        completedAt,
        placedAt,
        createdAt: placedAt,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              unitPrice: product.price,
              quantity: 2,
              selectedOptions: {},
              lineTotal: subtotal,
            },
          ],
        },
        payment: {
          create: {
            method: PaymentMethod.COD,
            status: PaymentStatus.SUCCEEDED,
            amount: subtotal + deliveryFee + platformFee,
            paidAt: completedAt,
          },
        },
      },
    });
  }

  // 6. Summary
  const deliveredCount = await prisma.order.count({
    where: { driverId: driver.id, status: OrderStatus.DELIVERED },
  });
  const cancelledCount = await prisma.order.count({
    where: {
      driverId: driver.id,
      status: OrderStatus.CANCELLED,
      note: { contains: "Tài xế" },
    },
  });
  const completionRate = deliveredCount / (deliveredCount + cancelledCount) || 1;

  const lastOrder = await prisma.order.findFirst({
    where: { driverId: driver.id, status: OrderStatus.DELIVERED },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });

  const idleMinutes = lastOrder?.completedAt
    ? (Date.now() - lastOrder.completedAt.getTime()) / 60000
    : 0;

  console.log("\n" + "═".repeat(50));
  console.log("📊 KẾT QUẢ BOOST TÀI XẾ");
  console.log("═".repeat(50));
  console.log(`   Tài xế    : ${driver.name}`);
  console.log(`   ID        : ${driver.id}`);
  console.log(`   Online    : ✅`);
  console.log(`   Delivered : ${deliveredCount}`);
  console.log(`   Cancelled : ${cancelledCount}`);
  console.log(`   Rate      : ${(completionRate * 100).toFixed(1)}%  →  perf score = ${completionRate.toFixed(3)}`);
  console.log(`   Idle      : ${idleMinutes.toFixed(0)} phút  →  idle score = ${Math.min(1, idleMinutes / 30).toFixed(3)}`);
  console.log("═".repeat(50));
  console.log("\n🎯 Tài xế này sẽ được ưu tiên top 1 khi:");
  console.log("   1. App tài xế đang mở & gửi GPS (distance score tốt)");
  console.log("   2. Ở gần quán (≤ 2km = distance score cao nhất)");
  console.log("   3. Có đơn mới được dispatch\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
