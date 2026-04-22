/* ─── ZaUI Food Customer App ─── */
const API_BASE    = "/api/v1";
const SESSION_KEY = "zaui_food_customer_session";

const state = {
  tokens:  null,
  user:    null,
  profile: null,
  orders:  [],
  stores:  [],
  products: [],
  cart:    {},   /* productId -> { product, qty } */
  selectedStoreId: null,
  currentOrderId:  null,
  currentPayment:  null,
};

const $ = (id) => document.getElementById(id);
const els = {
  authScreen:        $("auth-screen"),
  appScreen:         $("app-screen"),
  authTabs:          Array.from(document.querySelectorAll("[data-auth-tab]")),
  loginForm:         $("login-form"),
  registerForm:      $("register-form"),
  authError:         $("auth-error"),
  loginBtn:          $("login-btn"),
  registerBtn:       $("register-btn"),
  customerName:      $("customer-name"),
  customerEmail:     $("customer-email"),
  refreshBtn:        $("refresh-btn"),
  logoutBtn:         $("logout-btn"),
  mainTabs:          Array.from(document.querySelectorAll(".main-tab")),
  mainSections:      Array.from(document.querySelectorAll("[data-main-section]")),

  /* Orders */
  ordersList:        $("orders-list"),
  refreshOrders:     $("refresh-orders"),

  /* Stores */
  storesGrid:        $("stores-grid"),
  refreshStores:     $("refresh-stores"),
  storeSearch:       $("store-search"),

  /* Place order */
  placeStoreSelect:  $("place-store-select"),
  placeProductsSection: $("place-products-section"),
  placeProductsGrid: $("place-products-grid"),
  cartPanel:         $("cart-panel"),
  cartItems:         $("cart-items"),
  cartTotalText:     $("cart-total-text"),
  cartFeeText:       $("cart-fee-text"),
  cartGrandTotal:    $("cart-grand-total"),
  checkoutNext:      $("checkout-next"),

  /* Step 2 */
  placeStep2:        $("place-step2"),
  placeStep3:        $("place-step3"),
  checkoutForm:      $("checkout-form"),
  placeOrderBtn:     $("place-order-btn"),
  backToStep1:       $("back-to-step1"),

  /* Step 3 */
  step3Title:        $("step3-title"),
  paymentQrSection:  $("payment-qr-section"),
  paymentCodSection: $("payment-cod-section"),
  orderQrCode:       $("order-qr-code"),
  orderAmountDisplay:$("order-amount-display"),
  orderRefCode:      $("order-ref-code"),
  checkPaymentBtn:   $("check-payment-btn"),
  codAmount:         $("cod-amount"),
  goToOrders:        $("go-to-orders"),

  /* Modal */
  orderDetailModal:   $("order-detail-modal"),
  closeOrderModal:    $("close-order-modal"),
  orderDetailContent: $("order-detail-content"),
};

/* ─── Session ─── */
function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ tokens: state.tokens, user: state.user }));
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    state.tokens = p.tokens; state.user = p.user;
  } catch { localStorage.removeItem(SESSION_KEY); }
}
function clearSession() {
  state.tokens = state.user = null;
  localStorage.removeItem(SESSION_KEY);
}

/* ─── API ─── */
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
const fmtVND  = (v) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v || 0);
const fmtDate = (v) => v ? new Date(v).toLocaleString("vi-VN") : "–";

function statusLabel(s) {
  const m = { PENDING:"Chờ xác nhận", CONFIRMED:"Đã xác nhận", PREPARING:"Đang chuẩn bị", PICKED_UP:"Đang giao", DELIVERED:"Đã giao", CANCELLED:"Đã huỷ" };
  return m[s] || s;
}

/* ─── Auth tabs ─── */
els.authTabs.forEach((b) => b.addEventListener("click", () => {
  els.authTabs.forEach((x) => x.classList.toggle("active", x.dataset.authTab === b.dataset.authTab));
  els.loginForm.classList.toggle("hidden", b.dataset.authTab !== "login");
  els.registerForm.classList.toggle("hidden", b.dataset.authTab !== "register");
  els.authError.textContent = "";
}));

/* ─── Main tabs ─── */
function setMainTab(tab) {
  els.mainTabs.forEach((b) => b.classList.toggle("active", b.dataset.mainTab === tab));
  els.mainSections.forEach((s) => s.classList.toggle("hidden", s.dataset.mainSection !== tab));
  if (tab === "orders") loadOrders();
  if (tab === "stores") loadStores();
  if (tab === "place")  loadStoresForSelect();
}
els.mainTabs.forEach((b) => b.addEventListener("click", () => setMainTab(b.dataset.mainTab)));

/* ──────────────── ORDERS ──────────────── */
async function loadOrders() {
  try {
    const r = await api("/orders?limit=50");
    state.orders = r.data;
    renderOrders();
  } catch (e) { console.error(e); }
}

function renderOrders() {
  if (!state.orders.length) {
    els.ordersList.innerHTML = `<div class="empty-state"><div class="emoji">📭</div><p>Bạn chưa có đơn nào<br><small>Hãy đặt món ngay!</small></p></div>`;
    return;
  }
  els.ordersList.innerHTML = state.orders.map((o) => `
    <div class="order-card" data-order-id="${o.id}">
      <div class="order-card-icon">📦</div>
      <div class="order-card-body">
        <div class="order-card-header">
          <div>
            <div class="order-store">${o.store?.name || "–"}</div>
            <div class="order-id">#${o.id.slice(0,8)}</div>
          </div>
          <span class="status-badge status-${o.status}">${statusLabel(o.status)}</span>
        </div>
        <div class="order-meta">
          💰 <strong>${fmtVND(o.total)}</strong> &nbsp;
          <span class="pm-badge pm-${o.paymentMethod}">${o.paymentMethod === "COD" ? "💵 COD" : "📱 QR"}</span>
          &nbsp; 🕒 ${fmtDate(o.createdAt)}
          ${o.status === "PENDING" && o.paymentMethod === "SEPAY_QR" && o.paymentStatus === "PENDING"
            ? ` &nbsp; <span style="color:#e05500;font-weight:700;font-size:12px;">⚠️ Chờ thanh toán</span>` : ""}
        </div>
      </div>
    </div>
  `).join("");

  els.ordersList.querySelectorAll(".order-card").forEach((card) => {
    card.addEventListener("click", () => openOrderDetail(card.dataset.orderId));
  });
}

els.refreshOrders.addEventListener("click", loadOrders);

/* Order detail modal */
async function openOrderDetail(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;

  let qrHtml = "";
  if (order.paymentMethod === "SEPAY_QR" && order.paymentStatus === "PENDING" && order.payment?.sepayQrContent) {
    qrHtml = `
      <div class="order-detail-section">
        <h5>📱 Quét QR để thanh toán</h5>
        <div class="qr-box">
          <div id="modal-qr-code"></div>
          <p class="qr-amount">${fmtVND(order.total)}</p>
          <p class="qr-ref">Mã: <code>${order.payment.sepayReferenceCode || ""}</code></p>
        </div>
      </div>
    `;
  }

  els.orderDetailContent.innerHTML = `
    <div class="order-detail-section">
      <h5>Thông tin đơn</h5>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px;">
        <div>Mã đơn: <code>${order.id.slice(0,12)}…</code></div>
        <div>Cửa hàng: <strong>${order.store?.name || "–"}</strong></div>
        <div>Trạng thái: <span class="status-badge status-${order.status}">${statusLabel(order.status)}</span></div>
        <div>Thanh toán: <span class="pm-badge pm-${order.paymentMethod}">${order.paymentMethod === "COD" ? "COD" : "QR"}</span></div>
        <div>Đặt lúc: ${fmtDate(order.createdAt)}</div>
        ${order.completedAt ? `<div>Giao lúc: ${fmtDate(order.completedAt)}</div>` : ""}
      </div>
    </div>
    <div class="order-detail-section">
      <h5>Món ăn</h5>
      <div class="order-items-list">
        ${(order.items || []).map((i) => `
          <div class="order-item-row">
            <span>${i.productName} × ${i.quantity}</span>
            <span>${fmtVND(i.lineTotal)}</span>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="order-detail-section">
      <h5>Chi phí</h5>
      <div style="font-size:14px;display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;justify-content:space-between;"><span>Tiền món:</span><span>${fmtVND(order.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Phí ship:</span><span>${fmtVND(order.deliveryFee)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Phí nền tảng:</span><span>${fmtVND(order.platformFee)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:800;font-size:16px;border-top:1px solid #d3ddd7;padding-top:6px;margin-top:4px;">
          <span>Tổng cộng:</span><span style="color:#006e2f;">${fmtVND(order.total)}</span>
        </div>
      </div>
    </div>
    ${qrHtml}
  `;

  els.orderDetailModal.classList.remove("hidden");

  if (order.payment?.sepayQrContent) {
    setTimeout(() => {
      const qrContainer = $("modal-qr-code");
      if (qrContainer) {
        qrContainer.innerHTML = "";
        new QRCode(qrContainer, {
          text: order.payment.sepayQrContent,
          width: 180, height: 180,
          colorDark: "#0a3520", colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M,
        });
      }
    }, 100);
  }
}

els.closeOrderModal.addEventListener("click", () => els.orderDetailModal.classList.add("hidden"));

/* ──────────────── STORES ──────────────── */
async function loadStores() {
  try {
    const r = await api("/stores?limit=50", {}, false);
    state.stores = r.data;
    renderStores(state.stores);
  } catch (e) { console.error(e); }
}

function renderStores(stores) {
  if (!stores.length) {
    els.storesGrid.innerHTML = `<div class="empty-state"><div class="emoji">🏪</div><p>Không tìm thấy cửa hàng</p></div>`;
    return;
  }
  els.storesGrid.innerHTML = stores.map((s) => `
    <div class="store-card${s.isOpen ? "" : " closed"}">
      <div class="store-card-header">
        <div class="store-name">${s.name}</div>
        <span class="store-open-badge ${s.isOpen ? "open" : "closed"}">${s.isOpen ? "Đang mở" : "Đóng cửa"}</span>
      </div>
      <div class="store-address">📍 ${s.address}</div>
      <div class="store-meta">
        <span class="store-rating">⭐ ${s.rating.toFixed(1)}</span>
        <span class="store-eta">🕒 ${s.etaMinutesMin}–${s.etaMinutesMax} phút</span>
      </div>
      ${s.isOpen ? `<button class="store-select-btn" data-store-id="${s.id}" data-store-name="${s.name}">🛒 Đặt món từ đây</button>` : ""}
    </div>
  `).join("");

  els.storesGrid.querySelectorAll(".store-select-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setMainTab("place");
      setTimeout(() => {
        els.placeStoreSelect.value = btn.dataset.storeId;
        els.placeStoreSelect.dispatchEvent(new Event("change"));
      }, 200);
    });
  });
}

els.refreshStores.addEventListener("click", loadStores);
els.storeSearch.addEventListener("input", () => {
  const q = els.storeSearch.value.toLowerCase();
  renderStores(state.stores.filter((s) => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)));
});

/* ──────────────── PLACE ORDER ──────────────── */
async function loadStoresForSelect() {
  if (state.stores.length === 0) await loadStores();
  const opened = state.stores.filter((s) => s.isOpen);
  els.placeStoreSelect.innerHTML = `<option value="">-- Chọn cửa hàng --</option>` +
    opened.map((s) => `<option value="${s.id}">${s.name} – ${s.address}</option>`).join("");
}

els.placeStoreSelect.addEventListener("change", async () => {
  const storeId = els.placeStoreSelect.value;
  state.selectedStoreId = storeId;
  state.cart = {};
  if (!storeId) {
    els.placeProductsSection.classList.add("hidden");
    return;
  }
  try {
    const r = await api(`/products?storeId=${storeId}&isAvailable=true&limit=50`, {}, false);
    state.products = r.data;
    renderPlaceProducts();
    els.placeProductsSection.classList.remove("hidden");
    renderCart();
  } catch (e) { alert(e.message); }
});

function renderPlaceProducts() {
  els.placeProductsGrid.innerHTML = state.products.map((p) => `
    <div class="product-card">
      ${p.imageUrl
        ? `<img class="product-card-img" src="${p.imageUrl}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ""
      }
      <div class="product-card-img-placeholder" style="${p.imageUrl ? "display:none" : ""}">🍽️</div>
      <div class="product-card-body">
        <div class="product-card-name">${p.name}</div>
        <div class="product-card-price">${fmtVND(p.price)}</div>
      </div>
      <div class="product-card-actions">
        <div id="cart-ctrl-${p.id}">
          <button class="add-to-cart-btn" data-add="${p.id}">+ Thêm vào giỏ</button>
        </div>
      </div>
    </div>
  `).join("");

  els.placeProductsGrid.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(btn.dataset.add));
  });
}

function addToCart(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  if (!state.cart[productId]) state.cart[productId] = { product, qty: 0 };
  state.cart[productId].qty += 1;
  renderCart();
  updateQtyControl(productId);
}

function removeFromCart(productId) {
  if (!state.cart[productId]) return;
  state.cart[productId].qty -= 1;
  if (state.cart[productId].qty <= 0) delete state.cart[productId];
  renderCart();
  updateQtyControl(productId);
}

function updateQtyControl(productId) {
  const ctrl = $(`cart-ctrl-${productId}`);
  if (!ctrl) return;
  const entry = state.cart[productId];
  if (!entry || entry.qty === 0) {
    ctrl.innerHTML = `<button class="add-to-cart-btn" data-add="${productId}">+ Thêm vào giỏ</button>`;
    ctrl.querySelector("[data-add]").addEventListener("click", () => addToCart(productId));
  } else {
    ctrl.innerHTML = `
      <div class="product-qty-control">
        <button data-remove="${productId}">−</button>
        <span>${entry.qty}</span>
        <button data-admore="${productId}">+</button>
      </div>
    `;
    ctrl.querySelector("[data-remove]").addEventListener("click", () => removeFromCart(productId));
    ctrl.querySelector("[data-admore]").addEventListener("click", () => addToCart(productId));
  }
}

function renderCart() {
  const items = Object.values(state.cart);
  if (!items.length) {
    els.cartPanel.style.display = "none";
    els.checkoutNext.classList.add("hidden");
    return;
  }

  let subtotal = 0;
  let maxFee   = 0;
  els.cartItems.innerHTML = items.map((entry) => {
    const lineTotal = entry.product.price * entry.qty;
    subtotal += lineTotal;
    if (entry.product.deliveryFee > maxFee) maxFee = entry.product.deliveryFee;
    return `
      <div class="cart-item">
        <span>${entry.product.name} × ${entry.qty}</span>
        <span>${fmtVND(lineTotal)}</span>
      </div>
    `;
  }).join("");

  els.cartTotalText.textContent   = fmtVND(subtotal);
  els.cartFeeText.textContent     = fmtVND(maxFee);
  els.cartGrandTotal.textContent  = fmtVND(subtotal + maxFee + 3000);
  els.cartPanel.style.display     = "block";
  els.checkoutNext.classList.remove("hidden");
}

els.checkoutNext.addEventListener("click", () => {
  els.placeStep2.style.display  = "block";
  els.checkoutNext.classList.add("hidden");
  els.placeStep2.scrollIntoView({ behavior: "smooth", block: "start" });
});

els.backToStep1.addEventListener("click", () => {
  els.placeStep2.style.display = "none";
  els.checkoutNext.classList.remove("hidden");
});

/* Payment method toggle */
document.addEventListener("change", (e) => {
  if (e.target.name === "paymentMethod") {
    const isQr = e.target.value === "SEPAY_QR";
    $("pm-qr-label").classList.toggle("active", isQr);
    $("pm-cod-label").classList.toggle("active", !isQr);
  }
});

/* Place order */
els.checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.placeOrderBtn.disabled = true;

  const fd = new FormData(els.checkoutForm);
  const paymentMethod = String(fd.get("paymentMethod") || "SEPAY_QR");

  const deliveryAddress = {
    receiverName: state.profile?.name || "Khách hàng",
    phone:        state.profile?.phone || "0000000000",
    street:       String(fd.get("street") || ""),
    ward:         "Phường 1",
    district:     String(fd.get("district") || ""),
    city:         String(fd.get("city") || "Hồ Chí Minh"),
  };

  /* Step 1: Sync cart to DB then place order */
  const cartItems = Object.values(state.cart);

  const body = {
    paymentMethod,
    deliveryAddress,
    note: String(fd.get("note") || "") || undefined,
    autoConfirmPayment: false, /* keep false so QR is returned */
  };

  try {
    /* Clear DB cart then add each item */
    await api("/cart", { method: "DELETE" });
    for (const entry of cartItems) {
      await api("/cart/items", { method: "POST", body: JSON.stringify({ productId: entry.product.id, quantity: entry.qty }) });
    }

    const r = await api("/orders", { method: "POST", body: JSON.stringify(body) });
    const order = r.data;
    state.currentOrderId = order.id;

    els.placeStep2.style.display = "none";
    els.placeStep3.style.display = "block";

    if (paymentMethod === "SEPAY_QR") {
      /* Need to fetch payment info */
      const paymentData = order.payment;
      els.step3Title.textContent      = "📱 Quét QR để thanh toán";
      els.paymentQrSection.classList.remove("hidden");
      els.paymentCodSection.classList.add("hidden");
      els.orderAmountDisplay.textContent = fmtVND(order.total);
      els.orderRefCode.textContent       = paymentData?.sepayReferenceCode || "–";

      if (paymentData?.sepayQrContent) {
        els.orderQrCode.innerHTML = "";
        new QRCode(els.orderQrCode, {
          text: paymentData.sepayQrContent,
          width: 220, height: 220,
          colorDark: "#0a3520", colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M,
        });
      }
    } else {
      els.step3Title.textContent = "✅ Đặt hàng COD thành công!";
      els.paymentQrSection.classList.add("hidden");
      els.paymentCodSection.classList.remove("hidden");
      els.codAmount.textContent = fmtVND(order.total);
    }

    /* Reset cart */
    state.cart = {};
    els.placeProductsSection.classList.add("hidden");
    els.placeStoreSelect.value = "";
    await loadOrders();
  } catch (err) {
    alert(`Đặt hàng thất bại: ${err.message}`);
  } finally {
    els.placeOrderBtn.disabled = false;
  }
});

els.checkPaymentBtn.addEventListener("click", async () => {
  if (!state.currentOrderId) return;
  try {
    const r = await api(`/orders/${state.currentOrderId}`);
    const o = r.data;
    if (o.paymentStatus === "SUCCEEDED") {
      showToast("✅ Thanh toán thành công!");
      els.paymentQrSection.classList.add("hidden");
      els.step3Title.textContent = "✅ Thanh toán thành công!";
      await loadOrders();
    } else {
      showToast("⏳ Chưa nhận được thanh toán. Vui lòng thử lại.");
    }
  } catch (e) { alert(e.message); }
});

els.goToOrders.addEventListener("click", () => {
  els.placeStep3.style.display = "none";
  setMainTab("orders");
});

function showToast(msg) {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
    background: "#0a3520", color: "#fff", borderRadius: "12px", padding: "12px 24px",
    fontWeight: "700", zIndex: "999", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* ──────────────── BOOT ──────────────── */
async function bootApp() {
  els.authScreen.classList.add("hidden");
  els.appScreen.classList.remove("hidden");
  await loadProfile();
  await loadOrders();
}

async function loadProfile() {
  try {
    const r = await api("/auth/me");
    state.profile = r;
    els.customerName.textContent  = r.name || r.email;
    els.customerEmail.textContent = r.email;
  } catch (e) { console.error(e); }
}

els.refreshBtn.addEventListener("click", async () => {
  await Promise.all([loadOrders(), loadStores()]);
  showToast("🔄 Đã làm mới!");
});

/* Login */
els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.authError.textContent = "";
  els.loginBtn.disabled = true;
  const fd = new FormData(els.loginForm);
  try {
    const r = await api("/auth/login", { method: "POST", body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }) }, false);
    if (r.user.role !== "CUSTOMER") throw new Error("Tài khoản này không phải khách hàng");
    state.tokens = r.tokens; state.user = r.user; saveSession();
    await bootApp();
  } catch (err) { els.authError.textContent = err.message; }
  finally { els.loginBtn.disabled = false; }
});

/* Register */
els.registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.authError.textContent = "";
  els.registerBtn.disabled = true;
  const fd = new FormData(els.registerForm);
  try {
    const r = await api("/auth/register/customer", {
      method: "POST",
      body: JSON.stringify({
        name: String(fd.get("name")||"").trim(),
        email: String(fd.get("email")||"").trim(),
        password: String(fd.get("password")||""),
        phone: String(fd.get("phone")||"").trim() || undefined,
      }),
    }, false);
    state.tokens = r.tokens; state.user = r.user; saveSession();
    await bootApp();
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
if (state.tokens?.accessToken && state.user?.role === "CUSTOMER") {
  bootApp().catch((err) => { console.error(err); clearSession(); window.location.reload(); });
}
