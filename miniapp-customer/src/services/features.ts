import { atom, selector } from "recoil";
import { Product } from "types/product";

// ── Favorites ──────────────────────────
function loadFavorites(): number[] {
  try {
    const raw = localStorage.getItem("tm_favorites");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(ids: number[]) {
  localStorage.setItem("tm_favorites", JSON.stringify(ids));
}

export const favoriteIdsState = atom<number[]>({
  key: "favoriteIds",
  default: loadFavorites(),
  effects: [
    ({ onSet }) => {
      onSet((newValue) => saveFavorites(newValue));
    },
  ],
});

export function toggleFavorite(
  setFavs: (updater: (prev: number[]) => number[]) => void,
  productId: number,
) {
  setFavs((prev) =>
    prev.includes(productId)
      ? prev.filter((id) => id !== productId)
      : [...prev, productId],
  );
}

// ── Order History ──────────────────────
export interface OrderHistoryItem {
  id: string;
  date: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  status: "success" | "failed" | "pending";
  storeName: string;
}

function loadOrderHistory(): OrderHistoryItem[] {
  try {
    const raw = localStorage.getItem("tm_order_history");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOrderHistory(orders: OrderHistoryItem[]) {
  localStorage.setItem("tm_order_history", JSON.stringify(orders));
}

export const orderHistoryState = atom<OrderHistoryItem[]>({
  key: "orderHistory",
  default: loadOrderHistory(),
  effects: [
    ({ onSet }) => {
      onSet((newValue) => saveOrderHistory(newValue));
    },
  ],
});

export function addOrderToHistory(
  setOrders: (updater: (prev: OrderHistoryItem[]) => OrderHistoryItem[]) => void,
  order: OrderHistoryItem,
) {
  setOrders((prev) => [order, ...prev].slice(0, 50)); // Keep last 50
}

// ── Voucher System ─────────────────────
export interface Voucher {
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number;
  expiresAt: string;
  used: boolean;
}

const defaultVouchers: Voucher[] = [
  {
    code: "TMFOOD30",
    description: "Giảm 30K cho đơn từ 99K",
    discountType: "fixed",
    discountValue: 30000,
    minOrderValue: 99000,
    expiresAt: "2026-05-21",
    used: false,
  },
  {
    code: "FREESHIP",
    description: "Miễn phí giao hàng đơn từ 49K",
    discountType: "fixed",
    discountValue: 20000,
    minOrderValue: 49000,
    expiresAt: "2026-04-30",
    used: false,
  },
  {
    code: "WELCOME50",
    description: "Giảm 50% tối đa 25K cho đơn đầu",
    discountType: "percent",
    discountValue: 50,
    minOrderValue: 0,
    maxDiscount: 25000,
    expiresAt: "2026-06-01",
    used: false,
  },
  {
    code: "COMBO20",
    description: "Giảm 20% cho combo từ 149K",
    discountType: "percent",
    discountValue: 20,
    minOrderValue: 149000,
    maxDiscount: 40000,
    expiresAt: "2026-05-15",
    used: false,
  },
];

function loadVouchers(): Voucher[] {
  try {
    const raw = localStorage.getItem("tm_vouchers");
    return raw ? JSON.parse(raw) : defaultVouchers;
  } catch {
    return defaultVouchers;
  }
}

function saveVouchers(vouchers: Voucher[]) {
  localStorage.setItem("tm_vouchers", JSON.stringify(vouchers));
}

// Re-export voucher atoms from state.ts (single source of truth)
import { appliedVoucherCodeAtom, vouchersAtom } from "state";
export const vouchersState = vouchersAtom;
export const appliedVoucherCodeState = appliedVoucherCodeAtom;

export const appliedVoucherState = selector<Voucher | null>({
  key: "appliedVoucher",
  get: ({ get }) => {
    const code = get(appliedVoucherCodeAtom);
    if (!code) return null;
    const vouchers = get(vouchersAtom);
    return vouchers.find((v) => v.code === code && !v.used) || null;
  },
});

export function calculateVoucherDiscount(
  voucher: Voucher | null,
  orderTotal: number,
): number {
  if (!voucher) return 0;
  if (orderTotal < voucher.minOrderValue) return 0;

  if (voucher.discountType === "fixed") {
    return voucher.discountValue;
  }

  const discount = (orderTotal * voucher.discountValue) / 100;
  return voucher.maxDiscount ? Math.min(discount, voucher.maxDiscount) : discount;
}
