import { atom, selector, selectorFamily, RecoilEnv } from "recoil";

// Suppress duplicate atom key warning during Vite HMR development
RecoilEnv.RECOIL_DUPLICATE_ATOM_KEY_CHECKING_ENABLED = false;
import { getLocation, getPhoneNumber, getUserInfo } from "zmp-sdk";
import logo from "static/logo.png";
import mockCategories from "./mock/categories.json";
import mockProducts from "./mock/products.json";
import mockVariants from "./mock/variants.json";
import { Category } from "types/category";
import { Product } from "types/product";
import { Cart } from "types/cart";
import { Notification } from "types/notification";
import {
  calculateDistance,
  isWithinThuDauMotServiceArea,
  THU_DAU_MOT_CENTER,
} from "utils/location";
import { Store } from "types/delivery";
import { calcFinalPrice } from "utils/product";
import { wait } from "utils/async";
import { fetchCategories, fetchOrders, fetchProducts, fetchStores } from "services/backend";

type CustomerLocation = { latitude: string; longitude: string };
type CustomerContact = { name: string; phone: string };

const DEFAULT_CUSTOMER_LOCATION: CustomerLocation = {
  latitude: String(THU_DAU_MOT_CENTER.lat),
  longitude: String(THU_DAU_MOT_CENTER.lng),
};

const DEFAULT_CUSTOMER_CONTACT: CustomerContact = {
  name: "",
  phone: "",
};

const DEFAULT_THU_DAU_MOT_STORES: Store[] = [
  {
    id: 1,
    name: "TM Food - Chánh Nghĩa",
    address: "98 Yersin, P. Hiệp Thành, TP. Thủ Dầu Một, Bình Dương",
    phone: "0274 3622 801",
    lat: 10.9824,
    long: 106.6548,
    rating: 4.8,
    eta: "12-20 phút",
  },
  {
    id: 2,
    name: "TM Food - Phú Hòa",
    address: "279 Lê Hồng Phong, P. Phú Hòa, TP. Thủ Dầu Một, Bình Dương",
    phone: "0274 3622 802",
    lat: 10.9726,
    long: 106.6725,
    rating: 4.7,
    eta: "15-25 phút",
  },
  {
    id: 3,
    name: "TM Food - Hiệp Thành",
    address: "145 Huỳnh Văn Lũy, P. Hiệp Thành, TP. Thủ Dầu Một, Bình Dương",
    phone: "0274 3622 803",
    lat: 10.9956,
    long: 106.6464,
    rating: 4.6,
    eta: "14-24 phút",
  },
  {
    id: 4,
    name: "TM Food - Thuận An",
    address: "72 Nguyễn Văn Tiết, Lái Thiêu, Thuận An, Bình Dương",
    phone: "0274 3622 804",
    lat: 10.9037,
    long: 106.7059,
    rating: 4.7,
    eta: "20-30 phút",
  },
  {
    id: 5,
    name: "TM Food - Dĩ An",
    address: "55 Trần Hưng Đạo, Dĩ An, Bình Dương",
    phone: "0274 3622 805",
    lat: 10.9109,
    long: 106.7682,
    rating: 4.5,
    eta: "22-32 phút",
  },
];

function loadManualCustomerLocation(): CustomerLocation | null {
  try {
    const raw = localStorage.getItem("tm_manual_customer_location");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.latitude === "string" &&
      typeof parsed.longitude === "string"
    ) {
      return parsed;
    }
  } catch {
    // no-op
  }
  return null;
}

function saveManualCustomerLocation(location: CustomerLocation | null) {
  if (!location) {
    localStorage.removeItem("tm_manual_customer_location");
    return;
  }
  localStorage.setItem("tm_manual_customer_location", JSON.stringify(location));
}

function loadManualCustomerContact(): CustomerContact {
  try {
    const raw = localStorage.getItem("tm_manual_customer_contact");
    if (!raw) return DEFAULT_CUSTOMER_CONTACT;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.name === "string" &&
      typeof parsed.phone === "string" &&
      parsed.name.trim() &&
      parsed.phone.trim()
    ) {
      return {
        name: parsed.name.trim(),
        phone: parsed.phone.trim(),
      };
    }
  } catch {
    // no-op
  }
  return DEFAULT_CUSTOMER_CONTACT;
}

function saveManualCustomerContact(contact: CustomerContact) {
  localStorage.setItem("tm_manual_customer_contact", JSON.stringify(contact));
}

function loadCustomerAddressText() {
  try {
    const raw = localStorage.getItem("tm_customer_address_text");
    if (!raw) return "";
    return String(raw).trim();
  } catch {
    return "";
  }
}

function saveCustomerAddressText(value: string) {
  localStorage.setItem("tm_customer_address_text", value.trim());
}

function loadManualStoreOverride(): Store | null {
  try {
    const raw = localStorage.getItem("tm_manual_store_location");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.name === "string" &&
      typeof parsed.address === "string" &&
      typeof parsed.lat === "number" &&
      typeof parsed.long === "number"
    ) {
      return parsed as Store;
    }
  } catch {
    // no-op
  }
  return null;
}

function saveManualStoreOverride(store: Store | null) {
  if (!store) {
    localStorage.removeItem("tm_manual_store_location");
    return;
  }
  localStorage.setItem("tm_manual_store_location", JSON.stringify(store));
}

function isStoreInServiceArea(store: Store) {
  return isWithinThuDauMotServiceArea(store.lat, store.long);
}

// Voucher atoms — single source of truth, used by voucherDiscountState
const defaultVouchers = [
  { code: "TMFOOD30", description: "Giảm 30K cho đơn từ 99K", discountType: "fixed", discountValue: 30000, minOrderValue: 99000, expiresAt: "2026-05-21", used: false },
  { code: "FREESHIP", description: "Miễn phí giao hàng đơn từ 49K", discountType: "fixed", discountValue: 20000, minOrderValue: 49000, expiresAt: "2026-04-30", used: false },
  { code: "WELCOME50", description: "Giảm 50% tối đa 25K cho đơn đầu", discountType: "percent", discountValue: 50, minOrderValue: 0, maxDiscount: 25000, expiresAt: "2026-06-01", used: false },
  { code: "COMBO20", description: "Giảm 20% cho combo từ 149K", discountType: "percent", discountValue: 20, minOrderValue: 149000, maxDiscount: 40000, expiresAt: "2026-05-15", used: false },
];

function loadVouchersFromStorage() {
  try {
    const raw = localStorage.getItem("tm_vouchers");
    return raw ? JSON.parse(raw) : defaultVouchers;
  } catch { return defaultVouchers; }
}

export const appliedVoucherCodeAtom = atom<string | null>({
  key: "appliedVoucherCodeAtom",
  default: null,
});

export const vouchersAtom = atom<any[]>({
  key: "vouchersAtom",
  default: loadVouchersFromStorage(),
  effects: [
    ({ onSet }) => {
      onSet((v) => localStorage.setItem("tm_vouchers", JSON.stringify(v)));
    },
  ],
});

export const userState = selector({
  key: "user",
  get: async () => {
    try {
      const { userInfo } = await getUserInfo({ autoRequestPermission: false });
      return userInfo;
    } catch { return null; }
  },
});

export const refreshActiveOrdersAtom = atom({
  key: "refreshActiveOrdersAtom",
  default: 0,
});

export const activeOrdersState = selector({
  key: "activeOrders",
  get: async ({ get }) => {
    try {
      get(refreshActiveOrdersAtom);
      const orders = await fetchOrders();
      return orders.filter(
        (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED" && o.status !== "REJECTED" && o.status !== "FAILED"
      );
    } catch {
      return [];
    }
  },
});

export const categoriesState = selector<Category[]>({
  key: "categories",
  get: async () => {
    return await fetchCategories();
  },
});

export const productsState = selector<Product[]>({
  key: "products",
  get: async () => {
    return await fetchProducts();
  },
});

export const recommendProductsState = selector<Product[]>({
  key: "recommendProducts",
  get: ({ get }) => {
    const products = get(productsState);
    return products.filter((p) => p.sale);
  },
});

export const selectedCategoryIdState = atom({
  key: "selectedCategoryId",
  default: "com",
});

export const productsByCategoryState = selectorFamily<Product[], string>({
  key: "productsByCategory",
  get:
    (categoryId) =>
    ({ get }) => {
      const allProducts = get(productsState);
      return allProducts.filter((product) =>
        product.categoryId.includes(categoryId)
      );
    },
});

export const cartState = atom<Cart>({
  key: "cart",
  default: [],
});

export const totalQuantityState = selector({
  key: "totalQuantity",
  get: ({ get }) => {
    const cart = get(cartState);
    return cart.reduce((total, item) => total + item.quantity, 0);
  },
});

export const totalPriceState = selector({
  key: "totalPrice",
  get: ({ get }) => {
    const cart = get(cartState);
    return cart.reduce(
      (total, item) =>
        total + item.quantity * calcFinalPrice(item.product, item.options),
      0
    );
  },
});

export const deliveryFeeState = selector<number>({
  key: "deliveryFee",
  get: ({ get }) => {
    const cart = get(cartState);
    if (cart.length === 0) {
      return 0;
    }
    return Math.max(...cart.map((item) => item.product.deliveryFee ?? 0));
  },
});

export const platformFeeState = selector<number>({
  key: "platformFee",
  get: ({ get }) => (get(cartState).length > 0 ? 3000 : 0),
});

export const voucherDiscountState = selector<number>({
  key: "voucherDiscount",
  get: ({ get }) => {
    try {
      const code = get(appliedVoucherCodeAtom);
      if (!code) return 0;
      const vouchers = get(vouchersAtom);
      const voucher = vouchers.find((v: any) => v.code === code && !v.used);
      if (!voucher) return 0;
      const subtotal = get(totalPriceState);
      if (subtotal < voucher.minOrderValue) return 0;
      if (voucher.discountType === "fixed") return voucher.discountValue;
      const discount = (subtotal * voucher.discountValue) / 100;
      return voucher.maxDiscount ? Math.min(discount, voucher.maxDiscount) : discount;
    } catch {
      return 0;
    }
  },
});

export const payableTotalState = selector<number>({
  key: "payableTotal",
  get: ({ get }) => {
    const subtotal = get(totalPriceState);
    const delivery = get(deliveryFeeState);
    const platform = get(platformFeeState);
    const discount = get(voucherDiscountState);
    return Math.max(0, subtotal + delivery + platform - discount);
  },
});

export const notificationsState = atom<Notification[]>({
  key: "notifications",
  default: [
    {
      id: 1,
      image: logo,
      title: "Ưu đãi tân thủ 50%",
      content:
        "Nhập mã HELLOFOOD để giảm tối đa 50.000đ cho 2 đơn đầu tiên.",
    },
    {
      id: 2,
      image: logo,
      title: "Freeship khung giờ trưa",
      content: "11:00 - 13:00 mỗi ngày, đơn từ 49.000đ được miễn phí giao hàng.",
    },
    {
      id: 3,
      image: logo,
      title: "Deal quán mới lên sàn",
      content: "Khám phá hơn 20 quán mới quanh bạn với ưu đãi giảm đến 35%.",
    },
  ],
});

export const keywordState = atom({
  key: "keyword",
  default: "",
});

export const resultState = selector<Product[]>({
  key: "result",
  get: async ({ get }) => {
    const keyword = get(keywordState);
    if (!keyword.trim()) {
      return [];
    }
    const products = get(productsState);
    await wait(500);
    return products.filter((product) =>
      product.name.trim().toLowerCase().includes(keyword.trim().toLowerCase())
    );
  },
});

export const storesState = atom<Store[]>({
  key: "stores",
  default: DEFAULT_THU_DAU_MOT_STORES,
});

export const remoteStoresState = selector<Store[]>({
  key: "remoteStores",
  get: async () => {
    const remoteStores = await fetchStores();
    const inAreaStores = remoteStores.filter(isStoreInServiceArea);
    if (inAreaStores.length > 0) {
      return inAreaStores;
    }
    console.warn(
      "Remote stores are outside Thủ Dầu Một service area, fallback to local Bình Dương stores",
    );
    return DEFAULT_THU_DAU_MOT_STORES;
  },
});

export const manualStoreOverrideState = atom<Store | null>({
  key: "manualStoreOverride",
  default: loadManualStoreOverride(),
  effects: [
    ({ onSet }) => {
      onSet((store) => saveManualStoreOverride(store));
    },
  ],
});

export const nearbyStoresState = selector<(Store & { distance?: number })[]>({
  key: "nearbyStores",
  get: ({ get }) => {
    const location = get(locationState);
    const manualStore = get(manualStoreOverrideState);
    const stores = get(storesState);

    const inAreaStores = stores.filter(isStoreInServiceArea);
    const sourceStores = inAreaStores.length > 0 ? inAreaStores : DEFAULT_THU_DAU_MOT_STORES;

    const storesWithDistance = sourceStores.map((store) => ({
      ...store,
      distance: calculateDistance(
        Number(location.latitude),
        Number(location.longitude),
        store.lat,
        store.long,
      ),
    }));

    storesWithDistance.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

    if (manualStore) {
      const manualDistance = calculateDistance(
        Number(location.latitude),
        Number(location.longitude),
        manualStore.lat,
        manualStore.long,
      );
      return [{ ...manualStore, distance: manualDistance }, ...storesWithDistance];
    }

    return storesWithDistance;
  },
});

export const selectedStoreIndexState = atom({
  key: "selectedStoreIndex",
  default: 0,
});

export const selectedStoreState = selector<Store | undefined>({
  key: "selectedStore",
  get: ({ get }) => {
    const index = get(selectedStoreIndexState);
    const stores = get(nearbyStoresState);
    if (!stores.length) {
      return undefined;
    }
    return stores[Math.min(index, stores.length - 1)];
  },
});

export const selectedDeliveryTimeState = atom({
  key: "selectedDeliveryTime",
  default: +new Date(),
});

export const requestLocationTriesState = atom({
  key: "requestLocationTries",
  default: 0,
});

export const requestPhoneTriesState = atom({
  key: "requestPhoneTries",
  default: 0,
});

export const manualCustomerContactState = atom<CustomerContact>({
  key: "manualCustomerContact",
  default: loadManualCustomerContact(),
  effects: [
    ({ onSet }) => {
      onSet((contact) => saveManualCustomerContact(contact));
    },
  ],
});

export const customerAddressTextState = atom<string>({
  key: "customerAddressText",
  default: loadCustomerAddressText(),
  effects: [
    ({ onSet }) => {
      onSet((value) => saveCustomerAddressText(value));
    },
  ],
});

export const manualCustomerLocationState = atom<CustomerLocation | null>({
  key: "manualCustomerLocation",
  default: loadManualCustomerLocation(),
  effects: [
    ({ onSet }) => {
      onSet((location) => saveManualCustomerLocation(location));
    },
  ],
});

export const locationState = selector<CustomerLocation>({
  key: "location",
  get: ({ get }) => {
    const manualLocation = get(manualCustomerLocationState);
    if (manualLocation) {
      const manualLat = Number(manualLocation.latitude);
      const manualLng = Number(manualLocation.longitude);
      if (isWithinThuDauMotServiceArea(manualLat, manualLng)) {
        return manualLocation;
      }
      console.warn("Vị trí nhập tay ngoài phạm vi giao hàng, dùng tâm Thủ Dầu Một");
      return DEFAULT_CUSTOMER_LOCATION;
    }

    const requested = get(requestLocationTriesState);
    if (!requested) {
      return DEFAULT_CUSTOMER_LOCATION;
    }

    return getLocation({ fail: console.warn })
      .then(({ latitude, longitude, token }) => {
        if (latitude && longitude) {
          const latNum = Number(latitude);
          const lngNum = Number(longitude);
          if (isWithinThuDauMotServiceArea(latNum, lngNum)) {
            return { latitude: String(latNum), longitude: String(lngNum) };
          }
          console.warn(
            "GPS ngoài phạm vi Thủ Dầu Một/lân cận Bình Dương, dùng vị trí mặc định khu vực phục vụ",
          );
          return DEFAULT_CUSTOMER_LOCATION;
        }
        if (token) {
          console.warn(
            "Sử dụng token này để truy xuất vị trí chính xác của người dùng",
            token,
          );
          console.warn(
            "Chi tiết tham khảo: ",
            "https://mini.zalo.me/blog/thong-bao-thay-doi-luong-truy-xuat-thong-tin-nguoi-dung-tren-zalo-mini-app",
          );
        }
        return DEFAULT_CUSTOMER_LOCATION;
      })
      .catch((error) => {
        console.warn("Lấy GPS thất bại", error);
        return DEFAULT_CUSTOMER_LOCATION;
      });
  },
});

export const phoneState = selector<string | boolean>({
  key: "phone",
  get: ({ get }) => {
    const requested = get(requestPhoneTriesState);
    if (!requested) {
      return false;
    }

    return getPhoneNumber({ fail: console.warn })
      .then(({ number, token }) => {
        if (number) {
          return number;
        }
        console.warn(
          "Sử dụng token này để truy xuất số điện thoại của người dùng",
          token,
        );
        console.warn(
          "Chi tiết tham khảo: ",
          "https://mini.zalo.me/blog/thong-bao-thay-doi-luong-truy-xuat-thong-tin-nguoi-dung-tren-zalo-mini-app",
        );
        return false;
      })
      .catch((error) => {
        console.error(error);
        return false;
      });
  },
});

export const effectiveCustomerPhoneState = selector<string>({
  key: "effectiveCustomerPhone",
  get: ({ get }) => {
    const phone = get(phoneState);
    const manual = get(manualCustomerContactState);
    if (typeof phone === "string" && phone.trim()) {
      return phone.trim();
    }
    return manual.phone;
  },
});

export const customerAddressDisplayState = selector<string>({
  key: "customerAddressDisplay",
  get: ({ get }) => {
    const addressText = get(customerAddressTextState).trim();
    if (addressText) {
      return addressText;
    }
    const location = get(locationState);
    const lat = Number(location.latitude).toFixed(5);
    const lng = Number(location.longitude).toFixed(5);
    return `Vị trí GPS (${lat}, ${lng}), Bình Dương`;
  },
});

export const orderNoteState = atom({
  key: "orderNote",
  default: "",
});

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  lat: number;
  long: number;
  contactName: string;
  contactPhone: string;
}

function loadSavedAddresses(): SavedAddress[] {
  try {
    const raw = localStorage.getItem("tm_saved_addresses");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSavedAddresses(addresses: SavedAddress[]) {
  localStorage.setItem("tm_saved_addresses", JSON.stringify(addresses));
}

export const savedAddressesState = atom<SavedAddress[]>({
  key: "savedAddresses",
  default: loadSavedAddresses(),
  effects: [
    ({ onSet }) => {
      onSet((newValue) => saveSavedAddresses(newValue));
    }
  ]
});
