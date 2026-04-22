/* ─── ZaUI Food Partner App ─── */
const API_BASE          = "/api/v1";
const STORE_SESSION_KEY = "zaui_food_store_session";

const state = {
  tokens:     null,
  user:       null,
  store:      null,
  products:   [],
  categories: [],
  orders:     [],
  wallet:     null,
  txns:       [],
  dashboard:  null,
  charts:     { revenue: null, payment: null },
  editImageB64: null,
  addImageB64:  null,
};

/* ─── DOM refs ─── */
const $ = (id) => document.getElementById(id);
const els = {
  authScreen:         $("auth-screen"),
  appScreen:          $("app-screen"),
  loginForm:          $("login-form"),
  registerForm:       $("register-form"),
  authError:          $("auth-error"),
  loginBtn:           $("login-btn"),
  registerBtn:        $("register-btn"),
  authTabs:           Array.from(document.querySelectorAll("[data-auth-tab]")),
  storeNameHeader:    $("store-name-header"),
  managerEmailHeader: $("manager-email-header"),
  storeStatusBadge:   $("store-status-badge"),
  logoutBtn:          $("logout-btn"),
  mainTabs:           Array.from(document.querySelectorAll(".main-tab")),
  mainSections:       Array.from(document.querySelectorAll("[data-main-section]")),

  /* Dashboard */
  refreshDashboard: $("refresh-dashboard"),
  kpiTodayRevenue:  $("kpi-today-revenue"),
  kpiTodayOrders:   $("kpi-today-orders"),
  kpiWeekRevenue:   $("kpi-week-revenue"),
  kpiWeekOrders:    $("kpi-week-orders"),
  kpiMonthRevenue:  $("kpi-month-revenue"),
  kpiMonthOrders:   $("kpi-month-orders"),
  kpiTotalRevenue:  $("kpi-total-revenue"),
  kpiTotalOrders:   $("kpi-total-orders"),
  topProductsBody:  $("top-products-body"),
  recentOrdersBody: $("recent-orders-body"),

  /* Products */
  openAddProduct:    $("open-add-product"),
  addProductPanel:   $("add-product-panel"),
  cancelAddProduct:  $("cancel-add-product"),
  createProductForm: $("create-product-form"),
  categoryContainer: $("category-container"),
  productsBody:      $("products-body"),

  /* Image upload – Add form */
  imageUrlGroup:   $("image-url-group"),
  imageFileGroup:  $("image-file-group"),
  imageUrlInput:   $("image-url-input"),
  imageFileInput:  $("image-file-input"),
  imagePreview:    $("image-preview"),
  imagePreviewWrap:$("image-preview-wrap"),
  optUrlLabel:     $("opt-url-label"),
  optFileLabel:    $("opt-file-label"),

  /* Orders */
  ordersBody:          $("orders-body"),
  orderStatusFilter:   $("order-status-filter"),
  refreshOrders:       $("refresh-orders"),

  /* Wallet */
  refreshWallet:   $("refresh-wallet"),
  merchantBalance: $("merchant-balance"),
  merchantHold:    $("merchant-hold"),
  payoutForm:      $("payout-form"),
  txnBody:         $("txn-body"),

  /* Edit modal */
  editModal:          $("edit-modal"),
  closeEditModal:     $("close-edit-modal"),
  closeEditModal2:    $("close-edit-modal-2"),
  editProductForm:    $("edit-product-form"),
  editCategoryContainer: $("edit-category-container"),
  editImageUrlGroup:  $("edit-image-url-group"),
  editImageFileGroup: $("edit-image-file-group"),
  editImageUrlInput:  $("edit-image-url-input"),
  editImageFileInput: $("edit-image-file-input"),
  editImagePreview:   $("edit-image-preview"),
  editImagePreviewWrap:$("edit-image-preview-wrap"),
  editOptUrlLabel:    $("edit-opt-url-label"),
  editOptFileLabel:   $("edit-opt-file-label"),
};

/* ─── Session ─── */
function saveSession() {
  localStorage.setItem(STORE_SESSION_KEY, JSON.stringify({ tokens: state.tokens, user: state.user }));
}
function loadSession() {
  try {
    const raw = localStorage.getItem(STORE_SESSION_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    state.tokens = p.tokens;
    state.user   = p.user;
  } catch { localStorage.removeItem(STORE_SESSION_KEY); }
}
function clearSession() {
  state.tokens = state.user = null;
  localStorage.removeItem(STORE_SESSION_KEY);
}

/* ─── API helper ─── */
async function api(path, options = {}, auth = true) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (auth && state.tokens?.accessToken) headers.set("Authorization", `Bearer ${state.tokens.accessToken}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let payload = null;
  try { payload = await res.json(); } catch {}

  if (res.status === 401 && auth && state.tokens?.refreshToken) {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
    });
    if (refreshRes.ok) {
      const rp = await refreshRes.json();
      state.tokens = rp.tokens; state.user = rp.user; saveSession();
      return api(path, options, auth);
    }
  }
  if (!res.ok) throw new Error(payload?.message || `Lỗi ${res.status}`);
  return payload;
}

/* ─── Formatters ─── */
const fmtVND = (v) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v || 0);
const fmtDate = (v) => v ? new Date(v).toLocaleString("vi-VN") : "–";
const fmtShort = (v) => {
  const n = Math.abs(v || 0);
  if (n >= 1e9) return (v/1e9).toFixed(1) + " tỷ";
  if (n >= 1e6) return (v/1e6).toFixed(1) + " tr";
  if (n >= 1e3) return (v/1e3).toFixed(0) + "k";
  return fmtVND(v);
};

/* ─── Auth tabs ─── */
function setAuthTab(tab) {
  els.authTabs.forEach((b) => b.classList.toggle("active", b.dataset.authTab === tab));
  els.loginForm.classList.toggle("hidden", tab !== "login");
  els.registerForm.classList.toggle("hidden", tab !== "register");
  els.authError.textContent = "";
}
els.authTabs.forEach((b) => b.addEventListener("click", () => setAuthTab(b.dataset.authTab)));

/* ─── Main nav tabs ─── */
function setMainTab(tab) {
  els.mainTabs.forEach((b) => b.classList.toggle("active", b.dataset.mainTab === tab));
  els.mainSections.forEach((s) => s.classList.toggle("hidden", s.dataset.mainSection !== tab));
  if (tab === "dashboard") loadDashboard();
  if (tab === "products")  loadProducts();
  if (tab === "orders")    loadOrders();
  if (tab === "wallet")    loadWallet();
}
els.mainTabs.forEach((b) => b.addEventListener("click", () => setMainTab(b.dataset.mainTab)));

/* ──────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────*/
async function loadDashboard() {
  try {
    const resp = await api("/stores/managed/dashboard");
    state.dashboard = resp.data;
    renderDashboard();
  } catch (e) { console.error(e); }
}

function renderDashboard() {
  const d = state.dashboard;
  if (!d) return;
  const s = d.summary;

  els.kpiTodayRevenue.textContent  = fmtShort(s.todayRevenue);
  els.kpiTodayOrders.textContent   = `${s.todayOrders} đơn`;
  els.kpiWeekRevenue.textContent   = fmtShort(s.weekRevenue);
  els.kpiWeekOrders.textContent    = `${s.weekOrders} đơn`;
  els.kpiMonthRevenue.textContent  = fmtShort(s.monthRevenue);
  els.kpiMonthOrders.textContent   = `${s.monthOrders} đơn`;
  els.kpiTotalRevenue.textContent  = fmtShort(s.totalRevenue);
  els.kpiTotalOrders.textContent   = `${s.totalDeliveredOrders} đơn tất cả`;

  renderRevenueChart(d.trend7Days);
  renderPaymentChart(s.cashlessOrders, s.codOrders);
  renderTopProducts(d.topProducts);
  renderRecentOrders(d.recentOrders);
}

function renderRevenueChart(trend) {
  const ctx = $("revenue-chart").getContext("2d");
  if (state.charts.revenue) state.charts.revenue.destroy();
  state.charts.revenue = new Chart(ctx, {
    type: "bar",
    data: {
      labels: trend.map((t) => {
        const d = new Date(t.date);
        return `${d.getDate()}/${d.getMonth()+1}`;
      }),
      datasets: [{
        label: "Doanh thu (đ)",
        data: trend.map((t) => t.revenue),
        backgroundColor: trend.map((_, i) => i === trend.length - 1 ? "#00b14f" : "rgba(0,177,79,0.4)"),
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { callback: (v) => fmtShort(v), font: { size: 11 } },
          grid: { color: "#eef2ef" },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderPaymentChart(cashless, cod) {
  const ctx = $("payment-chart").getContext("2d");
  if (state.charts.payment) state.charts.payment.destroy();
  state.charts.payment = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["SePay QR", "Tiền mặt COD"],
      datasets: [{
        data: [cashless, cod],
        backgroundColor: ["#00b14f", "#f59e0b"],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 12 } } },
      },
    },
  });
}

function renderTopProducts(items) {
  if (!items?.length) { els.topProductsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;">Chưa có dữ liệu</td></tr>'; return; }
  els.topProductsBody.innerHTML = items.map((item, i) => `
    <tr>
      <td><strong>#${i+1}</strong></td>
      <td>${item.productName}</td>
      <td><strong>${item.quantitySold.toLocaleString("vi-VN")}</strong> phần</td>
      <td>${fmtVND(item.grossSales)}</td>
    </tr>
  `).join("");
}

function renderRecentOrders(orders) {
  if (!orders?.length) { els.recentOrdersBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;">Chưa có đơn hàng</td></tr>'; return; }
  els.recentOrdersBody.innerHTML = orders.map((o) => `
    <tr>
      <td><code>${o.id.slice(0,8)}</code></td>
      <td><span class="status-badge status-${o.status}">${statusLabel(o.status)}</span></td>
      <td><span class="pm-badge pm-${o.paymentMethod}">${o.paymentMethod === "COD" ? "COD" : "QR"}</span></td>
      <td>${fmtVND(o.total)}</td>
      <td><strong>${fmtVND(o.merchantPayout)}</strong></td>
      <td style="font-size:12px;color:#6b7f72;">${fmtDate(o.createdAt)}</td>
    </tr>
  `).join("");
}

els.refreshDashboard.addEventListener("click", loadDashboard);

/* ──────────────────────────────────────────
   PRODUCTS
───────────────────────────────────────────*/
async function loadProducts() {
  try {
    const r = await api("/products/managed/my");
    state.products = r.data;
    renderProductsTable();
  } catch (e) { console.error(e); }
}

async function loadCategories() {
  try {
    const r = await api("/categories", {}, false);
    state.categories = r.data;
    renderCategoryChecklist(els.categoryContainer);
    renderCategoryChecklist(els.editCategoryContainer);
  } catch (e) { console.error(e); }
}

function renderCategoryChecklist(container, selectedKeys = []) {
  container.innerHTML = state.categories.map((c) => `
    <label class="category-chip${selectedKeys.includes(c.key) ? " selected" : ""}" onclick="toggleChip(this)">
      <input type="checkbox" value="${c.key}" ${selectedKeys.includes(c.key) ? "checked" : ""}/>
      ${c.name}
    </label>
  `).join("");
}
window.toggleChip = (el) => {
  el.classList.toggle("selected");
  el.querySelector("input").checked = el.classList.contains("selected");
};

function getCheckedCategories(container) {
  return Array.from(container.querySelectorAll("input:checked")).map((i) => i.value);
}

function renderProductsTable() {
  if (!state.products.length) {
    els.productsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:24px;">Chưa có món nào – hãy thêm món đầu tiên!</td></tr>';
    return;
  }
  els.productsBody.innerHTML = state.products.map((p) => `
    <tr>
      <td>${p.imageUrl
        ? `<img class="product-thumb" src="${p.imageUrl.startsWith("data:") ? p.imageUrl : p.imageUrl}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="no-img" style="display:none">🍽️</div>`
        : `<div class="no-img">🍽️</div>`
      }</td>
      <td>
        <strong>${p.name}</strong>
        ${p.description ? `<br><small style="color:#6b7f72;">${p.description.slice(0,50)}${p.description.length>50?"...":""}</small>` : ""}
      </td>
      <td>${fmtVND(p.price)}</td>
      <td>${p.categories.map((c) => `<span style="font-size:11px;padding:2px 7px;background:#dff8ea;border-radius:999px;color:#006e2f;font-weight:600">${c.name}</span>`).join(" ")}</td>
      <td>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" data-toggle-avail="${p.id}" ${p.isAvailable ? "checked" : ""} />
          <span style="font-size:12px;">${p.isAvailable ? "Hiển thị" : "Ẩn"}</span>
        </label>
      </td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="secondary btn-sm" data-edit="${p.id}">✏️ Sửa</button>
          <button class="danger btn-sm" data-del="${p.id}">🗑️</button>
        </div>
      </td>
    </tr>
  `).join("");

  /* Toggle availability */
  els.productsBody.querySelectorAll("input[data-toggle-avail]").forEach((cb) => {
    cb.addEventListener("change", async () => {
      try {
        await api(`/products/${cb.dataset.toggleAvail}`, { method: "PATCH", body: JSON.stringify({ isAvailable: cb.checked }) });
        await loadProducts();
      } catch (e) { alert(e.message); }
    });
  });

  /* Edit */
  els.productsBody.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.edit));
  });

  /* Delete */
  els.productsBody.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Bạn có chắc muốn xoá món này?")) return;
      try {
        await api(`/products/${btn.dataset.del}`, { method: "DELETE" });
        await loadProducts();
      } catch (e) { alert(e.message); }
    });
  });
}

/* Add product */
els.openAddProduct.addEventListener("click", () => {
  els.addProductPanel.style.display = "block";
  els.openAddProduct.style.display = "none";
  els.addProductPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});
els.cancelAddProduct.addEventListener("click", () => {
  els.addProductPanel.style.display  = "none";
  els.openAddProduct.style.display = "";
  els.createProductForm.reset();
  state.addImageB64 = null;
  els.imagePreviewWrap.classList.add("hidden");
});

/* Image type toggle – Add form */
function setupImageToggle(urlLabel, fileLabel, urlGroup, fileGroup, fileInput, preview, previewWrap, stateKey) {
  document.querySelectorAll(`input[name="${urlLabel.querySelector("input").name}"]`).forEach((radio) => {
    radio.addEventListener("change", () => {
      const isFile = radio.value === "file";
      urlLabel.classList.toggle("active", !isFile);
      fileLabel.classList.toggle("active", isFile);
      urlGroup.classList.toggle("hidden", isFile);
      fileGroup.classList.toggle("hidden", !isFile);
    });
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      state[stateKey] = e.target.result;
      preview.src = e.target.result;
      previewWrap.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  });
}

setupImageToggle(els.optUrlLabel, els.optFileLabel, els.imageUrlGroup, els.imageFileGroup, els.imageFileInput, els.imagePreview, els.imagePreviewWrap, "addImageB64");
setupImageToggle(els.editOptUrlLabel, els.editOptFileLabel, els.editImageUrlGroup, els.editImageFileGroup, els.editImageFileInput, els.editImagePreview, els.editImagePreviewWrap, "editImageB64");

els.createProductForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(els.createProductForm);
  const isFileMode = fd.get("imageType") === "file";
  const categoryKeys = getCheckedCategories(els.categoryContainer);
  if (!categoryKeys.length) { alert("Chọn ít nhất 1 danh mục"); return; }

  let imageUrl = undefined;
  if (isFileMode) { imageUrl = state.addImageB64 || undefined; }
  else { imageUrl = String(fd.get("imageUrl") || "").trim() || undefined; }

  const body = {
    name: String(fd.get("name") || "").trim(),
    price: Number(fd.get("price")),
    deliveryFee: Number(fd.get("deliveryFee") || 15000),
    description: String(fd.get("description") || "").trim() || undefined,
    imageUrl,
    categoryKeys,
    isAvailable: true,
  };

  try {
    await api("/products", { method: "POST", body: JSON.stringify(body) });
    els.createProductForm.reset();
    state.addImageB64 = null;
    els.imagePreviewWrap.classList.add("hidden");
    els.addProductPanel.style.display = "none";
    els.openAddProduct.style.display = "";
    await loadProducts();
    await loadDashboard();
  } catch (err) { alert(`Thêm món thất bại: ${err.message}`); }
});

/* Edit modal */
function openEditModal(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  const form = els.editProductForm;
  form.elements.productId.value    = product.id;
  form.elements.name.value          = product.name;
  form.elements.price.value         = product.price;
  form.elements.deliveryFee.value   = product.deliveryFee;
  form.elements.description.value   = product.description || "";
  form.elements.imageUrl.value      = (!product.imageUrl || product.imageUrl.startsWith("data:")) ? "" : product.imageUrl;
  els.editImageUrlInput.value        = form.elements.imageUrl.value;
  state.editImageB64 = null;
  els.editImagePreviewWrap.classList.add("hidden");

  renderCategoryChecklist(els.editCategoryContainer, product.categories.map((c) => c.key));
  els.editModal.classList.remove("hidden");
}
els.closeEditModal.addEventListener("click",  () => els.editModal.classList.add("hidden"));
els.closeEditModal2.addEventListener("click", () => els.editModal.classList.add("hidden"));

els.editProductForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(els.editProductForm);
  const productId = fd.get("productId");
  const isFileMode = fd.get("editImageType") === "file";
  const categoryKeys = getCheckedCategories(els.editCategoryContainer);
  if (!categoryKeys.length) { alert("Chọn ít nhất 1 danh mục"); return; }

  let imageUrl = undefined;
  if (isFileMode) { imageUrl = state.editImageB64 || undefined; }
  else { imageUrl = String(els.editImageUrlInput.value || "").trim() || undefined; }

  const body = {
    name: String(fd.get("name") || "").trim(),
    price: Number(fd.get("price")),
    deliveryFee: Number(fd.get("deliveryFee") || 15000),
    description: String(fd.get("description") || "").trim() || undefined,
    imageUrl,
    categoryKeys,
  };

  try {
    await api(`/products/${productId}`, { method: "PATCH", body: JSON.stringify(body) });
    els.editModal.classList.add("hidden");
    await loadProducts();
  } catch (err) { alert(`Cập nhật thất bại: ${err.message}`); }
});

/* ──────────────────────────────────────────
   ORDERS
───────────────────────────────────────────*/
async function loadOrders() {
  try {
    const status = els.orderStatusFilter.value;
    const qs = status ? `?status=${status}&limit=100` : "?limit=100";
    const r = await api(`/orders${qs}`);
    state.orders = r.data;
    renderOrders();
  } catch (e) { console.error(e); }
}

function renderOrders() {
  if (!state.orders.length) {
    els.ordersBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:24px;">Chưa có đơn nào</td></tr>';
    return;
  }
  els.ordersBody.innerHTML = state.orders.map((o) => `
    <tr>
      <td><code>${o.id.slice(0,8)}</code></td>
      <td style="max-width:200px;font-size:13px;">${(o.items||[]).map((i) => i.productName + " x" + i.quantity).join(", ").slice(0,80)}</td>
      <td><span class="pm-badge pm-${o.paymentMethod}">${o.paymentMethod === "COD" ? "💵 COD" : "📱 QR"}</span></td>
      <td><span class="status-badge status-${o.status}">${statusLabel(o.status)}</span></td>
      <td>${fmtVND(o.total)}</td>
      <td><strong style="color:#006e2f;">${fmtVND(o.merchantPayout)}</strong></td>
      <td style="font-size:12px;color:#6b7f72;">${fmtDate(o.createdAt)}</td>
    </tr>
  `).join("");
}

els.orderStatusFilter.addEventListener("change", loadOrders);
els.refreshOrders.addEventListener("click", loadOrders);

/* ──────────────────────────────────────────
   WALLET
───────────────────────────────────────────*/
async function loadWallet() {
  try {
    const [walletResp, txnResp] = await Promise.all([
      api("/wallets/me"),
      api("/wallets/transactions?limit=50"),
    ]);
    state.wallet = walletResp.data.wallets.merchant;
    state.txns   = txnResp.data;
    renderWallet();
  } catch (e) { console.error(e); }
}

function renderWallet() {
  if (!state.wallet) return;
  els.merchantBalance.textContent = fmtVND(state.wallet.availableBalance);
  els.merchantHold.textContent    = fmtVND(state.wallet.holdBalance);
  renderTransactions();
}

function renderTransactions() {
  if (!state.txns.length) {
    els.txnBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;">Chưa có giao dịch nào</td></tr>';
    return;
  }
  els.txnBody.innerHTML = state.txns.map((t) => `
    <tr>
      <td style="font-size:12px;">${txnTypeLabel(t.type)}</td>
      <td><span style="font-weight:700;color:${t.direction === "CREDIT" ? "#006e2f" : "#b91c1c"}">${t.direction === "CREDIT" ? "+" : "−"}</span></td>
      <td style="font-weight:700;color:${t.direction === "CREDIT" ? "#006e2f" : "#b91c1c"}">${fmtVND(t.amount)}</td>
      <td>${fmtVND(t.availableAfter)}</td>
      <td style="font-size:12px;">${t.note || "–"}</td>
      <td style="font-size:12px;color:#6b7f72;">${fmtDate(t.createdAt)}</td>
    </tr>
  `).join("");
}

els.refreshWallet.addEventListener("click", loadWallet);
els.payoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(els.payoutForm);
  const body = {
    amount:            Number(fd.get("amount")),
    bankCode:          String(fd.get("bankCode")),
    bankAccountNumber: String(fd.get("bankAccountNumber")),
    bankAccountName:   String(fd.get("bankAccountName")),
  };
  try {
    await api("/wallets/payouts", { method: "POST", body: JSON.stringify(body) });
    els.payoutForm.reset();
    await loadWallet();
    showToast("✅ Yêu cầu rút tiền đã được ghi nhận!");
  } catch (err) { alert(`Rút tiền thất bại: ${err.message}`); }
});

/* ──────────────────────────────────────────
   LABELS & HELPERS
───────────────────────────────────────────*/
function statusLabel(s) {
  const map = { PENDING:"Chờ xác nhận", CONFIRMED:"Đã xác nhận", PREPARING:"Đang chuẩn bị", PICKED_UP:"Đang giao", DELIVERED:"Đã giao", CANCELLED:"Đã huỷ" };
  return map[s] || s;
}
function txnTypeLabel(t) {
  const map = {
    ORDER_MERCHANT_SETTLEMENT: "Thu đơn hàng",
    WITHDRAW_COMPLETED: "Rút tiền",
    MANUAL_ADJUSTMENT: "Điều chỉnh thủ công",
    ORDER_ESCROW_IN: "Escrow vào",
  };
  return map[t] || t;
}

function showToast(msg) {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
    background: "#0a3520", color: "#fff", borderRadius: "12px", padding: "12px 24px",
    fontWeight: "700", zIndex: "999", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    animation: "none",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* ──────────────────────────────────────────
   BOOT
───────────────────────────────────────────*/
async function bootApp() {
  const email = state.user?.email || "";
  els.managerEmailHeader.textContent = email;
  els.appScreen.classList.remove("hidden");
  els.authScreen.classList.add("hidden");
  await Promise.all([loadCategories(), loadStore()]);
  await loadDashboard();
}

async function loadStore() {
  try {
    const r = await api("/stores/managed/me");
    state.store = r.data;
    els.storeNameHeader.textContent = state.store.name;
    if (state.store.isOpen) {
      els.storeStatusBadge.textContent = "🟢 Đang mở";
      els.storeStatusBadge.className = "store-status-badge";
    } else {
      els.storeStatusBadge.textContent = "🔴 Tạm đóng";
      els.storeStatusBadge.className = "store-status-badge closed";
    }
  } catch (e) { console.error(e); }
}

/* Auth – Login */
els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.authError.textContent = "";
  els.loginBtn.disabled = true;
  const fd = new FormData(els.loginForm);
  try {
    const r = await api("/auth/login", { method: "POST", body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }) }, false);
    if (r.user.role !== "STORE_MANAGER") throw new Error("Tài khoản không có quyền quản lý cửa hàng");
    state.tokens = r.tokens; state.user = r.user; saveSession();
    await bootApp();
  } catch (err) { els.authError.textContent = err.message; }
  finally { els.loginBtn.disabled = false; }
});

/* Auth – Register */
els.registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.authError.textContent = "";
  els.registerBtn.disabled = true;
  const fd = new FormData(els.registerForm);
  const body = {
    managerName:     String(fd.get("managerName") || "").trim(),
    managerEmail:    String(fd.get("managerEmail") || "").trim(),
    managerPhone:    String(fd.get("managerPhone") || "").trim() || undefined,
    managerPassword: String(fd.get("managerPassword") || ""),
    storeName:       String(fd.get("storeName") || "").trim(),
    storeAddress:    String(fd.get("storeAddress") || "").trim(),
    etaMinutesMin:   Number(fd.get("etaMinutesMin") || 20),
    etaMinutesMax:   Number(fd.get("etaMinutesMax") || 35),
  };
  try {
    const r = await api("/auth/register/store", { method: "POST", body: JSON.stringify(body) }, false);
    state.tokens = r.tokens; state.user = r.user; saveSession();
    await bootApp();
    showToast("🏪 Đăng ký cửa hàng thành công! Chờ admin kích hoạt.");
  } catch (err) { els.authError.textContent = err.message; }
  finally { els.registerBtn.disabled = false; }
});

/* Logout */
els.logoutBtn.addEventListener("click", async () => {
  try {
    if (state.tokens?.refreshToken)
      await api("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: state.tokens.refreshToken }) }, false);
  } catch {}
  clearSession();
  window.location.reload();
});

/* Init */
loadSession();
if (state.tokens?.accessToken && state.user?.role === "STORE_MANAGER") {
  bootApp().catch((err) => { console.error(err); clearSession(); window.location.reload(); });
}
