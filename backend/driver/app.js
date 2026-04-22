/* ─── ZaUI Food Driver App ─── */
const API_BASE    = "/api/v1";
const SESSION_KEY = "zaui_food_driver_session";

const state = {
  tokens:    null,
  user:      null,
  profile:   null,
  wallets:   null,
  available: [],
  mine:      [],
  txns:      [],
  topups:    [],
  pendingTopupRef: null,
  pendingQrContent: null,
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
  driverNameHeader:  $("driver-name-header"),
  driverEmailHeader: $("driver-email-header"),
  vehicleType:       $("vehicle-type"),
  licensePlate:      $("license-plate"),
  driverPhone:       $("driver-phone"),
  toggleOnlineBtn:   $("toggle-online-btn"),
  logoutBtn:         $("logout-btn"),
  mainTabs:          Array.from(document.querySelectorAll(".main-tab")),
  mainSections:      Array.from(document.querySelectorAll("[data-main-section]")),

  /* Orders */
  refreshAvailable:    $("refresh-available"),
  refreshMine:         $("refresh-mine"),
  availableOrdersList: $("available-orders-list"),
  myOrdersList:        $("my-orders-list"),

  /* Wallet */
  refreshWallet:      $("refresh-wallet"),
  creditBalance:      $("credit-balance"),
  creditHold:         $("credit-hold"),
  cashBalance:        $("cash-balance"),

  openTopup:          $("open-topup"),
  topupPanel:         $("topup-panel"),
  cancelTopup:        $("cancel-topup"),
  topupForm:          $("topup-form"),
  topupQrSection:     $("topup-qr-section"),
  topupQrCode:        $("topup-qr-code"),
  topupAmountDisplay: $("topup-amount-display"),
  topupRefCode:       $("topup-ref-code"),
  confirmTopupDemo:   $("confirm-topup-demo"),

  openWithdraw:       $("open-withdraw"),
  withdrawPanel:      $("withdraw-panel"),
  cancelWithdraw:     $("cancel-withdraw"),
  withdrawForm:       $("withdraw-form"),

  walletTxnBody:      $("walletTxnBody"),
  topupHistoryBody:   $("topupHistoryBody"),
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

/* ─── Status/label helpers ─── */
function statusLabel(s) {
  const m = { PENDING:"Chờ xác nhận", CONFIRMED:"Đã xác nhận", PREPARING:"Đang chuẩn bị", PICKED_UP:"Đang giao", DELIVERED:"Đã giao", CANCELLED:"Đã huỷ" };
  return m[s] || s;
}
function txnTypeLabel(t) {
  const m = {
    ORDER_DRIVER_SETTLEMENT:"Thu nhập giao hàng", COD_HOLD:"Giữ cọc COD", COD_HOLD_RELEASE:"Hoàn cọc COD",
    TOPUP_SEPAY:"Nạp tiền SePay", WITHDRAW_COMPLETED:"Rút tiền", DRIVER_APP_FEE:"Phí ứng dụng",
  };
  return m[t] || t;
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
  if (tab === "available") loadOrders();
  if (tab === "myorders")  loadOrders();
  if (tab === "wallet")    loadWallet();
}
els.mainTabs.forEach((b) => b.addEventListener("click", () => setMainTab(b.dataset.mainTab)));

/* ────────────────── PROFILE ────────────────── */
async function loadProfile() {
  const r = await api("/drivers/me");
  state.profile = r.data;
  renderProfile();
}
function renderProfile() {
  if (!state.profile) return;
  const p = state.profile;
  els.driverNameHeader.textContent  = p.user.name;
  els.driverEmailHeader.textContent = p.user.email;
  els.vehicleType.textContent       = p.vehicleType;
  els.licensePlate.textContent      = p.licensePlate;
  els.driverPhone.textContent       = p.user.phone || "–";

  if (p.isOnline) {
    els.toggleOnlineBtn.textContent = "🟢 Online";
    els.toggleOnlineBtn.className   = "online-toggle online";
  } else {
    els.toggleOnlineBtn.textContent = "⚫ Offline";
    els.toggleOnlineBtn.className   = "online-toggle offline";
  }
}

els.toggleOnlineBtn.addEventListener("click", async () => {
  if (!state.profile) return;
  try {
    await api("/drivers/availability", { method: "PATCH", body: JSON.stringify({ isOnline: !state.profile.isOnline }) });
    await loadProfile();
  } catch (e) { alert(e.message); }
});

/* ────────────────── ORDERS ────────────────── */
async function loadOrders() {
  try {
    const [avail, mine] = await Promise.all([api("/drivers/orders/available"), api("/drivers/orders/mine")]);
    state.available = avail.data;
    state.mine      = mine.data;
    renderAvailableOrders();
    renderMyOrders();
  } catch (e) { console.error(e); }
}

function renderAvailableOrders() {
  if (!state.available.length) {
    els.availableOrdersList.innerHTML = `<div class="empty-state"><div class="emoji">📭</div><p>Chưa có đơn nào<br><small>Bật Online để nhận đơn</small></p></div>`;
    return;
  }
  els.availableOrdersList.innerHTML = state.available.map((o) => `
    <div class="order-card">
      <div class="order-card-icon available">🛵</div>
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
          &nbsp; 📍 ${o.store?.address || ""}
        </div>
        <div class="order-items">${(o.items||[]).slice(0,3).map((i) => `${i.productName} x${i.quantity}`).join(" · ")}</div>
        <div class="order-card-actions">
          <button class="btn-primary btn-sm" data-claim="${o.id}">✅ Nhận đơn</button>
        </div>
      </div>
    </div>
  `).join("");

  els.availableOrdersList.querySelectorAll("[data-claim]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`/drivers/orders/${btn.dataset.claim}/claim`, { method: "POST" });
        await loadOrders();
      } catch (e) { alert(e.message); }
    });
  });
}

function renderMyOrders() {
  if (!state.mine.length) {
    els.myOrdersList.innerHTML = `<div class="empty-state"><div class="emoji">📦</div><p>Bạn chưa có đơn nào</p></div>`;
    return;
  }
  els.myOrdersList.innerHTML = state.mine.map((o) => {
    const actions = [];
    /* Backend: claim → PICKED_UP directly, complete → DELIVERED */
    if (o.status === "PICKED_UP") {
      actions.push(`<button class="btn-primary btn-sm" data-complete="${o.id}">✅ Xác nhận đã giao</button>`);
    }
    return `
      <div class="order-card">
        <div class="order-card-icon mine">📦</div>
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
            ${o.driverPayout ? ` &nbsp; 🏆 Thu về: <strong>${fmtVND(o.driverPayout)}</strong>` : ""}
          </div>
          <div class="order-items">${(o.items||[]).slice(0,3).map((i) => `${i.productName} x${i.quantity}`).join(" · ")}</div>
          ${actions.length ? `<div class="order-card-actions">${actions.join("")}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  els.myOrdersList.querySelectorAll("[data-complete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try { await api(`/drivers/orders/${btn.dataset.complete}/complete`, { method: "POST" }); await loadOrders(); }
      catch (e) { alert(e.message); }
    });
  });
}

els.refreshAvailable.addEventListener("click", loadOrders);
els.refreshMine.addEventListener("click", loadOrders);

/* ────────────────── WALLET ────────────────── */
async function loadWallet() {
  try {
    const [walletResp, txnResp, topupResp] = await Promise.all([
      api("/wallets/me"),
      api("/wallets/transactions?limit=50"),
      api("/wallets/topups"),
    ]);
    state.wallets = walletResp.data.wallets;
    state.txns    = txnResp.data;
    state.topups  = topupResp.data;
    renderWallets();
    renderWalletTxns();
    renderTopupHistory();
  } catch (e) { console.error(e); }
}

function renderWallets() {
  if (!state.wallets) return;
  const cred = state.wallets.credit;
  const cash = state.wallets.cash;
  els.creditBalance.textContent = fmtVND(cred?.availableBalance);
  els.creditHold.textContent    = fmtVND(cred?.holdBalance);
  els.cashBalance.textContent   = fmtVND(cash?.availableBalance);
}

function renderWalletTxns() {
  if (!state.txns.length) {
    els.walletTxnBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;">Chưa có giao dịch</td></tr>';
    return;
  }
  const wallets = state.wallets;
  els.walletTxnBody.innerHTML = state.txns.map((t) => {
    let walletName = "–";
    if (wallets?.credit?.id === t.walletId) walletName = "Credit";
    else if (wallets?.cash?.id === t.walletId) walletName = "Cash";
    return `
      <tr>
        <td><span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${walletName==="Credit"?"#fef3c7":"#dff8ea"};color:${walletName==="Credit"?"#92400e":"#166534"};font-weight:700">${walletName}</span></td>
        <td style="font-size:12px;">${txnTypeLabel(t.type)}</td>
        <td style="font-weight:700;color:${t.direction==="CREDIT"?"#006e2f":"#b91c1c"}">${t.direction==="CREDIT"?"+":"−"}</td>
        <td style="font-weight:700;color:${t.direction==="CREDIT"?"#006e2f":"#b91c1c"}">${fmtVND(t.amount)}</td>
        <td>${fmtVND(t.availableAfter)}</td>
        <td style="font-size:12px;color:#6b7f72;">${fmtDate(t.createdAt)}</td>
      </tr>
    `;
  }).join("");
}

function renderTopupHistory() {
  if (!state.topups.length) {
    els.topupHistoryBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;">Chưa có lần nạp nào</td></tr>';
    return;
  }
  els.topupHistoryBody.innerHTML = state.topups.map((t) => `
    <tr>
      <td><code style="font-size:12px;">${t.referenceCode}</code></td>
      <td>${fmtVND(t.amount)}</td>
      <td><span class="status-badge ts-${t.status}">${t.status}</span></td>
      <td style="font-size:12px;color:#6b7f72;">${fmtDate(t.createdAt)}</td>
    </tr>
  `).join("");
}

els.refreshWallet.addEventListener("click", loadWallet);

/* Topup */
els.openTopup.addEventListener("click", () => {
  els.topupPanel.style.display = "block";
  els.topupQrSection.classList.add("hidden");
  els.topupPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});
els.cancelTopup.addEventListener("click", () => {
  els.topupPanel.style.display = "none";
  els.topupQrSection.classList.add("hidden");
  els.topupForm.reset();
  state.pendingTopupRef = null;
});

els.topupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(els.topupForm);
  const amount = Number(fd.get("amount"));
  try {
    const r = await api("/wallets/topups/sepay", { method: "POST", body: JSON.stringify({ amount }) });
    const topup = r.data;
    state.pendingTopupRef  = topup.referenceCode;
    state.pendingQrContent = topup.qrContent;

    els.topupAmountDisplay.textContent = fmtVND(topup.amount);
    els.topupRefCode.textContent       = topup.referenceCode;

    /* Render QR */
    els.topupQrCode.innerHTML = "";
    new QRCode(els.topupQrCode, {
      text: topup.qrContent,
      width: 200,
      height: 200,
      colorDark: "#0a3520",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });

    els.topupQrSection.classList.remove("hidden");
    await loadTopupHistory();
  } catch (err) { alert(`Tạo QR thất bại: ${err.message}`); }
});

async function loadTopupHistory() {
  const r = await api("/wallets/topups");
  state.topups = r.data;
  renderTopupHistory();
}

els.confirmTopupDemo.addEventListener("click", async () => {
  if (!state.pendingTopupRef) return;
  try {
    await api(`/wallets/topups/sepay/${state.pendingTopupRef}/confirm`, { method: "POST", body: JSON.stringify({}) });
    await loadWallet();
    els.topupPanel.style.display = "none";
    els.topupQrSection.classList.add("hidden");
    els.topupForm.reset();
    showToast("✅ Nạp tiền thành công!");
  } catch (err) { alert(`Xác nhận thất bại: ${err.message}`); }
});

/* Withdraw */
els.openWithdraw.addEventListener("click", () => {
  els.withdrawPanel.style.display = "block";
  els.withdrawPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});
els.cancelWithdraw.addEventListener("click", () => {
  els.withdrawPanel.style.display = "none";
  els.withdrawForm.reset();
});

els.withdrawForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(els.withdrawForm);
  const body = {
    amount:            Number(fd.get("amount")),
    bankCode:          String(fd.get("bankCode")),
    bankAccountNumber: String(fd.get("bankAccountNumber")),
    bankAccountName:   String(fd.get("bankAccountName")),
  };
  try {
    await api("/wallets/payouts", { method: "POST", body: JSON.stringify(body) });
    els.withdrawForm.reset();
    els.withdrawPanel.style.display = "none";
    await loadWallet();
    showToast("✅ Yêu cầu rút tiền đã được ghi nhận!");
  } catch (err) { alert(`Rút tiền thất bại: ${err.message}`); }
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

/* ────────────────── BOOT ────────────────── */
async function bootApp() {
  els.authScreen.classList.add("hidden");
  els.appScreen.classList.remove("hidden");
  await Promise.all([loadProfile(), loadOrders()]);
}

/* Login */
els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.authError.textContent = "";
  els.loginBtn.disabled = true;
  const fd = new FormData(els.loginForm);
  try {
    const r = await api("/auth/login", { method: "POST", body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }) }, false);
    if (r.user.role !== "DRIVER") throw new Error("Tài khoản này không phải tài xế");
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
    const r = await api("/auth/register/driver", {
      method: "POST",
      body: JSON.stringify({
        name: String(fd.get("name")||"").trim(),
        email: String(fd.get("email")||"").trim(),
        password: String(fd.get("password")||""),
        phone: String(fd.get("phone")||"").trim() || undefined,
        vehicleType: String(fd.get("vehicleType")||"").trim(),
        licensePlate: String(fd.get("licensePlate")||"").trim(),
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
if (state.tokens?.accessToken && state.user?.role === "DRIVER") {
  bootApp().catch((err) => { console.error(err); clearSession(); window.location.reload(); });
}
