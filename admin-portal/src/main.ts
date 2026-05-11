import "./style.css";
import { LOGIN_HTML, APP_HTML } from "./template";
import { api, state, saveSession, loadSession, clearSession, setOnUnauthorized } from "./api";
import { esc, currency, fmtDate, shortId, statusTag, docPreview, flash, setFlashEl, errMsg } from "./helpers";
import type { TabKey, LoginResponse, ApiListResponse, Store, DriverApplication, StoreApplication, OverviewPayload, Voucher, Category, HeroBanner, AdminUserItem } from "./types";

/* ── State ─────────────────────────────────────── */
const appState: {
  activeTab: TabKey; overview: OverviewPayload | null;
  stores: Store[]; driverApps: DriverApplication[];
  storeApps: StoreApplication[]; vouchers: Voucher[];
  categories: Category[]; banners: HeroBanner[];
  users: AdminUserItem[]; userPage: number; userTotalPages: number;
} = { activeTab: "overview", overview: null, stores: [], driverApps: [], storeApps: [], vouchers: [], categories: [], banners: [], users: [], userPage: 1, userTotalPages: 1 };

/* ── Mount ─────────────────────────────────────── */
const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = LOGIN_HTML + APP_HTML;

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const loginView = $("#login-view");
const appView = $("#app-view");
const loginForm = $<HTMLFormElement>("#login-form");
const loginEmail = $<HTMLInputElement>("#login-email");
const loginPassword = $<HTMLInputElement>("#login-password");
const loginError = $("#login-error");
const loginButton = $<HTMLButtonElement>("#login-button");
const currentAdmin = $("#current-admin");
const userAvatar = $("#user-avatar");

setFlashEl($("#flash"));
setOnUnauthorized(() => showLogin());

const navBtns = Array.from(document.querySelectorAll<HTMLButtonElement>(".nav-btn"));
const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-section]"));

/* ── Navigation ────────────────────────────────── */
function setTab(tab: TabKey) {
  appState.activeTab = tab;
  navBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  sections.forEach(s => s.classList.toggle("hidden", s.dataset.section !== tab));
}

function showLogin() { loginView.classList.remove("hidden"); appView.classList.add("hidden"); loginPassword.value = ""; }
function showApp() {
  loginView.classList.add("hidden"); appView.classList.remove("hidden");
  currentAdmin.textContent = state.user?.name || state.user?.email || "Admin";
  userAvatar.textContent = (state.user?.name || "A").charAt(0).toUpperCase();
}

/* ── Render: Overview ──────────────────────────── */
function renderOverview() {
  const o = appState.overview;
  const mg = $("#metrics-grid");
  const od = $("#order-distribution");
  const lo = $("#latest-orders-body");
  if (!o) { mg.innerHTML = `<p class="muted-empty">Chưa có dữ liệu.</p>`; od.innerHTML = ""; lo.innerHTML = ""; return; }

  const openStores = appState.stores.filter(s => s.isOpen).length;
  const colors = ["","green","cyan","purple","","orange","purple","cyan","green","red","","orange"];
  const metrics = [
    "Tổng người dùng", "Tổng cửa hàng", "Đang mở cửa", "Tổng sản phẩm",
    "Tổng đơn hàng", "Chờ xác nhận", "Đang chuẩn bị", "Đang giao",
    "Giao hôm nay", "Huỷ hôm nay", "Doanh thu hôm nay", "Tài xế chờ duyệt"
  ];
  const values = [
    o.metrics.totalUsers, o.metrics.totalStores, openStores, o.metrics.totalProducts,
    o.metrics.totalOrders, o.metrics.pendingOrders, o.metrics.preparingOrders, o.metrics.deliveringOrders,
    o.metrics.deliveredToday, o.metrics.cancelledToday, -1, o.metrics.pendingDriverApplications
  ];

  mg.innerHTML = metrics.map((label, i) => {
    const val = values[i] === -1 ? currency(o.metrics.revenueToday) : String(values[i]);
    return `<article class="metric-card ${colors[i]}"><span class="mc-label">${label}</span><span class="mc-value">${val}</span></article>`;
  }).join("");

  od.innerHTML = o.orderStatusDistribution.map(s => `<span class="${statusTag(s.status)}">${esc(s.status)}: ${s.count}</span>`).join("");

  if (!o.latestOrders.length) { lo.innerHTML = `<tr><td colspan="6" class="muted-empty">Chưa có đơn.</td></tr>`; return; }
  lo.innerHTML = o.latestOrders.map(order => `<tr>
    <td><code>${esc(shortId(order.id))}</code></td>
    <td>${esc(order.user.name)}<br><small>${esc(order.user.email)}</small></td>
    <td>${esc(order.store.name)}</td><td>${currency(order.total)}</td>
    <td><span class="${statusTag(order.status)}">${esc(order.status)}</span></td>
    <td>${fmtDate(order.createdAt)}</td></tr>`).join("");
}

/* ── Render: Stores ────────────────────────────── */
function renderStores() {
  const tb = $("#stores-body");
  if (!appState.stores.length) { tb.innerHTML = `<tr><td colspan="6" class="muted-empty">Chưa có cửa hàng.</td></tr>`; return; }
  tb.innerHTML = appState.stores.map(s => `<tr>
    <td><code>${esc(shortId(s.id))}</code></td>
    <td>${esc(s.name)}<br><small>${esc(s.address)}</small></td>
    <td>${s.manager ? `${esc(s.manager.name)}<br><small>${esc(s.manager.email)}</small>` : "<small>Chưa gán</small>"}</td>
    <td>${s.rating.toFixed(1)}</td><td>${s.etaMinutesMin}-${s.etaMinutesMax} phút</td>
    <td><label class="switch"><input type="checkbox" data-store-toggle="${esc(s.id)}" ${s.isOpen?"checked":""}><span>${s.isOpen?"Mở":"Đóng"}</span></label></td></tr>`).join("");

  tb.querySelectorAll<HTMLInputElement>("input[data-store-toggle]").forEach(cb => {
    cb.addEventListener("change", async () => {
      const id = cb.dataset.storeToggle!; cb.disabled = true;
      try {
        await api(`/stores/${id}`, { method: "PATCH", body: JSON.stringify({ isOpen: cb.checked }) });
        const st = appState.stores.find(x => x.id === id); if (st) st.isOpen = cb.checked;
        renderOverview();
      } catch (e) { cb.checked = !cb.checked; flash(errMsg(e), "error"); }
      finally { cb.disabled = false; }
    });
  });
}

/* ── Render: Driver Apps ───────────────────────── */
function renderDriverApps() {
  const tb = $("#driver-applications-body");
  if (!appState.driverApps.length) { tb.innerHTML = `<tr><td colspan="5" class="muted-empty">Không có hồ sơ.</td></tr>`; return; }
  tb.innerHTML = appState.driverApps.map(a => `<tr>
    <td><strong>${esc(a.fullName)}</strong><br><small>${esc(a.email)}</small><br><small>${esc(a.phone||"Không SĐT")}</small><br><small>Nộp: ${fmtDate(a.createdAt)}</small></td>
    <td><small>${esc(a.vehicleType)}</small><br><small>BS: <strong>${esc(a.licensePlate)}</strong></small></td>
    <td><div class="doc-grid">${docPreview("Chân dung",a.portraitImageData)}${docPreview("CCCD",a.idCardImageData)}${docPreview("Bằng lái",a.driverLicenseImageData)}</div></td>
    <td><small>Chân dung: ${a.portraitQualityScore.toFixed(1)}</small><br><small>CCCD: ${a.idCardQualityScore.toFixed(1)}</small><br><small>Bằng lái: ${a.driverLicenseQualityScore.toFixed(1)}</small></td>
    <td><span class="${statusTag(a.status)}">${esc(a.status)}</span><br><small>${esc(a.adminNote||"-")}</small>
    ${a.status==="PENDING"?`<div class="action-row"><button class="btn btn-sm btn-success" data-da="${esc(a.id)}">Duyệt</button><button class="btn btn-sm btn-danger-solid" data-dr="${esc(a.id)}">Từ chối</button></div>`:`<span class="review-time">Xử lý: ${fmtDate(a.reviewedAt)}</span>`}</td></tr>`).join("");

  bindApproveReject(tb, "da", "dr", "/admin/driver-applications", loadDriverApps);
}

/* ── Render: Store Apps ────────────────────────── */
function renderStoreApps() {
  const tb = $("#store-applications-body");
  if (!appState.storeApps.length) { tb.innerHTML = `<tr><td colspan="5" class="muted-empty">Không có hồ sơ.</td></tr>`; return; }
  tb.innerHTML = appState.storeApps.map(a => `<tr>
    <td><strong>${esc(a.storeName)}</strong><br><small>${esc(a.storeAddress)}</small><br><small>SĐT: ${esc(a.storePhone)}</small></td>
    <td><strong>${esc(a.applicant.name)}</strong><br><small>${esc(a.applicant.email)}</small><br><small>${esc(a.applicant.phone||"Không SĐT")}</small></td>
    <td><div class="doc-grid">${docPreview("Mặt tiền",a.frontStoreImageData)}${docPreview("GPKD",a.businessLicenseImageData)}</div></td>
    <td>${a.storeLatitude!=null&&a.storeLongitude!=null?`<small>${a.storeLatitude.toFixed(6)}, ${a.storeLongitude.toFixed(6)}</small>`:"<small>Không có</small>"}</td>
    <td><span class="${statusTag(a.status)}">${esc(a.status)}</span><br><small>${esc(a.adminNote||"-")}</small>
    ${a.status==="PENDING"?`<div class="action-row"><button class="btn btn-sm btn-success" data-sa="${esc(a.id)}">Duyệt</button><button class="btn btn-sm btn-danger-solid" data-sr="${esc(a.id)}">Từ chối</button></div>`:`<span class="review-time">Xử lý: ${fmtDate(a.reviewedAt)}</span>`}</td></tr>`).join("");

  bindApproveReject(tb, "sa", "sr", "/admin/store-applications", async () => { await Promise.all([loadStoreApps(), loadStores()]); });
}

function bindApproveReject(tb: HTMLElement, approveAttr: string, rejectAttr: string, basePath: string, reload: () => Promise<void>) {
  tb.querySelectorAll<HTMLButtonElement>(`button[data-${approveAttr}]`).forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset[approveAttr]; if (!id) return;
      const note = prompt("Ghi chú duyệt (bỏ trống được):", ""); if (note === null) return;
      btn.disabled = true;
      try { await api(`${basePath}/${id}/approve`, { method: "POST", body: JSON.stringify(note.trim() ? { adminNote: note.trim() } : {}) }); flash("Đã duyệt", "success"); await Promise.all([reload(), loadOverview()]); }
      catch (e) { flash(errMsg(e), "error"); } finally { btn.disabled = false; }
    });
  });
  tb.querySelectorAll<HTMLButtonElement>(`button[data-${rejectAttr}]`).forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset[rejectAttr]; if (!id) return;
      const note = prompt("Lý do từ chối:", "Thông tin chưa hợp lệ"); if (note === null || note.trim().length < 2) { flash("Lý do cần tối thiểu 2 ký tự", "error"); return; }
      btn.disabled = true;
      try { await api(`${basePath}/${id}/reject`, { method: "POST", body: JSON.stringify({ adminNote: note.trim() }) }); flash("Đã từ chối", "success"); await Promise.all([reload(), loadOverview()]); }
      catch (e) { flash(errMsg(e), "error"); } finally { btn.disabled = false; }
    });
  });
}

/* ── Render: Vouchers ──────────────────────────── */
function renderVouchers() {
  const tb = $("#vouchers-body");
  if (!appState.vouchers.length) { tb.innerHTML = `<tr><td colspan="8" class="muted-empty">Chưa có voucher.</td></tr>`; return; }
  tb.innerHTML = appState.vouchers.map(v => {
    const discountText = v.discountType === "FIXED" ? currency(v.discountValue) : `${v.discountValue}%` + (v.maxDiscount ? ` (max ${currency(v.maxDiscount)})` : "");
    const usageText = v.maxUsageTotal ? `${v.usedCount}/${v.maxUsageTotal}` : `${v.usedCount}/∞`;
    const isExpired = new Date(v.expiresAt) < new Date();
    const activeTag = !v.isActive ? '<span class="tag tag-danger">Tắt</span>' : isExpired ? '<span class="tag tag-warning">Hết hạn</span>' : '<span class="tag tag-success">Hoạt động</span>';
    return `<tr>
      <td><code>${esc(v.code)}</code></td><td>${esc(v.description)}</td>
      <td>${discountText}</td><td>${currency(v.minOrderValue)}</td>
      <td>${usageText}</td><td>${fmtDate(v.expiresAt)}</td><td>${activeTag}</td>
      <td><div class="action-row">
        <button class="btn btn-sm ${v.isActive?'btn-secondary':'btn-success'}" data-vtoggle="${v.id}">${v.isActive?"Tắt":"Bật"}</button>
        <button class="btn btn-sm btn-danger-solid" data-vdelete="${v.id}">Xóa</button>
      </div></td></tr>`;
  }).join("");

  tb.querySelectorAll<HTMLButtonElement>("button[data-vtoggle]").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try { await api(`/vouchers/${btn.dataset.vtoggle}/toggle`, { method: "PATCH" }); await loadVouchers(); flash("Đã cập nhật", "success"); }
      catch (e) { flash(errMsg(e), "error"); } finally { btn.disabled = false; }
    });
  });
  tb.querySelectorAll<HTMLButtonElement>("button[data-vdelete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Xóa voucher này?")) return;
      btn.disabled = true;
      try { await api(`/vouchers/${btn.dataset.vdelete}`, { method: "DELETE" }); await loadVouchers(); flash("Đã xóa", "success"); }
      catch (e) { flash(errMsg(e), "error"); } finally { btn.disabled = false; }
    });
  });
}

/* ── Data Loading ──────────────────────────────── */
async function loadOverview() { const r = await api<ApiListResponse<OverviewPayload>>("/admin/overview"); appState.overview = r.data; renderOverview(); }
async function loadStores() { const r = await api<ApiListResponse<Store[]>>("/stores?limit=100"); appState.stores = r.data; renderStores(); if (appState.overview) renderOverview(); }
async function loadDriverApps() {
  const s = $<HTMLSelectElement>("#driver-status-filter").value.trim();
  const q = s ? `?status=${encodeURIComponent(s)}&limit=100` : "?limit=100";
  const r = await api<ApiListResponse<DriverApplication[]>>(`/admin/driver-applications${q}`);
  appState.driverApps = r.data; renderDriverApps();
}
async function loadStoreApps() {
  const s = $<HTMLSelectElement>("#store-status-filter").value.trim();
  const q = s ? `?status=${encodeURIComponent(s)}&limit=100` : "?limit=100";
  const r = await api<ApiListResponse<StoreApplication[]>>(`/admin/store-applications${q}`);
  appState.storeApps = r.data; renderStoreApps();
}
async function loadVouchers() { const r = await api<ApiListResponse<Voucher[]>>("/vouchers/admin"); appState.vouchers = r.data; renderVouchers(); }
async function loadCategories() { const r = await api<ApiListResponse<Category[]>>("/categories"); appState.categories = r.data; renderCategories(); }
async function loadBanners() { const r = await api<ApiListResponse<HeroBanner[]>>("/banners?all=true"); appState.banners = r.data; renderBanners(); }
async function loadUsers(page = 1) {
  const role = $<HTMLSelectElement>("#user-role-filter").value.trim();
  const q = $<HTMLInputElement>("#user-search").value.trim();
  let url = `/admin/users?limit=20&page=${page}`;
  if (role) url += `&role=${encodeURIComponent(role)}`;
  if (q) url += `&q=${encodeURIComponent(q)}`;
  const r = await api<{ data: AdminUserItem[]; pagination: { page: number; totalPages: number } }>(url);
  appState.users = r.data; appState.userPage = r.pagination.page; appState.userTotalPages = r.pagination.totalPages;
  renderUsers();
}
async function loadAll() { await Promise.all([loadStores(), loadDriverApps(), loadStoreApps(), loadOverview(), loadVouchers(), loadCategories(), loadBanners(), loadUsers()]); }

/* ── Render: Categories ───────────────────────── */
function renderCategories() {
  const tb = $("#categories-body");
  if (!appState.categories.length) { tb.innerHTML = `<tr><td colspan="4" class="muted-empty">Chưa có danh mục.</td></tr>`; return; }
  tb.innerHTML = appState.categories.map(c => `<tr>
    <td><code>${esc(c.key)}</code></td>
    <td><span class="cat-name" data-catid="${esc(c.id)}" contenteditable="false">${esc(c.name)}</span></td>
    <td>${c.iconUrl ? `<img src="${esc(c.iconUrl)}" style="width:28px;height:28px;border-radius:6px;object-fit:cover" onerror="this.outerHTML='—'"/>` : '—'}</td>
    <td><div class="action-row">
      <button class="btn btn-sm btn-secondary" data-cat-edit="${esc(c.id)}"> Sửa tên</button>
      <button class="btn btn-sm btn-danger-solid" data-cat-delete="${esc(c.id)}"> Xóa</button>
    </div></td></tr>`).join("");

  tb.querySelectorAll<HTMLButtonElement>("button[data-cat-edit]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.catEdit!;
      const cat = appState.categories.find(c => c.id === id);
      const newName = prompt("Tên danh mục mới:", cat?.name || "");
      if (!newName || newName.trim() === cat?.name) return;
      btn.disabled = true;
      try { await api(`/categories/${id}`, { method: "PATCH", body: JSON.stringify({ name: newName.trim() }) }); await loadCategories(); flash("Đã cập nhật", "success"); }
      catch (e) { flash(errMsg(e), "error"); } finally { btn.disabled = false; }
    });
  });
  tb.querySelectorAll<HTMLButtonElement>("button[data-cat-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Xóa danh mục này?")) return;
      btn.disabled = true;
      try { await api(`/categories/${btn.dataset.catDelete}`, { method: "DELETE" }); await loadCategories(); flash("Đã xóa", "success"); }
      catch (e) { flash(errMsg(e), "error"); } finally { btn.disabled = false; }
    });
  });
}

/* ── Render: Banners ──────────────────────────── */
function renderBanners() {
  const grid = $("#banners-grid");
  if (!appState.banners.length) { grid.innerHTML = `<p class="muted-empty">Chưa có banner.</p>`; return; }
  grid.innerHTML = appState.banners.map(b => `<div class="banner-card" style="border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff">
    <img src="${esc(b.imageUrl)}" style="width:100%;height:140px;object-fit:cover" onerror="this.style.background='#f1f5f9';this.alt='Lỗi ảnh'"/>
    <div style="padding:10px 12px">
      <div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(b.title || "(Không có tiêu đề)")}</div>
      <div style="font-size:11px;color:var(--text-light);margin-bottom:6px">Thứ tự: ${b.sortOrder} · ${b.isActive ? '<span style="color:#22c55e">Hiển thị</span>' : '<span style="color:#ef4444">Ẩn</span>'}</div>
      <div class="action-row" style="gap:6px">
        <label class="switch" style="margin-right:auto"><input type="checkbox" data-banner-toggle="${esc(b.id)}" ${b.isActive ? "checked" : ""}><span>${b.isActive ? "Bật" : "Tắt"}</span></label>
        <button class="btn btn-sm btn-secondary" data-banner-img="${esc(b.id)}"> Đổi ảnh</button>
        <button class="btn btn-sm btn-danger-solid" data-banner-del="${esc(b.id)}"></button>
      </div>
    </div>
  </div>`).join("");

  grid.querySelectorAll<HTMLInputElement>("input[data-banner-toggle]").forEach(cb => {
    cb.addEventListener("change", async () => {
      cb.disabled = true;
      try { await api(`/banners/${cb.dataset.bannerToggle}`, { method: "PATCH", body: JSON.stringify({ isActive: cb.checked }) }); await loadBanners(); }
      catch (e) { cb.checked = !cb.checked; flash(errMsg(e), "error"); } finally { cb.disabled = false; }
    });
  });
  grid.querySelectorAll<HTMLButtonElement>("button[data-banner-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Xóa banner này?")) return;
      btn.disabled = true;
      try { await api(`/banners/${btn.dataset.bannerDel}`, { method: "DELETE" }); await loadBanners(); flash("Đã xóa", "success"); }
      catch (e) { flash(errMsg(e), "error"); } finally { btn.disabled = false; }
    });
  });
  grid.querySelectorAll<HTMLButtonElement>("button[data-banner-img]").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
      input.addEventListener("change", async () => {
        const file = input.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          btn.disabled = true;
          try { await api(`/banners/${btn.dataset.bannerImg}`, { method: "PATCH", body: JSON.stringify({ imageUrl: reader.result }) }); await loadBanners(); flash("Đã cập nhật ảnh", "success"); }
          catch (e) { flash(errMsg(e), "error"); } finally { btn.disabled = false; }
        };
        reader.readAsDataURL(file);
      });
      input.click();
    });
  });
}

/* ── Render: Users ───────────────────────────── */
const ROLE_LABELS: Record<string, string> = { CUSTOMER: "Khách hàng", ADMIN: "Admin", STORE_MANAGER: "QL Cửa hàng", DRIVER: "Tài xế" };

function renderUsers() {
  const tb = $("#users-body");
  if (!appState.users.length) { tb.innerHTML = `<tr><td colspan="7" class="muted-empty">Không có người dùng.</td></tr>`; return; }
  tb.innerHTML = appState.users.map(u => {
    const roleOpts = ["CUSTOMER", "ADMIN", "STORE_MANAGER", "DRIVER"].map(r =>
      `<option value="${r}" ${u.role === r ? "selected" : ""}>${ROLE_LABELS[r]}</option>`
    ).join("");
    return `<tr>
      <td><strong>${esc(u.name)}</strong></td>
      <td><small>${esc(u.email)}</small></td>
      <td><small>${esc(u.phone || "—")}</small></td>
      <td><select class="filter-select" data-user-role="${esc(u.id)}" style="min-width:110px;font-size:12px">${roleOpts}</select></td>
      <td>${u._count.orders}</td>
      <td><small>${fmtDate(u.createdAt)}</small></td>
      <td>${u.role !== "ADMIN" ? `<button class="btn btn-sm btn-danger-solid" data-user-del="${esc(u.id)}"></button>` : ''}</td>
    </tr>`;
  }).join("");

  // Role change
  tb.querySelectorAll<HTMLSelectElement>("select[data-user-role]").forEach(sel => {
    sel.addEventListener("change", async () => {
      sel.disabled = true;
      try { await api(`/admin/users/${sel.dataset.userRole}`, { method: "PATCH", body: JSON.stringify({ role: sel.value }) }); flash("Đã cập nhật vai trò", "success"); await loadUsers(appState.userPage); }
      catch (e) { flash(errMsg(e), "error"); await loadUsers(appState.userPage); } finally { sel.disabled = false; }
    });
  });
  // Delete
  tb.querySelectorAll<HTMLButtonElement>("button[data-user-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Xóa người dùng này?")) return;
      btn.disabled = true;
      try { await api(`/admin/users/${btn.dataset.userDel}`, { method: "DELETE" }); flash("Đã xóa", "success"); await loadUsers(appState.userPage); }
      catch (e) { flash(errMsg(e), "error"); } finally { btn.disabled = false; }
    });
  });

  // Pagination
  const pg = $("#users-pagination");
  if (appState.userTotalPages <= 1) { pg.innerHTML = ""; return; }
  let html = "";
  for (let i = 1; i <= appState.userTotalPages; i++) {
    html += `<button class="btn btn-sm ${i === appState.userPage ? 'btn-primary' : 'btn-secondary'}" data-user-page="${i}">${i}</button>`;
  }
  pg.innerHTML = html;
  pg.querySelectorAll<HTMLButtonElement>("button[data-user-page]").forEach(btn => {
    btn.addEventListener("click", () => void loadUsers(Number(btn.dataset.userPage)).catch(e => flash(errMsg(e), "error")));
  });
}

/* ── Event Handlers ────────────────────────────── */
async function handleLogin(e: SubmitEvent) {
  e.preventDefault(); loginError.textContent = ""; loginButton.disabled = true;
  try {
    const r = await api<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email: loginEmail.value.trim().toLowerCase(), password: loginPassword.value, role: "ADMIN" }) }, false);
    if (r.user.role !== "ADMIN") throw new Error("Không có quyền admin");
    state.tokens = r.tokens; state.user = r.user; saveSession(); showApp(); setTab(appState.activeTab);
    await loadAll(); flash("Đăng nhập thành công", "success");
  } catch (e: any) { loginError.textContent = errMsg(e); } finally { loginButton.disabled = false; }
}

async function handleLogout() {
  try { if (state.tokens?.refreshToken) await api("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: state.tokens.refreshToken }) }, false); }
  catch {} finally { clearSession(); showLogin(); flash("Đã đăng xuất", "info"); }
}

async function handleCreateStore(e: SubmitEvent) {
  e.preventDefault(); const form = $<HTMLFormElement>("#create-store-form"); const fd = new FormData(form);
  const etaMin = Number(fd.get("etaMinutesMin")); const etaMax = Number(fd.get("etaMinutesMax"));
  if (etaMin > etaMax) { flash("ETA tối thiểu > tối đa", "error"); return; }
  const p: Record<string, unknown> = { name: String(fd.get("name")??"").trim(), address: String(fd.get("address")??"").trim(), rating: Number(fd.get("rating")??4.5), etaMinutesMin: etaMin, etaMinutesMax: etaMax, managerName: String(fd.get("managerName")??"").trim(), managerEmail: String(fd.get("managerEmail")??"").trim().toLowerCase(), managerPassword: String(fd.get("managerPassword")??""), isOpen: true };
  const lat = String(fd.get("latitude")??"").trim(); const lng = String(fd.get("longitude")??"").trim();
  if (lat) p.latitude = Number(lat); if (lng) p.longitude = Number(lng);
  try { await api("/stores", { method: "POST", body: JSON.stringify(p) }); form.reset(); flash("Đã tạo cửa hàng", "success"); await Promise.all([loadStores(), loadOverview()]); }
  catch (e: any) { flash(errMsg(e), "error"); }
}

async function handleCreateVoucher(e: SubmitEvent) {
  e.preventDefault(); const form = $<HTMLFormElement>("#create-voucher-form"); const fd = new FormData(form);
  const p: Record<string, unknown> = {
    code: String(fd.get("code")??"").trim(),
    description: String(fd.get("description")??"").trim(),
    discountType: String(fd.get("discountType")??"FIXED"),
    discountValue: Number(fd.get("discountValue")??0),
    minOrderValue: Number(fd.get("minOrderValue")??0),
    maxUsagePerUser: Number(fd.get("maxUsagePerUser")??1),
    expiresAt: String(fd.get("expiresAt")??""),
  };
  const maxD = String(fd.get("maxDiscount")??"").trim(); if (maxD) p.maxDiscount = Number(maxD);
  const maxU = String(fd.get("maxUsageTotal")??"").trim(); if (maxU) p.maxUsageTotal = Number(maxU);
  try { await api("/vouchers", { method: "POST", body: JSON.stringify(p) }); form.reset(); flash("Đã tạo voucher", "success"); await loadVouchers(); }
  catch (e: any) { flash(errMsg(e), "error"); }
}

/* ── Bind Events ───────────────────────────────── */
function bindEvents() {
  loginForm.addEventListener("submit", e => void handleLogin(e));
  $("#logout-button").addEventListener("click", () => void handleLogout());
  $<HTMLFormElement>("#create-store-form").addEventListener("submit", e => void handleCreateStore(e));
  $<HTMLFormElement>("#create-voucher-form").addEventListener("submit", e => void handleCreateVoucher(e));
  $("#refresh-overview").addEventListener("click", () => void loadOverview().catch(e => flash(errMsg(e), "error")));
  $("#refresh-stores").addEventListener("click", () => void loadStores().catch(e => flash(errMsg(e), "error")));
  $("#refresh-driver-applications").addEventListener("click", () => void loadDriverApps().catch(e => flash(errMsg(e), "error")));
  $("#refresh-store-applications").addEventListener("click", () => void loadStoreApps().catch(e => flash(errMsg(e), "error")));
  $("#refresh-vouchers").addEventListener("click", () => void loadVouchers().catch(e => flash(errMsg(e), "error")));
  $<HTMLSelectElement>("#driver-status-filter").addEventListener("change", () => void loadDriverApps().catch(e => flash(errMsg(e), "error")));
  $<HTMLSelectElement>("#store-status-filter").addEventListener("change", () => void loadStoreApps().catch(e => flash(errMsg(e), "error")));
  navBtns.forEach(b => b.addEventListener("click", () => { const t = b.dataset.tab as TabKey|undefined; if (t) setTab(t); }));

  // Category create
  $<HTMLFormElement>("#create-category-form").addEventListener("submit", async (e) => {
    e.preventDefault(); const form = $<HTMLFormElement>("#create-category-form"); const fd = new FormData(form);
    const p: Record<string, unknown> = { key: String(fd.get("key")??"").trim(), name: String(fd.get("name")??"").trim() };
    const icon = String(fd.get("iconUrl")??"").trim(); if (icon) p.iconUrl = icon;
    try { await api("/categories", { method: "POST", body: JSON.stringify(p) }); form.reset(); flash("Đã thêm danh mục", "success"); await loadCategories(); }
    catch (e: any) { flash(errMsg(e), "error"); }
  });

  // Banner create with file upload
  const bannerFileInput = $<HTMLInputElement>("#banner-file-input");
  const bannerImageData = $<HTMLInputElement>("#banner-image-data");
  const bannerPreview = $("#banner-preview");
  bannerFileInput.addEventListener("change", () => {
    const file = bannerFileInput.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      bannerImageData.value = reader.result as string;
      bannerPreview.innerHTML = `<img src="${reader.result}" style="max-height:120px;border-radius:8px;border:1px solid var(--border)"/>`;
    };
    reader.readAsDataURL(file);
  });

  $<HTMLFormElement>("#create-banner-form").addEventListener("submit", async (e) => {
    e.preventDefault(); const form = $<HTMLFormElement>("#create-banner-form"); const fd = new FormData(form);
    const imageUrl = bannerImageData.value;
    if (!imageUrl) { flash("Vui lòng chọn ảnh banner", "error"); return; }
    const p: Record<string, unknown> = { imageUrl, sortOrder: Number(fd.get("sortOrder")??0) };
    const title = String(fd.get("title")??"").trim(); if (title) p.title = title;
    const link = String(fd.get("link")??"").trim(); if (link) p.link = link;
    try { await api("/banners", { method: "POST", body: JSON.stringify(p) }); form.reset(); bannerPreview.innerHTML = ""; bannerImageData.value = ""; flash("Đã thêm banner", "success"); await loadBanners(); }
    catch (e: any) { flash(errMsg(e), "error"); }
  });

  $("#refresh-categories").addEventListener("click", () => void loadCategories().catch(e => flash(errMsg(e), "error")));
  $("#refresh-banners").addEventListener("click", () => void loadBanners().catch(e => flash(errMsg(e), "error")));
  $("#refresh-users").addEventListener("click", () => void loadUsers().catch(e => flash(errMsg(e), "error")));

  let userSearchTimer: ReturnType<typeof setTimeout>;
  $("#user-search").addEventListener("input", () => { clearTimeout(userSearchTimer); userSearchTimer = setTimeout(() => void loadUsers().catch(e => flash(errMsg(e), "error")), 400); });
  $<HTMLSelectElement>("#user-role-filter").addEventListener("change", () => void loadUsers().catch(e => flash(errMsg(e), "error")));
}

/* ── Bootstrap ─────────────────────────────────── */
async function bootstrap() {
  bindEvents(); setTab(appState.activeTab); loadSession();
  if (state.tokens?.accessToken && state.user?.role === "ADMIN") {
    showApp();
    try { await loadAll(); flash("Đã khôi phục phiên", "info"); return; }
    catch (e) { clearSession(); showLogin(); flash(errMsg(e), "error"); return; }
  }
  showLogin();
}

void bootstrap();

(window as any).previewImage = function(src: string) {
  const w = window.open("", "_blank");
  if (w) { w.document.write(`<!DOCTYPE html><html><head><title>Xem ảnh</title></head><body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh"><img src="${src}" style="max-width:100%;max-height:100vh;object-fit:contain"/></body></html>`); w.document.close(); }
};
