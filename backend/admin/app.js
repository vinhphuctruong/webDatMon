const API_BASE = "/api/v1";
const ADMIN_SESSION_KEY = "zaui_food_admin_session";

const state = {
  tokens: null,
  user: null,
  stores: [],
};

const els = {
  loginScreen: document.getElementById("login-screen"),
  appScreen: document.getElementById("app-screen"),
  loginForm: document.getElementById("login-form"),
  loginError: document.getElementById("login-error"),
  loginBtn: document.getElementById("login-btn"),
  currentAdmin: document.getElementById("current-admin"),
  logoutBtn: document.getElementById("logout-btn"),
  navButtons: Array.from(document.querySelectorAll("[data-tab]")),
  sections: Array.from(document.querySelectorAll("[data-section]")),
  refreshOverview: document.getElementById("refresh-overview"),
  refreshStores: document.getElementById("refresh-stores"),
  dashboardMetrics: document.getElementById("dashboard-metrics"),
  storesBody: document.getElementById("stores-body"),
  createStoreForm: document.getElementById("create-store-form"),
};

function saveSession() {
  localStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({ tokens: state.tokens, user: state.user }),
  );
}

function loadSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.tokens = parsed.tokens;
    state.user = parsed.user;
  } catch (_error) {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

function clearSession() {
  state.tokens = null;
  state.user = null;
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

async function api(path, options = {}, auth = true) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth && state.tokens?.accessToken) {
    headers.set("Authorization", `Bearer ${state.tokens.accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (response.status === 401 && auth && state.tokens?.refreshToken) {
    const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
    });

    if (refreshed.ok) {
      const refreshPayload = await refreshed.json();
      state.tokens = refreshPayload.tokens;
      state.user = refreshPayload.user;
      saveSession();
      return api(path, options, auth);
    }
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed (${response.status})`);
  }

  return payload;
}

function setActiveTab(tab) {
  els.navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  els.sections.forEach((section) => {
    section.classList.toggle("hidden", section.dataset.section !== tab);
  });
}

function renderMetrics(metrics, stores) {
  const openStores = stores.filter((store) => store.isOpen).length;
  const assignedManagers = stores.filter((store) => store.manager).length;

  const entries = [
    ["Tổng cửa hàng", metrics.totalStores],
    ["Đang mở cửa", openStores],
    ["Đã gán quản lý", assignedManagers],
    ["Đơn chờ xác nhận", metrics.pendingOrders],
    ["Doanh thu hôm nay", new Intl.NumberFormat("vi-VN").format(metrics.revenueToday || 0) + "đ"],
  ];

  els.dashboardMetrics.innerHTML = entries
    .map(
      ([label, value]) => `
      <div class="metric">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
      </div>
    `,
    )
    .join("");
}

function renderStoresTable(rows) {
  els.storesBody.innerHTML = rows
    .map(
      (store) => `
      <tr>
        <td><code>${store.id.slice(0, 8)}</code></td>
        <td>${store.name}<br><small>${store.address}</small></td>
        <td>${store.manager ? `${store.manager.name}<br><small>${store.manager.email}</small>` : "<small>Chưa gán</small>"}</td>
        <td>${store.rating.toFixed(1)}</td>
        <td>${store.etaMinutesMin}-${store.etaMinutesMax} phút</td>
        <td><input type="checkbox" data-store-open="${store.id}" ${store.isOpen ? "checked" : ""} /></td>
      </tr>
    `,
    )
    .join("");

  els.storesBody.querySelectorAll("input[data-store-open]").forEach((checkbox) => {
    checkbox.addEventListener("change", async (event) => {
      const target = event.currentTarget;
      const storeId = target.dataset.storeOpen;
      try {
        await api(`/stores/${storeId}`, {
          method: "PATCH",
          body: JSON.stringify({ isOpen: target.checked }),
        });
      } catch (error) {
        target.checked = !target.checked;
        alert(`Không thể cập nhật quán: ${error.message}`);
      }
    });
  });
}

async function loadStores() {
  const response = await api("/stores?limit=100");
  state.stores = response.data;
  renderStoresTable(state.stores);
}

async function loadOverview() {
  const response = await api("/admin/overview");
  renderMetrics(response.data.metrics, state.stores);
}

async function bootApp() {
  els.currentAdmin.textContent = state.user?.email || "admin";
  els.loginScreen.classList.add("hidden");
  els.appScreen.classList.remove("hidden");

  await loadStores();
  await loadOverview();
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.loginError.textContent = "";
  els.loginBtn.disabled = true;

  const formData = new FormData(els.loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    const response = await api(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      false,
    );

    if (response.user.role !== "ADMIN") {
      throw new Error("Tài khoản không có quyền admin");
    }

    state.tokens = response.tokens;
    state.user = response.user;
    saveSession();
    await bootApp();
  } catch (error) {
    els.loginError.textContent = error.message;
  } finally {
    els.loginBtn.disabled = false;
  }
});

els.logoutBtn.addEventListener("click", async () => {
  try {
    if (state.tokens?.refreshToken) {
      await api(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
        },
        false,
      );
    }
  } catch (_error) {
    // ignore
  }

  clearSession();
  window.location.reload();
});

els.navButtons.forEach((btn) => {
  btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
});

els.refreshOverview.addEventListener("click", () => loadOverview().catch((err) => alert(err.message)));
els.refreshStores.addEventListener("click", () => loadStores().then(loadOverview).catch((err) => alert(err.message)));

els.createStoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(els.createStoreForm);

  const body = {
    name: String(formData.get("name") || ""),
    address: String(formData.get("address") || ""),
    rating: Number(formData.get("rating") || 4.5),
    etaMinutesMin: Number(formData.get("etaMin") || 20),
    etaMinutesMax: Number(formData.get("etaMax") || 35),
    managerName: String(formData.get("managerName") || ""),
    managerEmail: String(formData.get("managerEmail") || ""),
    managerPassword: String(formData.get("managerPassword") || ""),
    isOpen: true,
  };

  try {
    await api("/stores", {
      method: "POST",
      body: JSON.stringify(body),
    });
    els.createStoreForm.reset();
    await loadStores();
    await loadOverview();
    alert("Đã tạo cửa hàng + tài khoản quản lý");
  } catch (error) {
    alert(`Tạo cửa hàng thất bại: ${error.message}`);
  }
});

loadSession();

if (state.tokens?.accessToken && state.user?.role === "ADMIN") {
  bootApp().catch((error) => {
    console.error(error);
    clearSession();
    window.location.reload();
  });
}
