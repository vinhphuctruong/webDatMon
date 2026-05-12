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

export async function syncDriverLocation(latitude: number, longitude: number) {
  return apiFetch<{ data: any }>("/drivers/location", {
    method: "PATCH",
    body: JSON.stringify({ latitude, longitude }),
  }, { auth: true });
}

// ── Orders ──────────────────────────────────────────
export async function fetchMyOrders() {
  return apiFetch<{ data: any[] }>("/drivers/orders/mine", undefined, { auth: true });
}

export async function fetchPendingDispatchOffers() {
  return apiFetch<{ data: any[] }>("/drivers/orders/dispatch/pending", undefined, { auth: true });
}

export async function acceptDispatchOrder(orderId: string) {
  return apiFetch<{ data: any }>(`/drivers/orders/${orderId}/accept-dispatch`, {
    method: "POST",
  }, { auth: true });
}

export async function rejectDispatchOrder(orderId: string) {
  return apiFetch<{ message: string }>(`/drivers/orders/${orderId}/reject-dispatch`, {
    method: "POST",
  }, { auth: true });
}

export async function pickupOrder(orderId: string) {
  return apiFetch<{ data: any }>(`/drivers/orders/${orderId}/pickup`, {
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

export async function rejectAssignedOrder(orderId: string, reason?: string) {
  return apiFetch<{ data: any }>(`/orders/${orderId}/driver-reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  }, { auth: true });
}

// ── Wallet ──────────────────────────────────────────
export async function fetchMyWallets() {
  return apiFetch<{ data: any }>("/wallets/me", undefined, { auth: true });
}

export async function fetchWalletTransactions(walletId?: string, limit = 50) {
  const qs = walletId ? `?walletId=${walletId}&limit=${limit}` : `?limit=${limit}`;
  return apiFetch<{ data: any[] }>(`/wallets/transactions${qs}`, undefined, { auth: true });
}

export async function requestTopup(amount: number) {
  return apiFetch<{ data: any }>("/wallets/topups/sepay", {
    method: "POST",
    body: JSON.stringify({ amount }),
  }, { auth: true });
}

export async function confirmTopupMock(referenceCode: string) {
  return apiFetch<{ data: any }>(`/wallets/topups/sepay/${referenceCode}/confirm`, {
    method: "POST",
    body: JSON.stringify({}),
  }, { auth: true });
}

export async function requestPayout(payload: { amount: number; bankCode: string; bankAccountNumber: string; bankAccountName: string; note?: string }) {
  return apiFetch<{ data: any }>("/wallets/payouts", {
    method: "POST",
    body: JSON.stringify(payload),
  }, { auth: true });
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
