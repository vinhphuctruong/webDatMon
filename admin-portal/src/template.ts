export const LOGIN_HTML = `
<div class="login-wrapper" id="login-view">
  <div class="login-card">
    <div class="brand-logo"><div class="dot">TM</div><span>TM Food Admin</span></div>
    <h2>Đăng nhập</h2>
    <p class="subtitle">Trung tâm quản trị hệ thống TM Food</p>
    <form id="login-form">
      <div class="field"><label>Email</label><input id="login-email" type="email" required placeholder="admin@tmfood.local"/></div>
      <div class="field"><label>Mật khẩu</label><input id="login-password" type="password" required placeholder="********"/></div>
      <button class="btn-login" id="login-button" type="submit">Đăng nhập</button>
      <p class="hint">Demo: <code>admin@tmfood.local / 12345678</code></p>
      <p class="error-msg" id="login-error"></p>
    </form>
  </div>
</div>`;

export const APP_HTML = `
<div class="shell hidden" id="app-view">
  <aside class="sidebar">
    <div class="sidebar-brand"><div class="dot">TM</div><span>TM Food</span></div>
    <nav class="sidebar-nav">
      <button class="nav-btn active" data-tab="overview"><span class="icon">📊</span>Tổng quan</button>
      <button class="nav-btn" data-tab="stores"><span class="icon">🏪</span>Cửa hàng</button>
      <button class="nav-btn" data-tab="driver-applications"><span class="icon">🛵</span>Hồ sơ tài xế</button>
      <button class="nav-btn" data-tab="store-applications"><span class="icon">📝</span>Hồ sơ cửa hàng</button>
      <button class="nav-btn" data-tab="vouchers"><span class="icon">🎫</span>Voucher</button>
      <button class="nav-btn" data-tab="categories"><span class="icon">📂</span>Danh mục</button>
      <button class="nav-btn" data-tab="banners"><span class="icon">🖼️</span>Banner</button>
      <button class="nav-btn" data-tab="users"><span class="icon">👥</span>Người dùng</button>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user"><div class="avatar" id="user-avatar">A</div><div class="info"><div class="name" id="current-admin">Admin</div><div class="role">Quản trị viên</div></div></div>
      <button class="btn-logout" id="logout-button">🚪 Đăng xuất</button>
    </div>
  </aside>
  <div class="content-area">

    <!-- OVERVIEW -->
    <section data-section="overview">
      <div class="content-header"><div><h2>Tổng quan</h2><p class="page-desc">Toàn cảnh vận hành hệ thống</p></div><button class="btn btn-secondary" id="refresh-overview">↻ Làm mới</button></div>
      <div class="metrics-row" id="metrics-grid"></div>
      <div class="split-grid">
        <div class="panel"><div class="panel-head"><h3>Trạng thái đơn hàng</h3></div><div class="pills-row" id="order-distribution"></div></div>
        <div class="panel"><div class="panel-head"><h3>Đơn hàng mới nhất</h3></div><div class="panel-body"><table><thead><tr><th>Mã</th><th>Khách</th><th>Quán</th><th>Tổng</th><th>Trạng thái</th><th>Thời gian</th></tr></thead><tbody id="latest-orders-body"></tbody></table></div></div>
      </div>
    </section>

    <!-- STORES -->
    <section data-section="stores" class="hidden">
      <div class="content-header"><div><h2>Quản lý cửa hàng</h2><p class="page-desc">Tạo và quản lý các cửa hàng đối tác</p></div><button class="btn btn-secondary" id="refresh-stores">↻ Làm mới</button></div>
      <div class="panel">
        <div class="panel-head"><h3>Tạo cửa hàng mới</h3></div>
        <form id="create-store-form">
          <div class="form-grid">
            <div class="field"><label>Tên cửa hàng</label><input name="name" required placeholder="TM Food Thủ Đức"/></div>
            <div class="field"><label>Địa chỉ</label><input name="address" required placeholder="123 Xa Lộ Hà Nội"/></div>
            <div class="field"><label>Đánh giá</label><input name="rating" type="number" min="0" max="5" step="0.1" value="4.5"/></div>
            <div class="field"><label>ETA tối thiểu (phút)</label><input name="etaMinutesMin" type="number" min="5" max="120" value="20" required/></div>
            <div class="field"><label>ETA tối đa (phút)</label><input name="etaMinutesMax" type="number" min="5" max="180" value="35" required/></div>
            <div class="field"><label>Vĩ độ</label><input name="latitude" type="number" step="any" placeholder="10.854"/></div>
            <div class="field"><label>Kinh độ</label><input name="longitude" type="number" step="any" placeholder="106.772"/></div>
            <div class="field"><label>Tên quản lý</label><input name="managerName" required placeholder="Nguyễn Văn A"/></div>
            <div class="field"><label>Email quản lý</label><input name="managerEmail" type="email" required placeholder="manager@tmfood.local"/></div>
            <div class="field"><label>Mật khẩu quản lý</label><input name="managerPassword" type="password" minlength="8" required placeholder="Ít nhất 8 ký tự"/></div>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Tạo cửa hàng</button></div>
        </form>
      </div>
      <div class="panel" style="margin-top:20px"><div class="panel-head"><h3>Danh sách cửa hàng</h3></div><div class="panel-body"><table><thead><tr><th>Mã</th><th>Cửa hàng</th><th>Quản lý</th><th>Đánh giá</th><th>ETA</th><th>Trạng thái</th></tr></thead><tbody id="stores-body"></tbody></table></div></div>
    </section>

    <!-- DRIVER APPLICATIONS -->
    <section data-section="driver-applications" class="hidden">
      <div class="content-header"><div><h2>Hồ sơ tài xế</h2><p class="page-desc">Duyệt đối tác tài xế</p></div>
        <div class="panel-head head-actions"><select class="filter-select" id="driver-status-filter"><option value="PENDING">Đang chờ</option><option value="">Tất cả</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option></select><button class="btn btn-secondary" id="refresh-driver-applications">↻ Làm mới</button></div>
      </div>
      <div class="panel"><div class="panel-body"><table><thead><tr><th>Ứng viên</th><th>Xe</th><th>Giấy tờ</th><th>Điểm</th><th>Trạng thái</th></tr></thead><tbody id="driver-applications-body"></tbody></table></div></div>
    </section>

    <!-- STORE APPLICATIONS -->
    <section data-section="store-applications" class="hidden">
      <div class="content-header"><div><h2>Hồ sơ cửa hàng</h2><p class="page-desc">Duyệt đối tác cửa hàng</p></div>
        <div class="panel-head head-actions"><select class="filter-select" id="store-status-filter"><option value="PENDING">Đang chờ</option><option value="">Tất cả</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option></select><button class="btn btn-secondary" id="refresh-store-applications">↻ Làm mới</button></div>
      </div>
      <div class="panel"><div class="panel-body"><table><thead><tr><th>Cửa hàng</th><th>Người nộp</th><th>Giấy tờ</th><th>Tọa độ</th><th>Trạng thái</th></tr></thead><tbody id="store-applications-body"></tbody></table></div></div>
    </section>

    <!-- VOUCHERS -->
    <section data-section="vouchers" class="hidden">
      <div class="content-header"><div><h2>Quản lý Voucher</h2><p class="page-desc">Tạo và quản lý mã giảm giá nền tảng</p></div><button class="btn btn-secondary" id="refresh-vouchers">↻ Làm mới</button></div>
      <div class="panel">
        <div class="panel-head"><h3>Tạo voucher mới</h3></div>
        <form id="create-voucher-form">
          <div class="form-grid">
            <div class="field"><label>Mã voucher</label><input name="code" required placeholder="TMFOOD30" maxlength="30"/></div>
            <div class="field"><label>Mô tả</label><input name="description" required placeholder="Giảm 30K cho đơn từ 99K"/></div>
            <div class="field"><label>Loại giảm</label><select name="discountType"><option value="FIXED">Cố định (VNĐ)</option><option value="PERCENT">Phần trăm (%)</option></select></div>
            <div class="field"><label>Giá trị giảm</label><input name="discountValue" type="number" min="1" required placeholder="30000"/></div>
            <div class="field"><label>Giảm tối đa (% only)</label><input name="maxDiscount" type="number" min="0" placeholder="25000"/></div>
            <div class="field"><label>Đơn tối thiểu</label><input name="minOrderValue" type="number" min="0" value="0" placeholder="99000"/></div>
            <div class="field"><label>Tổng lượt dùng</label><input name="maxUsageTotal" type="number" min="1" placeholder="100"/></div>
            <div class="field"><label>Lượt/người</label><input name="maxUsagePerUser" type="number" min="1" value="1"/></div>
            <div class="field"><label>Hết hạn</label><input name="expiresAt" type="date" required/></div>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Tạo voucher</button></div>
        </form>
      </div>
      <div class="panel" style="margin-top:20px"><div class="panel-head"><h3>Danh sách voucher</h3></div><div class="panel-body"><table><thead><tr><th>Mã</th><th>Mô tả</th><th>Giảm</th><th>Đơn tối thiểu</th><th>Đã dùng</th><th>Hết hạn</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody id="vouchers-body"></tbody></table></div></div>
    </section>

    <!-- CATEGORIES -->
    <section data-section="categories" class="hidden">
      <div class="content-header"><div><h2>Quản lý danh mục</h2><p class="page-desc">Thêm, sửa, xóa danh mục sản phẩm</p></div><button class="btn btn-secondary" id="refresh-categories">↻ Làm mới</button></div>
      <div class="panel">
        <div class="panel-head"><h3>Thêm danh mục</h3></div>
        <form id="create-category-form">
          <div class="form-grid">
            <div class="field"><label>Mã danh mục (key)</label><input name="key" required placeholder="com-pho" maxlength="50"/></div>
            <div class="field"><label>Tên danh mục</label><input name="name" required placeholder="Cơm - Phở" maxlength="100"/></div>
            <div class="field"><label>Icon URL (tùy chọn)</label><input name="iconUrl" placeholder="https://... hoặc emoji" maxlength="500"/></div>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Thêm danh mục</button></div>
        </form>
      </div>
      <div class="panel" style="margin-top:20px"><div class="panel-head"><h3>Danh sách danh mục</h3></div><div class="panel-body"><table><thead><tr><th>Key</th><th>Tên</th><th>Icon</th><th>Hành động</th></tr></thead><tbody id="categories-body"></tbody></table></div></div>
    </section>

    <!-- BANNERS -->
    <section data-section="banners" class="hidden">
      <div class="content-header"><div><h2>Quản lý Hero Banner</h2><p class="page-desc">Thêm, xóa, cập nhật ảnh banner trang chủ</p></div><button class="btn btn-secondary" id="refresh-banners">↻ Làm mới</button></div>
      <div class="panel">
        <div class="panel-head"><h3>Thêm banner mới</h3></div>
        <form id="create-banner-form">
          <div class="form-grid">
            <div class="field"><label>Tiêu đề (tùy chọn)</label><input name="title" placeholder="Khuyến mãi mùa hè" maxlength="200"/></div>
            <div class="field"><label>Link (tùy chọn)</label><input name="link" placeholder="/category?key=deal" maxlength="500"/></div>
            <div class="field"><label>Thứ tự</label><input name="sortOrder" type="number" min="0" value="0"/></div>
            <div class="field" style="grid-column:1/-1">
              <label>Ảnh banner</label>
              <input type="file" name="imageFile" accept="image/*" id="banner-file-input"/>
              <input type="hidden" name="imageUrl" id="banner-image-data"/>
              <div id="banner-preview" style="margin-top:8px"></div>
            </div>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Thêm banner</button></div>
        </form>
      </div>
      <div class="panel" style="margin-top:20px"><div class="panel-head"><h3>Danh sách banner</h3></div><div class="panel-body" id="banners-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;padding:16px"></div></div>
    </section>

    <!-- USERS -->
    <section data-section="users" class="hidden">
      <div class="content-header"><div><h2>Quản lý người dùng</h2><p class="page-desc">Danh sách tài khoản hệ thống</p></div>
        <div class="panel-head head-actions">
          <input type="text" class="filter-select" id="user-search" placeholder="Tìm tên, email, sđt..." style="min-width:180px"/>
          <select class="filter-select" id="user-role-filter"><option value="">Tất cả</option><option value="CUSTOMER">Khách hàng</option><option value="ADMIN">Admin</option><option value="STORE_MANAGER">Quản lý cửa hàng</option><option value="DRIVER">Tài xế</option></select>
          <button class="btn btn-secondary" id="refresh-users">↻ Làm mới</button>
        </div>
      </div>
      <div class="panel"><div class="panel-body"><table><thead><tr><th>Tên</th><th>Email</th><th>SĐT</th><th>Vai trò</th><th>Đơn hàng</th><th>Ngày tạo</th><th>Hành động</th></tr></thead><tbody id="users-body"></tbody></table></div></div>
      <div id="users-pagination" style="display:flex;justify-content:center;gap:8px;padding:16px"></div>
    </section>

  </div>
</div>
<div id="flash" class="flash hidden"></div>`;
