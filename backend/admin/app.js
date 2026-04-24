const API_BASE = "/api/v1";
const ADMIN_SESSION_KEY = "zaui_food_admin_session";

const state = {
  tokens: null,
  user: null,
  stores: [],
  driverApplications: [],
  storeApplications: [],
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
  refreshDriverApplications: document.getElementById("refresh-driver-applications"),
  refreshStoreApplications: document.getElementById("refresh-store-applications"),
  dashboardMetrics: document.getElementById("dashboard-metrics"),
  storesBody: document.getElementById("stores-body"),
  driverApplicationsBody: document.getElementById("driver-applications-body"),
  storeApplicationsBody: document.getElementById("store-applications-body"),
  driverApplicationStatusFilter: document.getElementById("driver-application-status-filter"),
  storeApplicationStatusFilter: document.getElementById("store-application-status-filter"),
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
    ["Hồ sơ tài xế chờ duyệt", metrics.pendingDriverApplications || 0],
    ["Ho so cua hang cho duyet", metrics.pendingStoreApplications || 0],
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
  const response = await api("/stores?limit=50");
  state.stores = response.data;
  renderStoresTable(state.stores);
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_error) {
    return iso || "-";
  }
}

function docPreviewHtml(label, dataUrl) {
  if (!dataUrl) {
    return `<div class="doc-preview"><span>${label}</span><small>Khong co</small></div>`;
  }
  return `
    <div class="doc-preview">
      <span>${label}</span>
      <a href="${dataUrl}" target="_blank" rel="noreferrer">
        <img src="${dataUrl}" alt="${label}" />
      </a>
    </div>
  `;
}

function renderDriverApplicationsTable(rows) {
  els.driverApplicationsBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>
          <strong>${formatDateTime(row.createdAt)}</strong><br>
          <small>Sinh: ${formatDateTime(row.dateOfBirth)}</small>
        </td>
        <td>
          <strong>${row.fullName}</strong><br>
          <small>${row.email}</small><br>
          <small>${row.phone || "Khong co SDT"}</small>
        </td>
        <td>
          <small>Loai xe: ${row.vehicleType}</small><br>
          <small>Bien so: <strong>${row.licensePlate}</strong></small>
        </td>
        <td>
          <div class="doc-grid">
            ${docPreviewHtml("Chan dung", row.portraitImageData)}
            ${docPreviewHtml("CCCD", row.idCardImageData)}
            ${docPreviewHtml("Bang lai", row.driverLicenseImageData)}
          </div>
        </td>
        <td>
          <small>Chan dung: ${row.portraitQualityScore.toFixed(1)}</small><br>
          <small>CCCD: ${row.idCardQualityScore.toFixed(1)}</small><br>
          <small>Bang lai: ${row.driverLicenseQualityScore.toFixed(1)}</small>
        </td>
        <td>
          <strong>${row.status}</strong><br>
          <small>${row.adminNote || "-"}</small><br>
          ${
            row.status === "PENDING"
              ? `
                <div class="action-row">
                  <button class="secondary btn-sm" data-approve-driver-app="${row.id}">Duyet</button>
                  <button class="danger btn-sm" data-reject-driver-app="${row.id}">Tu choi</button>
                </div>
              `
              : `<small>${row.reviewedAt ? `Xu ly: ${formatDateTime(row.reviewedAt)}` : ""}</small>`
          }
        </td>
      </tr>
    `,
    )
    .join("");

  els.driverApplicationsBody
    .querySelectorAll("button[data-approve-driver-app]")
    .forEach((button) => {
      button.addEventListener("click", async (event) => {
        const applicationId = event.currentTarget.dataset.approveDriverApp;
        try {
          await api(`/admin/driver-applications/${applicationId}/approve`, {
            method: "POST",
            body: JSON.stringify({}),
          });
          await loadDriverApplications();
          await loadOverview();
          alert("Duyet ho so tai xe thanh cong");
        } catch (error) {
          alert(`Khong the duyet ho so: ${error.message}`);
        }
      });
    });

  els.driverApplicationsBody
    .querySelectorAll("button[data-reject-driver-app]")
    .forEach((button) => {
      button.addEventListener("click", async (event) => {
        const applicationId = event.currentTarget.dataset.rejectDriverApp;
        const adminNote = prompt("Nhap ly do tu choi ho so:", "Thong tin ho so chua hop le");
        if (!adminNote) return;
        try {
          await api(`/admin/driver-applications/${applicationId}/reject`, {
            method: "POST",
            body: JSON.stringify({ adminNote }),
          });
          await loadDriverApplications();
          await loadOverview();
          alert("Da tu choi ho so tai xe");
        } catch (error) {
          alert(`Khong the tu choi ho so: ${error.message}`);
        }
      });
    });
}

async function loadDriverApplications() {
  const status = (els.driverApplicationStatusFilter?.value || "").trim();
  const qs = status ? `?status=${encodeURIComponent(status)}&limit=100` : "?limit=100";
  const response = await api(`/admin/driver-applications${qs}`);
  state.driverApplications = response.data;
  renderDriverApplicationsTable(state.driverApplications);
}

function renderStoreApplicationsTable(rows) {
  els.storeApplicationsBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>
          <strong>${formatDateTime(row.createdAt)}</strong><br>
          <small>${row.reviewedAt ? `Xu ly: ${formatDateTime(row.reviewedAt)}` : "Chua xu ly"}</small>
        </td>
        <td>
          <strong>${row.applicant?.name || "Khong ro"}</strong><br>
          <small>${row.applicant?.email || "-"}</small><br>
          <small>${row.applicant?.phone || "Khong co SDT"}</small>
        </td>
        <td>
          <strong>${row.storeName}</strong><br>
          <small>${row.storeAddress}</small><br>
          <small>SDT: ${row.storePhone || "-"}</small><br>
          <small>Toa do: ${row.storeLatitude ?? "-"}, ${row.storeLongitude ?? "-"}</small>
        </td>
        <td>
          <div class="doc-grid doc-grid-two">
            ${docPreviewHtml("Anh mat tien", row.frontStoreImageData)}
            ${docPreviewHtml("GPKD", row.businessLicenseImageData)}
          </div>
        </td>
        <td>
          <strong>${row.status}</strong><br>
          <small>${row.adminNote || "-"}</small><br>
          ${
            row.status === "PENDING"
              ? `
                <div class="action-row">
                  <button class="secondary btn-sm" data-approve-store-app="${row.id}">Duyet</button>
                  <button class="danger btn-sm" data-reject-store-app="${row.id}">Tu choi</button>
                </div>
              `
              : `<small>${row.reviewedBy ? `Admin: ${row.reviewedBy.email}` : ""}</small>`
          }
        </td>
      </tr>
    `,
    )
    .join("");

  els.storeApplicationsBody
    .querySelectorAll("button[data-approve-store-app]")
    .forEach((button) => {
      button.addEventListener("click", async (event) => {
        const applicationId = event.currentTarget.dataset.approveStoreApp;
        try {
          await api(`/admin/store-applications/${applicationId}/approve`, {
            method: "POST",
            body: JSON.stringify({}),
          });
          await loadStoreApplications();
          await loadStores();
          await loadOverview();
          alert("Duyet ho so cua hang thanh cong");
        } catch (error) {
          alert(`Khong the duyet ho so cua hang: ${error.message}`);
        }
      });
    });

  els.storeApplicationsBody
    .querySelectorAll("button[data-reject-store-app]")
    .forEach((button) => {
      button.addEventListener("click", async (event) => {
        const applicationId = event.currentTarget.dataset.rejectStoreApp;
        const adminNote = prompt("Nhap ly do tu choi ho so cua hang:", "Thong tin chua hop le");
        if (!adminNote) return;
        try {
          await api(`/admin/store-applications/${applicationId}/reject`, {
            method: "POST",
            body: JSON.stringify({ adminNote }),
          });
          await loadStoreApplications();
          await loadOverview();
          alert("Da tu choi ho so cua hang");
        } catch (error) {
          alert(`Khong the tu choi ho so cua hang: ${error.message}`);
        }
      });
    });
}

async function loadStoreApplications() {
  const status = (els.storeApplicationStatusFilter?.value || "").trim();
  const qs = status ? `?status=${encodeURIComponent(status)}&limit=100` : "?limit=100";
  const response = await api(`/admin/store-applications${qs}`);
  state.storeApplications = response.data;
  renderStoreApplicationsTable(state.storeApplications);
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
  await loadDriverApplications();
  await loadStoreApplications();
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
els.refreshDriverApplications.addEventListener("click", () =>
  loadDriverApplications().then(loadOverview).catch((err) => alert(err.message)),
);
els.refreshStoreApplications.addEventListener("click", () =>
  loadStoreApplications().then(loadOverview).catch((err) => alert(err.message)),
);
els.driverApplicationStatusFilter.addEventListener("change", () =>
  loadDriverApplications().catch((err) => alert(err.message)),
);
els.storeApplicationStatusFilter.addEventListener("change", () =>
  loadStoreApplications().catch((err) => alert(err.message)),
);

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
