import { Cart } from "types/cart";
import { Category } from "types/category";
import { Product, Variant } from "types/product";
import { THU_DAU_MOT_CENTER, normalizeStoredCoordinates } from "utils/location";
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

export interface ApiOrderDriver {
  id: string;
  name: string;
  phone?: string | null;
  vehicleType?: string | null;
  licensePlate?: string | null;
}

export interface ApiOrder {
  id: string;
  status: string;
  driverId?: string | null;
  driver?: ApiOrderDriver | null;
  total: number;
  deliveryFee?: number;
  paymentMethod?: "SEPAY_QR" | "COD" | string;
  estimatedDeliveryAt?: string;
  deliveryAddress?: {
    receiverName?: string;
    phone?: string;
    street?: string;
    ward?: string;
    district?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  } | null;
  store: {
    id: string;
    name: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
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
    storeId: product.store.id,
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

export interface ProductReviewItem {
  id: string;
  rating: number;
  userName: string;
  createdAt: string;
}

export interface ProductReviewStats {
  totalReviews: number;
  averageRating: number;
  distribution: { star: number; count: number }[];
}

export interface ProductDetailResponse {
  product: Product;
  reviews: ProductReviewItem[];
  reviewStats: ProductReviewStats;
}

export async function fetchProductDetail(productId: string): Promise<ProductDetailResponse> {
  const response = await apiFetch<{ data: ApiProduct & { reviews: ProductReviewItem[]; reviewStats: ProductReviewStats } }>(`/products/${productId}`);
  return {
    product: mapApiProductToAppProduct(response.data),
    reviews: response.data.reviews ?? [],
    reviewStats: response.data.reviewStats ?? { totalReviews: 0, averageRating: 0, distribution: [] },
  };
}

export async function fetchStores() {
  const response = await apiFetch<{ data: ApiStore[] }>("/stores?limit=50");

  return response.data.map((store, index) => {
    const normalizedCoordinates = normalizeStoredCoordinates(store.latitude, store.longitude);
    return {
      id: index + 1,
      backendId: store.id,
      name: store.name,
      address: store.address,
      phone: store.phone || `0274 3622 ${String(800 + index + 1)}`,
      lat: normalizedCoordinates?.lat ?? THU_DAU_MOT_CENTER.lat + index * 0.005,
      long: normalizedCoordinates?.lng ?? THU_DAU_MOT_CENTER.lng + index * 0.005,
      rating: store.rating,
      eta: `${store.etaMinutesMin}-${store.etaMinutesMax} phút`,
    };
  });
}

export interface StoreDetail {
  id: string;
  name: string;
  address: string;
  rating: number;
  isOpen: boolean;
  etaMinutesMin: number;
  etaMinutesMax: number;
  latitude: number | null;
  longitude: number | null;
  products: ApiProduct[];
}

export async function fetchStoreDetail(storeId: string): Promise<{ store: StoreDetail; products: Product[] }> {
  const response = await apiFetch<{ data: StoreDetail }>(`/stores/${storeId}`);
  const detail = response.data;
  return {
    store: detail,
    products: detail.products.map(mapApiProductToAppProduct),
  };
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
  const t = Date.now();
  const url = status ? `/orders?status=${status}&limit=50&_t=${t}` : `/orders?limit=50&_t=${t}`;
  const response = await apiFetch<{ data: ApiOrder[] }>(url, undefined, { auth: true });
  return response.data;
}

export async function fetchOrderById(orderId: string) {
  const response = await apiFetch<{ data: ApiOrder }>(`/orders/${orderId}`, undefined, {
    auth: true,
  });
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

export async function fetchVouchers() {
  const res = await apiFetch<{ data: any[] }>('/vouchers', undefined, { auth: true });
  return res.data || [];
}

export async function validateVoucher(code: string, subtotal: number) {
  const res = await apiFetch<{ data: any }>('/vouchers/validate', {
    method: 'POST',
    body: JSON.stringify({ code, subtotal }),
  }, { auth: true });
  return res.data;
}
