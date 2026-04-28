import { DiscountType } from "@prisma/client";
import { prisma } from "../db/prisma";

const sampleVouchers = [
  {
    code: "TMFOOD30",
    description: "Giảm 30K cho đơn từ 99K",
    discountType: DiscountType.FIXED,
    discountValue: 30_000,
    minOrderValue: 99_000,
    maxUsageTotal: 100,
    maxUsagePerUser: 2,
    expiresAt: new Date("2026-06-30"),
  },
  {
    code: "FREESHIP",
    description: "Miễn phí giao hàng đơn từ 49K",
    discountType: DiscountType.FIXED,
    discountValue: 20_000,
    minOrderValue: 49_000,
    maxUsageTotal: 200,
    maxUsagePerUser: 3,
    expiresAt: new Date("2026-06-30"),
  },
  {
    code: "WELCOME50",
    description: "Giảm 50% tối đa 25K cho đơn đầu tiên",
    discountType: DiscountType.PERCENT,
    discountValue: 50,
    maxDiscount: 25_000,
    minOrderValue: 0,
    maxUsageTotal: null,
    maxUsagePerUser: 1,
    expiresAt: new Date("2026-12-31"),
  },
  {
    code: "COMBO20",
    description: "Giảm 20% tối đa 40K cho đơn từ 149K",
    discountType: DiscountType.PERCENT,
    discountValue: 20,
    maxDiscount: 40_000,
    minOrderValue: 149_000,
    maxUsageTotal: 50,
    maxUsagePerUser: 1,
    expiresAt: new Date("2026-08-31"),
  },
];

async function main() {
  for (const v of sampleVouchers) {
    const existing = await prisma.voucher.findUnique({ where: { code: v.code } });
    if (existing) {
      console.log(`Voucher ${v.code} đã tồn tại, bỏ qua`);
      continue;
    }
    await prisma.voucher.create({
      data: {
        ...v,
        startsAt: new Date(),
      },
    });
    console.log(`Đã tạo voucher: ${v.code} — ${v.description}`);
  }
  console.log("Hoàn tất seed voucher!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
