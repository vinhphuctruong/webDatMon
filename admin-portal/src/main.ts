import "./style.css";

type UserRole = "CUSTOMER" | "ADMIN" | "STORE_MANAGER" | "DRIVER";
type PartnerApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
type TabKey = "overview" | "stores" | "driver-applications" | "store-applications";

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface LoginResponse {
  user: AdminUser;
  tokens: SessionTokens;
}

interface ApiListResponse<T> {
  data: T;
  message?: string;
}

interface Store {
  id: string;
  name: string;
  address: string;
  rating: number;
  etaMinutesMin: number;
  etaMinutesMax: number;
  isOpen: boolean;
  manager: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface DriverApplication {
  id: string;
  fullName: string;
  dateOfBirth: string;
  createdAt: string;
  email: string;
  phone: string | null;
  vehicleType: string;
  licensePlate: string;
  portraitImageData: string;
  idCardImageData: string;
  driverLicenseImageData: string;
  portraitQualityScore: number;
  idCardQualityScore: number;
  driverLicenseQualityScore: number;
  status: PartnerApplicationStatus;
  adminNote: string | null;
  reviewedAt: string | null;
}

interface StoreApplication {
  id: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeLatitude: number | null;
  storeLongitude: number | null;
  frontStoreImageData: string | null;
  businessLicenseImageData: string | null;
  status: PartnerApplicationStatus;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  applicant: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

interface OverviewMetrics {
  totalUsers: number;
  totalStores: number;
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  deliveringOrders: number;
  deliveredToday: number;
  cancelledToday: number;
  revenueToday: number;
  pendingDriverApplications: number;
}

interface OverviewOrderStatus {
  status: string;
  count: number;
}

interface OverviewLatestOrder {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  store: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface OverviewPayload {
  metrics: OverviewMetrics;
  orderStatusDistribution: OverviewOrderStatus[];
  latestOrders: OverviewLatestOrder[];
}

interface Elements {
  loginView: HTMLElement;
  appView: HTMLElement;
  loginForm: HTMLFormElement;
  loginEmail: HTMLInputElement;
  loginPassword: HTMLInputElement;
  loginError: HTMLElement;
  loginButton: HTMLButtonElement;
  currentAdmin: HTMLElement;
  logoutButton: HTMLButtonElement;
  metricsGrid: HTMLElement;
  orderDistribution: HTMLElement;
  latestOrdersBody: HTMLElement;
  storesBody: HTMLElement;
  createStoreForm: HTMLFormElement;
  driverStatusFilter: HTMLSelectElement;
  driverApplicationsBody: HTMLElement;
  storeStatusFilter: HTMLSelectElement;
  storeApplicationsBody: HTMLElement;
  refreshOverview: HTMLButtonElement;
  refreshStores: HTMLButtonElement;
  refreshDriverApplications: HTMLButtonElement;
  refreshStoreApplications: HTMLButtonElement;
  flash: HTMLElement;
}

const SESSION_STORAGE_KEY = "zaui_food_admin_portal_session";
const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
const currencyFormatter = new Intl.NumberFormat("vi-VN");
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

let flashTimer: number | undefined;

const state: {
  tokens: SessionTokens | null;
  user: AdminUser | null;
  activeTab: TabKey;
  overview: OverviewPayload | null;
  stores: Store[];
  driverApplications: DriverApplication[];
  storeApplications: StoreApplication[];
} = {
  tokens: null,
  user: null,
  activeTab: "overview",
  overview: null,
  stores: [],
  driverApplications: [],
  storeApplications: [],
};

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Cannot find #app container");
}

appRoot.innerHTML = `
  <div class="ambient-bg" aria-hidden="true">
    <div class="orb orb-a"></div>
    <div class="orb orb-b"></div>
    <div class="orb orb-c"></div>
  </div>

  <div class="portal">
    <header class="portal-topbar">
      <div class="brand">
        <span class="badge-dot"></span>
        <div>
          <p class="brand-kicker">TM Food Ops</p>
          <h1>Admin Command Deck</h1>
        </div>
      </div>
      <p class="topbar-note">Quan ly van hanh cua hang, doi tac va xet duyet ho so</p>
    </header>

    <section id="login-view" class="login-layout card-surface">
      <div class="login-copy">
        <p class="eyebrow">Admin access only</p>
        <h2>Dang nhap vao trung tam quan tri</h2>
        <p>
          Theo doi trang thai don hang, mo/rong cua hang, va duyet doi tac tai xe, doi tac cua hang
          trong mot dashboard duy nhat.
        </p>
        <div class="pill-row">
          <span class="pill">Dashboard tong quan</span>
          <span class="pill">Quan ly cua hang</span>
          <span class="pill">Duyet ho so doi tac</span>
        </div>
      </div>

      <form id="login-form" class="login-form">
        <h3>Dang nhap admin</h3>
        <label class="field">
          <span>Email</span>
          <input id="login-email" name="email" type="email" required placeholder="admin@tmfood.local" />
        </label>
        <label class="field">
          <span>Mat khau</span>
          <input id="login-password" name="password" type="password" required placeholder="********" />
        </label>
        <button id="login-button" type="submit">Dang nhap</button>
        <p class="hint-text">Demo: <code>admin@tmfood.local / 12345678</code></p>
        <p id="login-error" class="error-text" role="alert"></p>
      </form>
    </section>

    <section id="app-view" class="app-view hidden">
      <div class="shell-grid">
        <aside class="sidebar card-surface">
          <p class="sidebar-label">Dieu huong</p>
          <button class="nav-button active" type="button" data-tab="overview">Tong quan</button>
          <button class="nav-button" type="button" data-tab="stores">Cua hang</button>
          <button class="nav-button" type="button" data-tab="driver-applications">Ho so tai xe</button>
          <button class="nav-button" type="button" data-tab="store-applications">Ho so cua hang</button>
        </aside>

        <main class="workspace">
          <header class="workspace-head card-surface">
            <div>
              <p class="eyebrow">Nguoi dang nhap</p>
              <h2 id="current-admin">admin@tmfood.local</h2>
            </div>
            <button id="logout-button" class="btn-danger" type="button">Dang xuat</button>
          </header>

          <section class="panel card-surface" data-section="overview">
            <div class="section-head">
              <div>
                <p class="eyebrow">Overview</p>
                <h3>Toan canh van hanh</h3>
              </div>
              <button id="refresh-overview" class="btn-secondary" type="button">Lam moi</button>
            </div>

            <div id="metrics-grid" class="metrics-grid"></div>

            <div class="split-grid">
              <article class="sub-panel">
                <h4>Phan bo trang thai don</h4>
                <div id="order-distribution" class="status-pills"></div>
              </article>

              <article class="sub-panel">
                <h4>Don hang moi nhat</h4>
                <div class="table-shell">
                  <table>
                    <thead>
                      <tr>
                        <th>Ma don</th>
                        <th>Khach</th>
                        <th>Cua hang</th>
                        <th>Tong tien</th>
                        <th>Trang thai</th>
                        <th>Thoi gian</th>
                      </tr>
                    </thead>
                    <tbody id="latest-orders-body"></tbody>
                  </table>
                </div>
              </article>
            </div>
          </section>

          <section class="panel card-surface hidden" data-section="stores">
            <div class="section-head">
              <div>
                <p class="eyebrow">Store Ops</p>
                <h3>Quan ly cua hang</h3>
              </div>
              <button id="refresh-stores" class="btn-secondary" type="button">Lam moi</button>
            </div>

            <form id="create-store-form" class="create-store-form">
              <h4>Tao cua hang va tai khoan quan ly</h4>
              <div class="form-grid">
                <label class="field">
                  <span>Ten cua hang</span>
                  <input name="name" required placeholder="TM Food Thu Duc" />
                </label>
                <label class="field">
                  <span>Dia chi</span>
                  <input name="address" required placeholder="123 Xa Lo Ha Noi, Thu Duc" />
                </label>
                <label class="field">
                  <span>Rating</span>
                  <input name="rating" type="number" min="0" max="5" step="0.1" value="4.5" />
                </label>
                <label class="field">
                  <span>ETA toi thieu (phut)</span>
                  <input name="etaMinutesMin" type="number" min="5" max="120" value="20" required />
                </label>
                <label class="field">
                  <span>ETA toi da (phut)</span>
                  <input name="etaMinutesMax" type="number" min="5" max="180" value="35" required />
                </label>
                <label class="field">
                  <span>Vi do (tu chon)</span>
                  <input name="latitude" type="number" step="any" placeholder="10.854" />
                </label>
                <label class="field">
                  <span>Kinh do (tu chon)</span>
                  <input name="longitude" type="number" step="any" placeholder="106.772" />
                </label>
                <label class="field">
                  <span>Ten quan ly</span>
                  <input name="managerName" required placeholder="Nguyen Van A" />
                </label>
                <label class="field">
                  <span>Email quan ly</span>
                  <input name="managerEmail" type="email" required placeholder="manager@tmfood.local" />
                </label>
                <label class="field">
                  <span>Mat khau quan ly</span>
                  <input name="managerPassword" type="password" minlength="8" required placeholder="it nhat 8 ky tu" />
                </label>
              </div>
              <div class="form-actions">
                <button type="submit">Tao cua hang</button>
              </div>
            </form>

            <div class="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Ma</th>
                    <th>Cua hang</th>
                    <th>Quan ly</th>
                    <th>Rating</th>
                    <th>ETA</th>
                    <th>Dang mo</th>
                  </tr>
                </thead>
                <tbody id="stores-body"></tbody>
              </table>
            </div>
          </section>

          <section class="panel card-surface hidden" data-section="driver-applications">
            <div class="section-head">
              <div>
                <p class="eyebrow">Driver Review</p>
                <h3>Duyet doi tac tai xe</h3>
              </div>
              <div class="head-actions">
                <select id="driver-status-filter">
                  <option value="PENDING">Dang cho duyet</option>
                  <option value="">Tat ca</option>
                  <option value="APPROVED">Da duyet</option>
                  <option value="REJECTED">Tu choi</option>
                </select>
                <button id="refresh-driver-applications" class="btn-secondary" type="button">Lam moi</button>
              </div>
            </div>

            <div class="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Ung vien</th>
                    <th>Thong tin xe</th>
                    <th>Giay to</th>
                    <th>Diem chat luong</th>
                    <th>Trang thai</th>
                  </tr>
                </thead>
                <tbody id="driver-applications-body"></tbody>
              </table>
            </div>
          </section>

          <section class="panel card-surface hidden" data-section="store-applications">
            <div class="section-head">
              <div>
                <p class="eyebrow">Store Review</p>
                <h3>Duyet doi tac cua hang</h3>
              </div>
              <div class="head-actions">
                <select id="store-status-filter">
                  <option value="PENDING">Dang cho duyet</option>
                  <option value="">Tat ca</option>
                  <option value="APPROVED">Da duyet</option>
                  <option value="REJECTED">Tu choi</option>
                </select>
                <button id="refresh-store-applications" class="btn-secondary" type="button">Lam moi</button>
              </div>
            </div>

            <div class="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Thong tin cua hang</th>
                    <th>Nguoi nop ho so</th>
                    <th>Giay to</th>
                    <th>Toa do</th>
                    <th>Trang thai</th>
                  </tr>
                </thead>
                <tbody id="store-applications-body"></tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </section>
  </div>

  <div id="flash" class="flash hidden" role="status" aria-live="polite"></div>
`;

const elements: Elements = {
  loginView: selectElement<HTMLElement>("#login-view"),
  appView: selectElement<HTMLElement>("#app-view"),
  loginForm: selectElement<HTMLFormElement>("#login-form"),
  loginEmail: selectElement<HTMLInputElement>("#login-email"),
  loginPassword: selectElement<HTMLInputElement>("#login-password"),
  loginError: selectElement<HTMLElement>("#login-error"),
  loginButton: selectElement<HTMLButtonElement>("#login-button"),
  currentAdmin: selectElement<HTMLElement>("#current-admin"),
  logoutButton: selectElement<HTMLButtonElement>("#logout-button"),
  metricsGrid: selectElement<HTMLElement>("#metrics-grid"),
  orderDistribution: selectElement<HTMLElement>("#order-distribution"),
  latestOrdersBody: selectElement<HTMLElement>("#latest-orders-body"),
  storesBody: selectElement<HTMLElement>("#stores-body"),
  createStoreForm: selectElement<HTMLFormElement>("#create-store-form"),
  driverStatusFilter: selectElement<HTMLSelectElement>("#driver-status-filter"),
  driverApplicationsBody: selectElement<HTMLElement>("#driver-applications-body"),
  storeStatusFilter: selectElement<HTMLSelectElement>("#store-status-filter"),
  storeApplicationsBody: selectElement<HTMLElement>("#store-applications-body"),
  refreshOverview: selectElement<HTMLButtonElement>("#refresh-overview"),
  refreshStores: selectElement<HTMLButtonElement>("#refresh-stores"),
  refreshDriverApplications: selectElement<HTMLButtonElement>("#refresh-driver-applications"),
  refreshStoreApplications: selectElement<HTMLButtonElement>("#refresh-store-applications"),
  flash: selectElement<HTMLElement>("#flash"),
};

const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".nav-button"));
const tabSections = Array.from(document.querySelectorAll<HTMLElement>("[data-section]"));

function selectElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

function normalizeApiBase(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "/api/v1";
  }
  return value.trim().replace(/\/+$/, "");
}

function saveSession() {
  if (!state.tokens || !state.user) {
    return;
  }

  const payload = JSON.stringify({
    tokens: state.tokens,
    user: state.user,
  });
  localStorage.setItem(SESSION_STORAGE_KEY, payload);
}

function loadSession() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as { tokens: SessionTokens; user: AdminUser };
    state.tokens = parsed.tokens;
    state.user = parsed.user;
  } catch (_error) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

function clearSession() {
  state.tokens = null;
  state.user = null;
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function setActiveTab(tab: TabKey) {
  state.activeTab = tab;
  navButtons.forEach((button) => {
    const isActive = button.dataset.tab === tab;
    button.classList.toggle("active", isActive);
  });
  tabSections.forEach((section) => {
    const isActive = section.dataset.section === tab;
    section.classList.toggle("hidden", !isActive);
  });
}

function showLoginView() {
  elements.loginView.classList.remove("hidden");
  elements.appView.classList.add("hidden");
  elements.loginPassword.value = "";
}

function showAppView() {
  elements.loginView.classList.add("hidden");
  elements.appView.classList.remove("hidden");
  elements.currentAdmin.textContent = state.user?.email ?? "admin";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Co loi xay ra, vui long thu lai";
}

function showFlash(message: string, type: "success" | "error" | "info" = "info") {
  elements.flash.className = `flash ${type}`;
  elements.flash.textContent = message;

  if (flashTimer) {
    window.clearTimeout(flashTimer);
  }

  flashTimer = window.setTimeout(() => {
    elements.flash.className = "flash hidden";
    elements.flash.textContent = "";
  }, 4200);
}

function formatCurrency(value: number | null | undefined): string {
  return `${currencyFormatter.format(value ?? 0)} VND`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return dateTimeFormatter.format(date);
}

function shortId(value: string): string {
  if (!value) {
    return "-";
  }
  return value.slice(0, 8);
}

function statusClass(status: string): string {
  switch (status) {
    case "APPROVED":
    case "DELIVERED":
      return "status-tag success";
    case "REJECTED":
    case "CANCELLED":
      return "status-tag danger";
    case "PENDING":
    case "CONFIRMED":
    case "PREPARING":
    case "PICKED_UP":
      return "status-tag warning";
    default:
      return "status-tag";
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (!state.tokens?.refreshToken) {
    return false;
  }

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
  });

  if (!response.ok) {
    clearSession();
    return false;
  }

  const payload = (await response.json()) as LoginResponse;
  state.tokens = payload.tokens;
  state.user = payload.user;
  saveSession();
  return true;
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  authRequired = true,
  allowRetry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  const body = init.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authRequired && state.tokens?.accessToken) {
    headers.set("Authorization", `Bearer ${state.tokens.accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (response.status === 401 && authRequired && allowRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, init, authRequired, false);
    }
  }

  if (!response.ok) {
    const messageFromPayload =
      typeof payload === "object" && payload !== null
        ? (payload as { message?: string; error?: string }).message ??
        (payload as { message?: string; error?: string }).error
        : undefined;

    if (response.status === 401 && authRequired) {
      clearSession();
      showLoginView();
    }

    throw new Error(messageFromPayload || `Request failed (${response.status})`);
  }

  return payload as T;
}

function renderOverview() {
  const overview = state.overview;
  if (!overview) {
    elements.metricsGrid.innerHTML = `<p class="muted-empty">Chua co du lieu dashboard.</p>`;
    elements.orderDistribution.innerHTML = "";
    elements.latestOrdersBody.innerHTML = "";
    return;
  }

  const openStores = state.stores.filter((store) => store.isOpen).length;

  const metrics = [
    { label: "Tong nguoi dung", value: `${overview.metrics.totalUsers}` },
    { label: "Tong cua hang", value: `${overview.metrics.totalStores}` },
    { label: "Cua hang dang mo", value: `${openStores}` },
    { label: "Tong san pham", value: `${overview.metrics.totalProducts}` },
    { label: "Tong don hang", value: `${overview.metrics.totalOrders}` },
    { label: "Don cho xac nhan", value: `${overview.metrics.pendingOrders}` },
    { label: "Don dang chuan bi", value: `${overview.metrics.preparingOrders}` },
    { label: "Don dang giao", value: `${overview.metrics.deliveringOrders}` },
    { label: "Don da giao hom nay", value: `${overview.metrics.deliveredToday}` },
    { label: "Don huy hom nay", value: `${overview.metrics.cancelledToday}` },
    { label: "Doanh thu hom nay", value: formatCurrency(overview.metrics.revenueToday) },
    {
      label: "Ho so tai xe cho duyet",
      value: `${overview.metrics.pendingDriverApplications}`,
    },
  ];

  elements.metricsGrid.innerHTML = metrics
    .map(
      (entry) => `
        <article class="metric-card">
          <p>${escapeHtml(entry.label)}</p>
          <strong>${escapeHtml(entry.value)}</strong>
        </article>
      `,
    )
    .join("");

  elements.orderDistribution.innerHTML = overview.orderStatusDistribution
    .map(
      (item) => `
        <span class="${statusClass(item.status)}">${escapeHtml(item.status)}: ${item.count}</span>
      `,
    )
    .join("");

  if (overview.latestOrders.length === 0) {
    elements.latestOrdersBody.innerHTML = `<tr><td colspan="6" class="muted-empty">Chua co don hang nao.</td></tr>`;
    return;
  }

  elements.latestOrdersBody.innerHTML = overview.latestOrders
    .map(
      (order) => `
        <tr>
          <td><code>${escapeHtml(shortId(order.id))}</code></td>
          <td>
            ${escapeHtml(order.user.name)}<br />
            <small>${escapeHtml(order.user.email)}</small>
          </td>
          <td>${escapeHtml(order.store.name)}</td>
          <td>${formatCurrency(order.total)}</td>
          <td><span class="${statusClass(order.status)}">${escapeHtml(order.status)}</span></td>
          <td>${formatDateTime(order.createdAt)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderStoresTable() {
  if (state.stores.length === 0) {
    elements.storesBody.innerHTML = `<tr><td colspan="6" class="muted-empty">Chua co cua hang nao.</td></tr>`;
    return;
  }

  elements.storesBody.innerHTML = state.stores
    .map(
      (store) => `
        <tr>
          <td><code>${escapeHtml(shortId(store.id))}</code></td>
          <td>
            ${escapeHtml(store.name)}<br />
            <small>${escapeHtml(store.address)}</small>
          </td>
          <td>
            ${store.manager
          ? `${escapeHtml(store.manager.name)}<br /><small>${escapeHtml(store.manager.email)}</small>`
          : `<small>Chua gan</small>`
        }
          </td>
          <td>${store.rating.toFixed(1)}</td>
          <td>${store.etaMinutesMin}-${store.etaMinutesMax} phut</td>
          <td>
            <label class="switch">
              <input type="checkbox" data-store-toggle="${escapeHtml(store.id)}" ${store.isOpen ? "checked" : ""} />
              <span>${store.isOpen ? "Mo" : "Dong"}</span>
            </label>
          </td>
        </tr>
      `,
    )
    .join("");

  const toggles = Array.from(
    elements.storesBody.querySelectorAll<HTMLInputElement>("input[data-store-toggle]"),
  );



  toggles.forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const storeId = checkbox.dataset.storeToggle;
      if (!storeId) {
        return;
      }

      checkbox.disabled = true;
      const newValue = checkbox.checked;

      try {
        await apiRequest<ApiListResponse<Store>>(`/stores/${storeId}`, {
          method: "PATCH",
          body: JSON.stringify({ isOpen: newValue }),
        });
        const targetStore = state.stores.find((store) => store.id === storeId);
        if (targetStore) {
          targetStore.isOpen = newValue;
        }
        renderOverview();
      } catch (error) {
        checkbox.checked = !newValue;
        showFlash(`Khong cap nhat duoc trang thai cua hang: ${toErrorMessage(error)}`, "error");
      } finally {
        checkbox.disabled = false;
      }
    });
  });
}

function documentPreview(label: string, dataUrl: string | null): string {
  if (!dataUrl) {
    return `
      <div class="doc-preview">
        <span>${escapeHtml(label)}</span>
        <small>Khong co</small>
      </div>
    `;
  }

  return `
    <div class="doc-preview" style="cursor: pointer;" onclick="previewImage(this.querySelector('img').src)">
      <span>${escapeHtml(label)}</span>
      <img src="${dataUrl}" alt="${escapeHtml(label)}" loading="lazy" />
    </div>
  `;
}

function renderDriverApplicationsTable() {
  if (state.driverApplications.length === 0) {
    elements.driverApplicationsBody.innerHTML =
      `<tr><td colspan="5" class="muted-empty">Khong co ho so tai xe nao theo bo loc hien tai.</td></tr>`;
    return;
  }

  elements.driverApplicationsBody.innerHTML = state.driverApplications
    .map(
      (application) => `
        <tr>
          <td>
            <strong>${escapeHtml(application.fullName)}</strong><br />
            <small>${escapeHtml(application.email)}</small><br />
            <small>${escapeHtml(application.phone || "Khong co SDT")}</small><br />
            <small>Sinh ngay: ${formatDateTime(application.dateOfBirth)}</small><br />
            <small>Nop luc: ${formatDateTime(application.createdAt)}</small>
          </td>
          <td>
            <small>Loai xe: ${escapeHtml(application.vehicleType)}</small><br />
            <small>Bien so: <strong>${escapeHtml(application.licensePlate)}</strong></small>
          </td>
          <td>
            <div class="doc-grid">
              ${documentPreview("Chan dung", application.portraitImageData)}
              ${documentPreview("CCCD", application.idCardImageData)}
              ${documentPreview("Bang lai", application.driverLicenseImageData)}
            </div>
          </td>
          <td>
            <small>Chan dung: ${application.portraitQualityScore.toFixed(1)}</small><br />
            <small>CCCD: ${application.idCardQualityScore.toFixed(1)}</small><br />
            <small>Bang lai: ${application.driverLicenseQualityScore.toFixed(1)}</small>
          </td>
          <td>
            <span class="${statusClass(application.status)}">${escapeHtml(application.status)}</span><br />
            <small>${escapeHtml(application.adminNote || "-")}</small>
            ${application.status === "PENDING"
          ? `
                  <div class="action-row">
                    <button type="button" class="btn-small btn-secondary" data-driver-approve="${escapeHtml(application.id)}">Duyet</button>
                    <button type="button" class="btn-small btn-danger" data-driver-reject="${escapeHtml(application.id)}">Tu choi</button>
                  </div>
                `
          : `<small class="review-time">Xu ly: ${formatDateTime(application.reviewedAt)}</small>`
        }
          </td>
        </tr>
      `,
    )
    .join("");

  const approveButtons = Array.from(
    elements.driverApplicationsBody.querySelectorAll<HTMLButtonElement>("button[data-driver-approve]"),
  );
  const rejectButtons = Array.from(
    elements.driverApplicationsBody.querySelectorAll<HTMLButtonElement>("button[data-driver-reject]"),
  );

  approveButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const applicationId = button.dataset.driverApprove;
      if (!applicationId) {
        return;
      }

      const adminNoteRaw = window.prompt(
        "Ghi chu duyet (co the bo trong). Neu de trong he thong se luu null.",
        "",
      );
      if (adminNoteRaw === null) {
        return;
      }
      const adminNote = adminNoteRaw.trim();
      if (adminNote.length > 0 && adminNote.length < 2) {
        showFlash("Ghi chu duyet can tu 2 ky tu tro len", "error");
        return;
      }

      button.disabled = true;
      try {
        await apiRequest(`/admin/driver-applications/${applicationId}/approve`, {
          method: "POST",
          body: JSON.stringify(adminNote ? { adminNote } : {}),
        });
        showFlash("Da duyet ho so tai xe", "success");
        await Promise.all([loadDriverApplications(), loadOverview()]);
      } catch (error) {
        showFlash(`Duyet ho so that bai: ${toErrorMessage(error)}`, "error");
      } finally {
        button.disabled = false;
      }
    });
  });

  rejectButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const applicationId = button.dataset.driverReject;
      if (!applicationId) {
        return;
      }

      const adminNoteRaw = window.prompt("Nhap ly do tu choi ho so tai xe:", "Thong tin ho so chua hop le");
      if (adminNoteRaw === null) {
        return;
      }
      const adminNote = adminNoteRaw.trim();
      if (adminNote.length < 2) {
        showFlash("Ly do tu choi can toi thieu 2 ky tu", "error");
        return;
      }

      button.disabled = true;
      try {
        await apiRequest(`/admin/driver-applications/${applicationId}/reject`, {
          method: "POST",
          body: JSON.stringify({ adminNote }),
        });
        showFlash("Da tu choi ho so tai xe", "success");
        await Promise.all([loadDriverApplications(), loadOverview()]);
      } catch (error) {
        showFlash(`Tu choi ho so that bai: ${toErrorMessage(error)}`, "error");
      } finally {
        button.disabled = false;
      }
    });
  });
}

function renderStoreApplicationsTable() {
  if (state.storeApplications.length === 0) {
    elements.storeApplicationsBody.innerHTML =
      `<tr><td colspan="5" class="muted-empty">Khong co ho so cua hang nao theo bo loc hien tai.</td></tr>`;
    return;
  }

  elements.storeApplicationsBody.innerHTML = state.storeApplications
    .map(
      (application) => `
        <tr>
          <td>
            <strong>${escapeHtml(application.storeName)}</strong><br />
            <small>${escapeHtml(application.storeAddress)}</small><br />
            <small>SDT: ${escapeHtml(application.storePhone)}</small><br />
            <small>Tao luc: ${formatDateTime(application.createdAt)}</small>
          </td>
          <td>
            <strong>${escapeHtml(application.applicant.name)}</strong><br />
            <small>${escapeHtml(application.applicant.email)}</small><br />
            <small>${escapeHtml(application.applicant.phone || "Khong co SDT")}</small>
          </td>
          <td>
            <div class="doc-grid">
              ${documentPreview("Mat tien", application.frontStoreImageData)}
              ${documentPreview("GPKD", application.businessLicenseImageData)}
            </div>
          </td>
          <td>
            ${application.storeLatitude !== null && application.storeLongitude !== null
          ? `<small>${application.storeLatitude.toFixed(6)}, ${application.storeLongitude.toFixed(6)}</small>`
          : `<small>Khong co toa do</small>`
        }
          </td>
          <td>
            <span class="${statusClass(application.status)}">${escapeHtml(application.status)}</span><br />
            <small>${escapeHtml(application.adminNote || "-")}</small>
            ${application.status === "PENDING"
          ? `
                  <div class="action-row">
                    <button type="button" class="btn-small btn-secondary" data-store-app-approve="${escapeHtml(application.id)}">Duyet</button>
                    <button type="button" class="btn-small btn-danger" data-store-app-reject="${escapeHtml(application.id)}">Tu choi</button>
                  </div>
                `
          : `<small class="review-time">Xu ly: ${formatDateTime(application.reviewedAt)}</small>`
        }
          </td>
        </tr>
      `,
    )
    .join("");

  const approveButtons = Array.from(
    elements.storeApplicationsBody.querySelectorAll<HTMLButtonElement>("button[data-store-app-approve]"),
  );
  const rejectButtons = Array.from(
    elements.storeApplicationsBody.querySelectorAll<HTMLButtonElement>("button[data-store-app-reject]"),
  );

  approveButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const applicationId = button.dataset.storeAppApprove;
      if (!applicationId) {
        return;
      }

      const adminNoteRaw = window.prompt(
        "Ghi chu duyet (co the bo trong). Khi duyet, he thong tu tao store va gan vai tro chu quan.",
        "",
      );
      if (adminNoteRaw === null) {
        return;
      }
      const adminNote = adminNoteRaw.trim();
      if (adminNote.length > 0 && adminNote.length < 2) {
        showFlash("Ghi chu duyet can toi thieu 2 ky tu neu co nhap", "error");
        return;
      }

      button.disabled = true;
      try {
        await apiRequest(`/admin/store-applications/${applicationId}/approve`, {
          method: "POST",
          body: JSON.stringify(adminNote ? { adminNote } : {}),
        });
        showFlash("Da duyet ho so cua hang", "success");
        await Promise.all([loadStoreApplications(), loadStores(), loadOverview()]);
      } catch (error) {
        showFlash(`Duyet ho so that bai: ${toErrorMessage(error)}`, "error");
      } finally {
        button.disabled = false;
      }
    });
  });

  rejectButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const applicationId = button.dataset.storeAppReject;
      if (!applicationId) {
        return;
      }

      const adminNoteRaw = window.prompt("Nhap ly do tu choi ho so cua hang:", "Thong tin ho so chua day du");
      if (adminNoteRaw === null) {
        return;
      }
      const adminNote = adminNoteRaw.trim();
      if (adminNote.length < 2) {
        showFlash("Ly do tu choi can toi thieu 2 ky tu", "error");
        return;
      }

      button.disabled = true;
      try {
        await apiRequest(`/admin/store-applications/${applicationId}/reject`, {
          method: "POST",
          body: JSON.stringify({ adminNote }),
        });
        showFlash("Da tu choi ho so cua hang", "success");
        await Promise.all([loadStoreApplications(), loadOverview()]);
      } catch (error) {
        showFlash(`Tu choi ho so that bai: ${toErrorMessage(error)}`, "error");
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function loadOverview() {
  const response = await apiRequest<ApiListResponse<OverviewPayload>>("/admin/overview");
  state.overview = response.data;
  renderOverview();
}

async function loadStores() {
  const response = await apiRequest<ApiListResponse<Store[]>>("/stores?limit=100");
  state.stores = response.data;
  renderStoresTable();
  if (state.overview) {
    renderOverview();
  }
}

async function loadDriverApplications() {
  const selectedStatus = elements.driverStatusFilter.value.trim();
  const query = selectedStatus ? `?status=${encodeURIComponent(selectedStatus)}&limit=100` : "?limit=100";
  const response = await apiRequest<ApiListResponse<DriverApplication[]>>(`/admin/driver-applications${query}`);
  state.driverApplications = response.data;
  renderDriverApplicationsTable();
}

async function loadStoreApplications() {
  const selectedStatus = elements.storeStatusFilter.value.trim();
  const query = selectedStatus ? `?status=${encodeURIComponent(selectedStatus)}&limit=100` : "?limit=100";
  const response = await apiRequest<ApiListResponse<StoreApplication[]>>(`/admin/store-applications${query}`);
  state.storeApplications = response.data;
  renderStoreApplicationsTable();
}

async function loadDashboardData() {
  await Promise.all([loadStores(), loadDriverApplications(), loadStoreApplications(), loadOverview()]);
}

async function handleLogin(event: SubmitEvent) {
  event.preventDefault();
  elements.loginError.textContent = "";
  elements.loginButton.disabled = true;

  const email = elements.loginEmail.value.trim().toLowerCase();
  const password = elements.loginPassword.value;

  try {
    const response = await apiRequest<LoginResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      false,
    );

    if (response.user.role !== "ADMIN") {
      throw new Error("Tai khoan nay khong co quyen admin");
    }

    state.tokens = response.tokens;
    state.user = response.user;
    saveSession();
    showAppView();
    setActiveTab(state.activeTab);
    await loadDashboardData();
    showFlash("Dang nhap thanh cong", "success");
  } catch (error) {
    elements.loginError.textContent = toErrorMessage(error);
  } finally {
    elements.loginButton.disabled = false;
  }
}

async function handleLogout() {
  try {
    if (state.tokens?.refreshToken) {
      await apiRequest(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
        },
        false,
      );
    }
  } catch (_error) {
    // ignore network/logout errors, local session still gets cleared.
  } finally {
    clearSession();
    showLoginView();
    showFlash("Da dang xuat khoi he thong", "info");
  }
}

async function handleCreateStore(event: SubmitEvent) {
  event.preventDefault();
  const formData = new FormData(elements.createStoreForm);

  const etaMinutesMin = Number(formData.get("etaMinutesMin"));
  const etaMinutesMax = Number(formData.get("etaMinutesMax"));
  if (etaMinutesMin > etaMinutesMax) {
    showFlash("ETA toi thieu khong duoc lon hon ETA toi da", "error");
    return;
  }

  const payload: Record<string, unknown> = {
    name: String(formData.get("name") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    rating: Number(formData.get("rating") ?? 4.5),
    etaMinutesMin,
    etaMinutesMax,
    managerName: String(formData.get("managerName") ?? "").trim(),
    managerEmail: String(formData.get("managerEmail") ?? "").trim().toLowerCase(),
    managerPassword: String(formData.get("managerPassword") ?? ""),
    isOpen: true,
  };

  const latitudeRaw = String(formData.get("latitude") ?? "").trim();
  const longitudeRaw = String(formData.get("longitude") ?? "").trim();
  if (latitudeRaw) {
    payload.latitude = Number(latitudeRaw);
  }
  if (longitudeRaw) {
    payload.longitude = Number(longitudeRaw);
  }

  try {
    await apiRequest("/stores", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    elements.createStoreForm.reset();
    showFlash("Da tao cua hang va tai khoan quan ly", "success");
    await Promise.all([loadStores(), loadOverview()]);
  } catch (error) {
    showFlash(`Tao cua hang that bai: ${toErrorMessage(error)}`, "error");
  }
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", (event) => {
    void handleLogin(event);
  });
  elements.logoutButton.addEventListener("click", () => {
    void handleLogout();
  });
  elements.createStoreForm.addEventListener("submit", (event) => {
    void handleCreateStore(event);
  });

  elements.refreshOverview.addEventListener("click", () => {
    void loadOverview().catch((error) => showFlash(toErrorMessage(error), "error"));
  });
  elements.refreshStores.addEventListener("click", () => {
    void Promise.all([loadStores(), loadOverview()]).catch((error) => showFlash(toErrorMessage(error), "error"));
  });
  elements.refreshDriverApplications.addEventListener("click", () => {
    void Promise.all([loadDriverApplications(), loadOverview()]).catch((error) =>
      showFlash(toErrorMessage(error), "error"),
    );
  });
  elements.refreshStoreApplications.addEventListener("click", () => {
    void Promise.all([loadStoreApplications(), loadOverview()]).catch((error) =>
      showFlash(toErrorMessage(error), "error"),
    );
  });

  elements.driverStatusFilter.addEventListener("change", () => {
    void loadDriverApplications().catch((error) => showFlash(toErrorMessage(error), "error"));
  });
  elements.storeStatusFilter.addEventListener("change", () => {
    void loadStoreApplications().catch((error) => showFlash(toErrorMessage(error), "error"));
  });

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab as TabKey | undefined;
      if (!tab) {
        return;
      }
      setActiveTab(tab);
    });
  });
}

async function bootstrap() {
  bindEvents();
  setActiveTab(state.activeTab);
  loadSession();

  if (state.tokens?.accessToken && state.user?.role === "ADMIN") {
    showAppView();
    try {
      await loadDashboardData();
      showFlash("Da khoi phuc phien lam viec admin", "info");
      return;
    } catch (error) {
      clearSession();
      showLoginView();
      showFlash(`Phien dang nhap het han: ${toErrorMessage(error)}`, "error");
      return;
    }
  }

  showLoginView();
}

void bootstrap();

// Global function for image preview to safely open large data URIs
(window as any).previewImage = function(src: string) {
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Xem chi tiet hinh anh</title></head>
      <body style="margin:0; background:#111; display:flex; justify-content:center; align-items:center; min-height:100vh;">
        <img src="${src}" style="max-width:100%; max-height:100vh; object-fit:contain;" />
      </body>
      </html>
    `);
    win.document.close();
  }
};

