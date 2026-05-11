import {
  CodHoldStatus,
  DiscountType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  UserRole,
  WalletOwnerType,
  WalletType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

interface MockCategory {
  id: string;
  name: string;
  icon?: string;
}

interface MockSale {
  type: "percent" | "fixed";
  percent?: number;
  amount?: number;
}

interface MockProduct {
  id: number;
  name: string;
  price: number;
  image?: string;
  description?: string;
  categoryId: string[];
  variantId?: string[];
  storeName?: string;
  rating?: number;
  sold?: string;
  deliveryFee?: number;
  sale?: MockSale;
}

interface MockVariantOption {
  id: string;
  label: string;
  priceChange?: {
    type: "fixed" | "percent";
    amount?: number;
    percent?: number;
  };
}

interface MockVariant {
  id: string;
  label: string;
  type: "single" | "multiple";
  default?: string | string[];
  options: MockVariantOption[];
}

const prisma = new PrismaClient();

// ── Inline mock data (replaces missing mock/*.json files) ──────────────────

const MOCK_CATEGORIES: MockCategory[] = [
  { id: "com", name: "Cơm", icon: "" },
  { id: "bun-pho", name: "Bún / Phở", icon: "" },
  { id: "do-uong", name: "Đồ uống", icon: "" },
  { id: "an-vat", name: "Ăn vặt", icon: "" },
  { id: "banh-mi", name: "Bánh mì", icon: "" },
  { id: "mon-chay", name: "Món chay", icon: "" },
];

const MOCK_VARIANTS: MockVariant[] = [
  {
    id: "size",
    label: "Kích cỡ",
    type: "single",
    default: "size-m",
    options: [
      { id: "size-s", label: "Nhỏ (S)" },
      { id: "size-m", label: "Vừa (M)" },
      { id: "size-l", label: "Lớn (L)", priceChange: { type: "fixed", amount: 10000 } },
    ],
  },
  {
    id: "topping",
    label: "Topping",
    type: "multiple",
    options: [
      { id: "top-trung", label: "Trứng", priceChange: { type: "fixed", amount: 5000 } },
      { id: "top-pho-mai", label: "Phô mai", priceChange: { type: "fixed", amount: 8000 } },
      { id: "top-rau", label: "Rau thêm" },
    ],
  },
];

const MOCK_PRODUCTS: MockProduct[] = [
  { id: 1, name: "Cơm sườn bì chả", price: 45000, categoryId: ["com"], storeName: "Quán Cơm Nhà Làm", rating: 4.8, sold: "1.2k", deliveryFee: 15000, description: "Cơm sườn nướng kèm bì, chả, trứng ốp la" },
  { id: 2, name: "Cơm gà xối mỡ", price: 42000, categoryId: ["com"], storeName: "Quán Cơm Nhà Làm", rating: 4.7, sold: "850", deliveryFee: 15000, description: "Gà xối mỡ giòn rụm, cơm trắng dẻo" },
  { id: 3, name: "Phở bò tái chín", price: 55000, categoryId: ["bun-pho"], storeName: "Phở Hà Nội", rating: 4.9, sold: "2.5k", deliveryFee: 18000, description: "Phở bò truyền thống, nước dùng ninh xương", variantId: ["size"] },
  { id: 4, name: "Bún bò Huế", price: 50000, categoryId: ["bun-pho"], storeName: "Phở Hà Nội", rating: 4.6, sold: "1.8k", deliveryFee: 18000, description: "Bún bò Huế cay nồng đặc trưng" },
  { id: 5, name: "Trà sữa trân châu", price: 35000, categoryId: ["do-uong"], storeName: "Trà Sữa 99", rating: 4.5, sold: "3k", deliveryFee: 12000, variantId: ["size", "topping"], description: "Trà sữa đậm vị kèm trân châu đen" },
  { id: 6, name: "Cà phê sữa đá", price: 25000, categoryId: ["do-uong"], storeName: "Trà Sữa 99", rating: 4.8, sold: "5k", deliveryFee: 10000, description: "Cà phê phin pha sữa đặc, uống lạnh" },
  { id: 7, name: "Bánh mì thịt", price: 28000, categoryId: ["banh-mi"], storeName: "Bánh Mì Sài Gòn", rating: 4.7, sold: "4.2k", deliveryFee: 10000, description: "Bánh mì giòn với patê, thịt nguội, rau sống" },
  { id: 8, name: "Gỏi cuốn tôm thịt", price: 30000, categoryId: ["an-vat"], storeName: "Quán Ăn Vặt 360", rating: 4.4, sold: "600", deliveryFee: 12000, variantId: ["topping"], description: "Gỏi cuốn tươi mát, chấm tương đậu phộng" },
  { id: 9, name: "Cơm chiên dương châu", price: 40000, categoryId: ["com"], storeName: "Quán Cơm Nhà Làm", rating: 4.5, sold: "900", deliveryFee: 15000, sale: { type: "percent", percent: 0.1 }, description: "Cơm chiên với tôm, lạp xưởng, trứng" },
  { id: 10, name: "Bún chả Hà Nội", price: 48000, categoryId: ["bun-pho"], storeName: "Phở Hà Nội", rating: 4.7, sold: "1.5k", deliveryFee: 18000, description: "Bún chả kèm nem cua bể" },
  { id: 11, name: "Cơm chay rau củ", price: 35000, categoryId: ["com", "mon-chay"], storeName: "Chay Tâm An", rating: 4.3, sold: "300", deliveryFee: 15000, description: "Cơm chay với đậu hủ, rau củ xào" },
  { id: 12, name: "Phở chay nấm", price: 45000, categoryId: ["bun-pho", "mon-chay"], storeName: "Chay Tâm An", rating: 4.4, sold: "250", deliveryFee: 15000, description: "Phở chay nước dùng rau củ, nấm đông cô" },
];

// ───────────────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function parseSoldCount(raw?: string): number {
  if (!raw) return 0;
  const normalized = raw.trim().toLowerCase().replace(/,/g, ".");
  if (normalized.endsWith("k")) {
    const value = Number(normalized.slice(0, -1));
    return Number.isFinite(value) ? Math.round(value * 1000) : 0;
  }
  const value = Number(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function calculateSettlement(subtotal: number, deliveryFee: number, platformFee: number) {
  const merchantCommission = Math.round(subtotal * 0.2);
  const driverCommission = Math.round(deliveryFee * 0.2);
  const merchantPayout = subtotal - merchantCommission;
  const driverPayout = deliveryFee - driverCommission;
  const platformRevenue = platformFee + merchantCommission + driverCommission;

  return {
    merchantCommission,
    driverCommission,
    merchantPayout,
    driverPayout,
    platformRevenue,
  };
}

function optionPriceDelta(option: MockVariantOption, basePrice: number): number {
  if (!option.priceChange) return 0;
  if (option.priceChange.type === "fixed") {
    return option.priceChange.amount ?? 0;
  }
  const percent = option.priceChange.percent ?? 0;
  return Math.round(basePrice * percent);
}

async function resetDatabase() {
  await prisma.walletTransaction.deleteMany();
  await prisma.walletPayout.deleteMany();
  await prisma.sePayTopupRequest.deleteMany();
  await prisma.orderPayment.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.driverProfile.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.option.deleteMany();
  await prisma.optionGroup.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.store.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  const categories = MOCK_CATEGORIES;
  const products = MOCK_PRODUCTS;
  const variants = MOCK_VARIANTS;

  await resetDatabase();

  const passwordHash = await bcrypt.hash("12345678", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@tmfood.local",
      name: "TM Food Admin",
      role: UserRole.ADMIN,
      passwordHash,
      phone: "0900000001",
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: "customer@tmfood.local",
      name: "Khach Hang Demo",
      role: UserRole.CUSTOMER,
      passwordHash,
      phone: "0900000002",
    },
  });

  const driver = await prisma.user.create({
    data: {
      email: "driver1@tmfood.local",
      name: "Tai Xe Demo 1",
      role: UserRole.DRIVER,
      passwordHash,
      phone: "0900000003",
      driverProfile: {
        create: {
          vehicleType: "Xe may",
          licensePlate: "59A1-12345",
          isOnline: true,
        },
      },
    },
  });

  await prisma.address.create({
    data: {
      userId: customer.id,
      label: "Nha rieng",
      receiverName: "Khach Hang Demo",
      phone: "0900000002",
      street: "12 Nguyen Hue",
      ward: "Ben Nghe",
      district: "Quan 1",
      city: "Ho Chi Minh",
      isDefault: true,
      latitude: 10.77314,
      longitude: 106.70236,
    },
  });

  for (const category of categories) {
    await prisma.category.create({
      data: {
        key: category.id,
        name: category.name,
        slug: slugify(category.name),
        iconUrl: category.icon,
      },
    });
  }

  const uniqueStoreNames = Array.from(
    new Set(products.map((item) => item.storeName ?? "Quan Doi Tac")),
  );

  const storeAddressFallback = [
    "56 Yersin, P. Hiệp Thành, Thủ Dầu Một, Bình Dương",
    "124 Cách Mạng Tháng 8, P. Phú Cường, Thủ Dầu Một, Bình Dương",
    "88 Phú Lợi, P. Phú Hòa, Thủ Dầu Một, Bình Dương",
    "189 Đại Lộ Bình Dương, P. Phú Thọ, Thủ Dầu Một, Bình Dương",
    "33 Thích Quảng Đức, P. Phú Cường, Thủ Dầu Một, Bình Dương",
    "15 Huỳnh Văn Lũy, P. Phú Lợi, Thủ Dầu Một, Bình Dương",
  ];

  const storeCoordinatesFallback = [
    { lat: 10.9856, lng: 106.6685 },
    { lat: 10.9780, lng: 106.6720 },
    { lat: 10.9815, lng: 106.6850 },
    { lat: 10.9720, lng: 106.6755 },
    { lat: 10.9795, lng: 106.6710 },
    { lat: 10.9880, lng: 106.6820 },
  ];

  const storeIdByName = new Map<string, string>();

  for (const [index, storeName] of uniqueStoreNames.entries()) {
    const managerEmail = `manager${index + 1}@tmfood.local`;
    const manager = await prisma.user.create({
      data: {
        email: managerEmail,
        name: `Store Manager ${index + 1}`,
        role: UserRole.STORE_MANAGER,
        passwordHash,
      },
    });

    const store = await prisma.store.create({
      data: {
        name: storeName,
        slug: `${slugify(storeName)}-${index + 1}`,
        address: storeAddressFallback[index % storeAddressFallback.length],
        latitude: storeCoordinatesFallback[index % storeCoordinatesFallback.length].lat,
        longitude: storeCoordinatesFallback[index % storeCoordinatesFallback.length].lng,
        rating: 4.5 + ((index % 4) * 0.1),
        etaMinutesMin: 15 + (index % 3) * 5,
        etaMinutesMax: 25 + (index % 3) * 8,
        managerId: manager.id,
      },
    });

    storeIdByName.set(storeName, store.id);
  }

  const platformEscrowWallet = await prisma.wallet.create({
    data: {
      ownerType: WalletOwnerType.PLATFORM,
      type: WalletType.PLATFORM_ESCROW,
      scopeKey: `PLATFORM:${WalletType.PLATFORM_ESCROW}`,
      availableBalance: 0,
    },
  });

  const platformRevenueWallet = await prisma.wallet.create({
    data: {
      ownerType: WalletOwnerType.PLATFORM,
      type: WalletType.PLATFORM_REVENUE,
      scopeKey: `PLATFORM:${WalletType.PLATFORM_REVENUE}`,
      availableBalance: 0,
    },
  });

  const merchantWalletIdByStoreId = new Map<string, string>();
  for (const storeId of storeIdByName.values()) {
    const merchantWallet = await prisma.wallet.create({
      data: {
        ownerType: WalletOwnerType.STORE,
        ownerStoreId: storeId,
        type: WalletType.MERCHANT,
        scopeKey: `STORE:${storeId}:${WalletType.MERCHANT}`,
        availableBalance: 0,
      },
    });

    merchantWalletIdByStoreId.set(storeId, merchantWallet.id);
  }

  const driverCreditWallet = await prisma.wallet.create({
    data: {
      ownerType: WalletOwnerType.USER,
      ownerUserId: driver.id,
      type: WalletType.DRIVER_CREDIT,
      scopeKey: `USER:${driver.id}:${WalletType.DRIVER_CREDIT}`,
      availableBalance: 500000,
    },
  });

  const driverCashWallet = await prisma.wallet.create({
    data: {
      ownerType: WalletOwnerType.USER,
      ownerUserId: driver.id,
      type: WalletType.DRIVER_CASH,
      scopeKey: `USER:${driver.id}:${WalletType.DRIVER_CASH}`,
      availableBalance: 150000,
    },
  });

  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const productsByStore = new Map<
    string,
    { id: string; name: string; price: number; deliveryFee: number }[]
  >();

  for (const product of products) {
    const storeName = product.storeName ?? uniqueStoreNames[0];
    const storeId = storeIdByName.get(storeName);

    if (!storeId) {
      throw new Error(`Store not found for product ${product.name}`);
    }

    const discountType =
      product.sale?.type === "percent"
        ? DiscountType.PERCENT
        : product.sale?.type === "fixed"
          ? DiscountType.FIXED
          : null;

    const discountValue =
      product.sale?.type === "percent"
        ? Math.round((product.sale.percent ?? 0) * 100)
        : product.sale?.type === "fixed"
          ? Math.round(product.sale.amount ?? 0)
          : null;

    const optionGroups = (product.variantId ?? [])
      .map((variantId, groupIndex) => {
        const variant = variantById.get(variantId);
        if (!variant) return null;

        const defaultValues = Array.isArray(variant.default)
          ? variant.default
          : variant.default
            ? [variant.default]
            : [];

        return {
          key: variant.id,
          name: variant.label,
          minSelect: variant.type === "single" ? 1 : 0,
          maxSelect: variant.type === "single" ? 1 : variant.options.length,
          isRequired: variant.type === "single",
          sortOrder: groupIndex,
          options: {
            create: variant.options.map((option, optionIndex) => ({
              key: option.id,
              name: option.label,
              priceDelta: optionPriceDelta(option, product.price),
              isDefault: defaultValues.includes(option.id),
              sortOrder: optionIndex,
            })),
          },
        };
      })
      .filter((group): group is NonNullable<typeof group> => Boolean(group));

    const createdProduct = await prisma.product.create({
      data: {
        externalId: product.id,
        storeId,
        name: product.name,
        slug: `${slugify(product.name)}-${product.id}`,
        description: product.description,
        imageUrl: product.image,
        price: product.price,
        discountType,
        discountValue,
        rating: product.rating ?? 4.7,
        soldCount: parseSoldCount(product.sold),
        deliveryFee: product.deliveryFee ?? 15000,
        categories: {
          create: product.categoryId.map((categoryKey) => ({
            category: {
              connect: {
                key: categoryKey,
              },
            },
          })),
        },
        optionGroups: {
          create: optionGroups,
        },
      },
    });

    const storeProducts = productsByStore.get(storeId) ?? [];
    storeProducts.push({
      id: createdProduct.id,
      name: createdProduct.name,
      price: createdProduct.price,
      deliveryFee: createdProduct.deliveryFee,
    });
    productsByStore.set(storeId, storeProducts);
  }

  const sampleStoreId = Array.from(storeIdByName.values())[0];
  const sampleStoreProducts = sampleStoreId ? productsByStore.get(sampleStoreId) ?? [] : [];

  let merchantRevenueTotal = 0;
  let driverCashEarningTotal = 0;
  let platformRevenueTotal = 0;
  let codFeeChargeTotal = 0;

  for (let index = 0; index < Math.min(6, sampleStoreProducts.length + 3); index += 1) {
    if (!sampleStoreId || sampleStoreProducts.length === 0) {
      break;
    }

    const item = sampleStoreProducts[index % sampleStoreProducts.length];
    const quantity = (index % 3) + 1;
    const subtotal = item.price * quantity;
    const deliveryFee = item.deliveryFee;
    const platformFee = 3000;
    const settlement = calculateSettlement(subtotal, deliveryFee, platformFee);
    const isCod = index % 2 === 1;
    const completedAt = new Date();
    completedAt.setDate(completedAt.getDate() - index);

    await prisma.order.create({
      data: {
        userId: customer.id,
        storeId: sampleStoreId,
        driverId: driver.id,
        status: OrderStatus.DELIVERED,
        paymentMethod: isCod ? PaymentMethod.COD : PaymentMethod.SEPAY_QR,
        paymentStatus: PaymentStatus.SUCCEEDED,
        subtotal,
        deliveryFee,
        platformFee,
        total: subtotal + deliveryFee + platformFee,
        merchantCommission: settlement.merchantCommission,
        driverCommission: settlement.driverCommission,
        merchantPayout: settlement.merchantPayout,
        driverPayout: settlement.driverPayout,
        platformRevenue: settlement.platformRevenue,
        codHoldAmount: isCod ? settlement.merchantPayout : 0,
        codHoldStatus: isCod ? CodHoldStatus.RELEASED : CodHoldStatus.NONE,
        note: isCod ? "Sample COD order" : "Sample SePay cashless order",
        deliveryAddress: {
          receiverName: "Khach Hang Demo",
          phone: "0900000002",
          street: "12 Nguyen Hue",
          ward: "Ben Nghe",
          district: "Quan 1",
          city: "Ho Chi Minh",
        },
        estimatedDeliveryAt: new Date(completedAt.getTime() + 20 * 60_000),
        completedAt,
        placedAt: new Date(completedAt.getTime() - 30 * 60_000),
        createdAt: new Date(completedAt.getTime() - 35 * 60_000),
        updatedAt: completedAt,
        items: {
          create: [
            {
              productId: item.id,
              productName: item.name,
              unitPrice: item.price,
              quantity,
              selectedOptions: {},
              lineTotal: subtotal,
            },
          ],
        },
        payment: {
          create: {
            method: isCod ? PaymentMethod.COD : PaymentMethod.SEPAY_QR,
            status: PaymentStatus.SUCCEEDED,
            amount: subtotal + deliveryFee + platformFee,
            sepayReferenceCode: isCod ? null : `ORDER-SEED-${index + 1}`,
            sepayQrContent: isCod ? null : `SEPAY|ORDER-SEED-${index + 1}`,
            sepayTransactionId: isCod ? null : `SEPAY-TXN-SEED-${index + 1}`,
            paidAt: completedAt,
          },
        },
      },
    });

    merchantRevenueTotal += settlement.merchantPayout;
    platformRevenueTotal += settlement.platformRevenue;

    if (isCod) {
      codFeeChargeTotal += settlement.platformRevenue;
    } else {
      driverCashEarningTotal += settlement.driverPayout;
    }
  }

  if (sampleStoreId) {
    const merchantWalletId = merchantWalletIdByStoreId.get(sampleStoreId);
    if (merchantWalletId) {
      await prisma.wallet.update({
        where: { id: merchantWalletId },
        data: {
          availableBalance: merchantRevenueTotal,
        },
      });
    }
  }

  await prisma.wallet.update({
    where: { id: platformRevenueWallet.id },
    data: {
      availableBalance: platformRevenueTotal,
    },
  });

  await prisma.wallet.update({
    where: { id: platformEscrowWallet.id },
    data: {
      availableBalance: 0,
    },
  });

  await prisma.wallet.update({
    where: { id: driverCashWallet.id },
    data: {
      availableBalance: 150000 + driverCashEarningTotal,
    },
  });

  await prisma.wallet.update({
    where: { id: driverCreditWallet.id },
    data: {
      availableBalance: Math.max(10000, 500000 - codFeeChargeTotal),
    },
  });

  console.log("Seed completed");
  console.log(`Admin login: ${admin.email} / 12345678`);
  console.log(`Customer login: ${customer.email} / 12345678`);
  console.log(`Driver login: ${driver.email} / 12345678`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
