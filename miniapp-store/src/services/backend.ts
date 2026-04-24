import { Cart } from "types/cart";
import { Category } from "types/category";
import { Product, Variant } from "types/product";
import { THU_DAU_MOT_CENTER } from "utils/location";
import { apiFetch } from "./api";

interface ApiCategory {
  id: string;
  key: string;
  name: string;
  iconUrl?: string | null;
}

interface ApiOption {
  id: string;
  key: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

interface ApiOptionGroup {
  id: string;
  key: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: ApiOption[];
}

interface ApiProduct {
  id: string;
  externalId?: number | null;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  discount?: {
    type: "PERCENT" | "FIXED";
    value: number;
  } | null;
  rating: number;
  soldCount: number;
  deliveryFee: number;
  isAvailable: boolean;
  store: {
    id: string;
    name: string;
    rating: number;
    etaMinutesMin: number;
    etaMinutesMax: number;
  };
  categories: {
    key: string;
  }[];
  optionGroups: ApiOptionGroup[];
}

interface ApiStore {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  rating: number;
  etaMinutesMin: number;
  etaMinutesMax: number;
  latitude?: number | null;
  longitude?: number | null;
}

interface ApiCartItem {
  id: string;
  quantity: number;
  selectedOptions: Record<string, string | string[]>;
  product: ApiProduct;
}

interface ApiCartSummary {
  items: ApiCartItem[];
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  total: number;
}

interface ApiOrder {
  id: string;
  status: string;
  total: number;
  estimatedDeliveryAt?: string;
  store: {
    id: string;
    name: string;
  };
  items: {
    id: string;
    productName: string;
    quantity: number;
  }[];
}

function mapOptionGroupToVariant(group: ApiOptionGroup): Variant {
  const options = group.options.map((option) => ({
    id: option.key,
    label: option.name,
    ...(option.priceDelta
      ? {
          priceChange: {
            type: "fixed" as const,
            amount: option.priceDelta,
          },
        }
      : {}),
  }));

  const defaultOptions = group.options.filter((option) => option.isDefault);

  if (group.maxSelect === 1) {
    return {
      id: group.key,
      label: group.name,
      type: "single",
      default: defaultOptions[0]?.key,
      options,
    };
  }

  return {
    id: group.key,
    label: group.name,
    type: "multiple",
    default: defaultOptions.map((option) => option.key),
    options,
  };
}

export function mapApiProductToAppProduct(product: ApiProduct): Product {
  return {
    id: product.externalId ?? product.id,
    backendId: product.id,
    name: product.name,
    image: product.imageUrl || "",
    description: product.description || "",
    price: product.price,
    categoryId: product.categories.map((category) => category.key),
    variants: product.optionGroups.map(mapOptionGroupToVariant),
    storeName: product.store.name,
    rating: product.rating,
    sold: String(product.soldCount),
    eta: `${product.store.etaMinutesMin}-${product.store.etaMinutesMax} phút`,
    deliveryFee: product.deliveryFee,
    sale: product.discount
      ? product.discount.type === "PERCENT"
        ? {
            type: "percent",
            percent: product.discount.value / 100,
          }
        : {
            type: "fixed",
            amount: product.discount.value,
          }
      : undefined,
  };
}

function mapApiCartToAppCart(summary: ApiCartSummary): Cart {
  return summary.items.map((item) => ({
    id: item.id,
    product: mapApiProductToAppProduct(item.product),
    options: item.selectedOptions,
    quantity: item.quantity,
  }));
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await apiFetch<{ data: ApiCategory[] }>("/categories");

  return response.data.map((category) => ({
    id: category.key,
    name: category.name,
    icon: category.iconUrl || "",
  }));
}

export async function fetchProducts(): Promise<Product[]> {
  const response = await apiFetch<{ data: ApiProduct[] }>("/products?limit=50");
  return response.data.map(mapApiProductToAppProduct);
}

export async function fetchStores() {
  const response = await apiFetch<{ data: ApiStore[] }>("/stores?limit=50");

  return response.data.map((store, index) => ({
    id: index + 1,
    backendId: store.id,
    name: store.name,
    address: store.address,
    phone: store.phone || `0274 3622 ${String(800 + index + 1)}`,
    lat: store.latitude ?? THU_DAU_MOT_CENTER.lat + index * 0.005,
    long: store.longitude ?? THU_DAU_MOT_CENTER.lng + index * 0.005,
    rating: store.rating,
    eta: `${store.etaMinutesMin}-${store.etaMinutesMax} phút`,
  }));
}

export async function fetchCart() {
  const response = await apiFetch<{ data: ApiCartSummary }>("/cart", undefined, {
    auth: true,
  });
  return mapApiCartToAppCart(response.data);
}

export async function addItemToCart(payload: {
  productBackendId?: string;
  productExternalId?: number;
  quantity: number;
  selectedOptions: Record<string, string | string[]>;
}) {
  const response = await apiFetch<{ data: ApiCartSummary }>(
    "/cart/items",
    {
      method: "POST",
      body: JSON.stringify({
        productId: payload.productBackendId,
        externalProductId: payload.productExternalId,
        quantity: payload.quantity,
        selectedOptions: payload.selectedOptions,
      }),
    },
    { auth: true },
  );

  return mapApiCartToAppCart(response.data);
}

export async function updateCartItem(
  itemId: string,
  payload: {
    quantity: number;
    selectedOptions: Record<string, string | string[]>;
  },
) {
  const response = await apiFetch<{ data: ApiCartSummary }>(
    `/cart/items/${itemId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    { auth: true },
  );

  return mapApiCartToAppCart(response.data);
}

export async function removeCartItem(itemId: string) {
  await apiFetch(`/cart/items/${itemId}`, { method: "DELETE" }, { auth: true });
  return fetchCart();
}

export async function clearCartRemote() {
  await apiFetch("/cart", { method: "DELETE" }, { auth: true });
}

export interface DeliveryAddressPayload {
  receiverName: string;
  phone: string;
  street: string;
  ward: string;
  district: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export interface CreateOrderPayload {
  note?: string;
  deliveryAddress?: DeliveryAddressPayload;
  paymentMethod?: "SEPAY_QR" | "COD";
  autoConfirmPayment?: boolean;
}

export async function createOrder(payload?: CreateOrderPayload) {
  const response = await apiFetch<{ data: ApiOrder }>(
    "/orders",
    {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    },
    { auth: true },
  );

  return response.data;
}

export async function fetchOrders(status?: string) {
  const url = status ? `/orders?status=${status}&limit=50` : `/orders?limit=50`;
  const response = await apiFetch<{ data: ApiOrder[] }>(url, undefined, { auth: true });
  return response.data;
}

// --- STORE APPLICATIONS ---
export async function submitStoreApplication(data: {
  storeName: string;
  storeAddress: string;
  storeLatitude?: number | null;
  storeLongitude?: number | null;
  storePhone: string;
  frontStoreImageData?: string;
  businessLicenseImageData?: string;
}) {
  const response = await apiFetch<any>("/store-applications", {
    method: "POST",
    body: JSON.stringify(data),
  }, { auth: true });

  return response;
}

export async function getMyStoreApplication() {
  try {
    const response = await apiFetch<any>("/store-applications/me", undefined, { auth: true });
    return response;
  } catch (error: any) {
    if (error.message && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}
