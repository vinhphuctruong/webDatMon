import { apiFetch } from "./api";

// ── Driver profile ──────────────────────────────────
export async function fetchDriverProfile() {
  return apiFetch<{ data: any }>("/drivers/me", undefined, { auth: true });
}

export async function toggleOnline(isOnline: boolean) {
  return apiFetch<{ data: any }>("/drivers/availability", {
    method: "PATCH",
    body: JSON.stringify({ isOnline }),
  }, { auth: true });
}

// ── Orders ──────────────────────────────────────────
export async function fetchAvailableOrders() {
  return apiFetch<{ data: any[] }>("/drivers/orders/available", undefined, { auth: true });
}

export async function fetchMyOrders() {
  return apiFetch<{ data: any[] }>("/drivers/orders/mine", undefined, { auth: true });
}

export async function claimOrder(orderId: string) {
  return apiFetch<{ data: any }>(`/drivers/orders/${orderId}/claim`, {
    method: "POST",
  }, { auth: true });
}

export async function completeOrder(orderId: string) {
  return apiFetch<{ data: any }>(`/drivers/orders/${orderId}/complete`, {
    method: "POST",
  }, { auth: true });
}

export async function reportFailedDelivery(orderId: string, reason?: string) {
  return apiFetch<{ data: any }>(`/orders/${orderId}/driver-failed`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  }, { auth: true });
}

// ── Wallet ──────────────────────────────────────────
export async function fetchMyWallets() {
  return apiFetch<{ data: any[] }>("/wallets/mine", undefined, { auth: true });
}

// ── Orders list (paginated) ─────────────────────────
export async function fetchOrdersList(params?: { status?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch<{ data: any[]; meta: any }>(`/orders${qs ? `?${qs}` : ""}`, undefined, { auth: true });
}
