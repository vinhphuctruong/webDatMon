import React, { useEffect, useState } from "react";
import { Page, Box, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { fetchManagedStoreDashboard, toggleManagedStoreStatus, fetchMyStoreApplication } from "services/api";
import { DashboardData } from "types/store";
import { formatCurrency } from "utils/formatter";
import { THU_DAU_MOT_CENTER, isWithinServiceArea, normalizeStoredCoordinates } from "utils/location";
import { VietMapView } from "components/vietmap";
import { useSetRecoilState, useRecoilValueLoadable } from "recoil";
import { cartState, remoteStoresState, storesState } from "state";
import { fetchCart } from "services/backend";

const HomePage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  // ── Backend sync — only runs after auth confirmed ──
  const setCart = useSetRecoilState(cartState);
  const setStores = useSetRecoilState(storesState);
  const remoteStores = useRecoilValueLoadable(remoteStoresState);

  const loadData = async () => {
    try {
      const response = await fetchManagedStoreDashboard();
      setData(response.data);

      // Auth succeeded → safe to sync backend data
      fetchCart()
        .then(setCart)
        .catch((err) => console.warn("Sync cart failed", err));
    } catch (error: any) {
      if (error.status === 401 || error.message?.toLowerCase().includes("đăng nhập")) {
        navigate("/welcome", { replace: true });
      } else if (error.status === 403) {
        // Not a STORE_MANAGER. Check if they have a pending application
        try {
          await fetchMyStoreApplication();
          navigate("/application-status", { replace: true });
        } catch {
          navigate("/register", { replace: true }); 
        }
      } else {
        openSnackbar({ text: error.message || "Lỗi tải dữ liệu", type: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  // Sync remote stores into local state (after auth)
  useEffect(() => {
    if (data && remoteStores.state === "hasValue") {
      setStores(remoteStores.contents);
    }
  }, [data, remoteStores.state, remoteStores.contents]);

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async () => {
    if (!data) return;
    try {
      const newStatus = !data.store.isOpen;
      await toggleManagedStoreStatus(newStatus);
      setData({ ...data, store: { ...data.store, isOpen: newStatus } });
      openSnackbar({ text: newStatus ? "Đã MỞ CỬA quán" : "Đã ĐÓNG CỬA quán", type: "success" });
    } catch (error: any) {
      openSnackbar({ text: error.message || "Lỗi cập nhật trạng thái", type: "error" });
    }
  };

  if (loading) {
    return (
      <Page className="page-with-bg">
        <Box className="flex-1 flex items-center justify-center p-4">
          <Text>Đang tải...</Text>
        </Box>
      </Page>
    );
  }

  if (!data) {
    return (
      <Page className="page-with-bg">
        <Box className="flex-1 flex flex-col items-center justify-center p-4">
          <Text>Không thể tải dữ liệu cửa hàng. Vui lòng thử lại.</Text>
        </Box>
      </Page>
    );
  }

  const normalizedStoreCoordinates = normalizeStoredCoordinates(
    data.store.latitude,
    data.store.longitude,
  );
  const hasValidStoreCoordinates =
    normalizedStoreCoordinates !== null &&
    isWithinServiceArea(normalizedStoreCoordinates.lat, normalizedStoreCoordinates.lng);

  const safeStoreLat = hasValidStoreCoordinates
    ? normalizedStoreCoordinates.lat
    : THU_DAU_MOT_CENTER.lat;
  const safeStoreLng = hasValidStoreCoordinates
    ? normalizedStoreCoordinates.lng
    : THU_DAU_MOT_CENTER.lng;

  return (
    <Page className="page-with-bg pb-20">
      <Box
        p={4}
        className="tm-content-pad tm-page-safe-top"
        style={{
          background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
          paddingBottom: 60,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Xin chào, cửa hàng</Text>
            <Text.Title style={{ color: "#fff", fontSize: 20 }}>{data.store.name}</Text.Title>
          </div>
          <div 
            onClick={handleToggleStatus}
            style={{ 
              display: "flex", alignItems: "center", gap: 6, 
              background: "rgba(255,255,255,0.2)", padding: "6px 12px", 
              borderRadius: 20, cursor: "pointer"
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: data.store.isOpen ? "#34d399" : "#f87171" }}></div>
            <Text style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
              {data.store.isOpen ? "ĐANG MỞ" : "ĐÃ ĐÓNG"}
            </Text>
          </div>
        </div>
      </Box>

      <Box p={4} className="tm-content-pad" style={{ marginTop: -40 }}>
        <div className="tm-card" style={{ padding: 16 }}>
          <Text.Title style={{ fontSize: 16, marginBottom: 12 }}>Kết quả kinh doanh hôm nay</Text.Title>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            <div style={{ background: "var(--tm-bg)", padding: 12, borderRadius: 12 }}>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Doanh thu</Text>
              <Text.Title style={{ fontSize: 18, color: "var(--tm-primary)" }}>{formatCurrency(data.summary.todayRevenue)}</Text.Title>
            </div>
            <div style={{ background: "var(--tm-bg)", padding: 12, borderRadius: 12 }}>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Đơn hoàn thành</Text>
              <Text.Title style={{ fontSize: 18 }}>{data.summary.todayOrders}</Text.Title>
            </div>
          </div>
        </div>
      </Box>

      <Box p={4} pt={0} className="tm-content-pad">
        <div className="tm-card" style={{ padding: 16 }}>
          <Text.Title style={{ fontSize: 16, marginBottom: 12 }}>Vị trí cửa hàng</Text.Title>
          {!hasValidStoreCoordinates && (
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 8 }}>
              Chưa xác định được vị trí chính xác của cửa hàng, bản đồ đang hiển thị vị trí mặc định.
            </Text>
          )}
          <VietMapView
            center={[safeStoreLng, safeStoreLat]}
            zoom={15}
            height={160}
            markers={[{ lat: safeStoreLat, lng: safeStoreLng, type: "store", label: "Cửa hàng của bạn" }]}
            style={{ borderRadius: 12, border: "1px solid var(--tm-border)" }}
          />
        </div>
      </Box>

      <Box p={4} pt={0} className="tm-content-pad">
        <div className="tm-card" style={{ padding: 16 }}>
          <Text.Title style={{ fontSize: 16, marginBottom: 12 }}>Tuần này</Text.Title>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--tm-border)" }}>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Doanh thu</Text>
              <Text.Title style={{ fontSize: 16 }}>{formatCurrency(data.summary.weekRevenue)}</Text.Title>
            </div>
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--tm-border)" }}>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Đơn hoàn thành</Text>
              <Text.Title style={{ fontSize: 16 }}>{data.summary.weekOrders}</Text.Title>
            </div>
          </div>
        </div>
      </Box>

      <Box p={4} pt={0} className="tm-content-pad">
        <div className="tm-card" style={{ padding: 16 }}>
          <Text.Title style={{ fontSize: 16, marginBottom: 12 }}>Top sản phẩm (7 ngày)</Text.Title>
          {data.topProducts.length === 0 ? (
            <Text size="small" style={{ color: "var(--tm-text-secondary)" }}>Chưa có dữ liệu</Text>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {data.topProducts.map((p, i) => (
                <div key={p.productId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < data.topProducts.length - 1 ? "1px solid var(--tm-border)" : "none", paddingBottom: i < data.topProducts.length - 1 ? 12 : 0 }}>
                  <div style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 600 }}>{p.productName}</Text>
                    <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Đã bán: {p.quantitySold}</Text>
                  </div>
                  <Text.Title style={{ fontSize: 14 }}>{formatCurrency(p.grossSales)}</Text.Title>
                </div>
              ))}
            </div>
          )}
        </div>
      </Box>
    </Page>
  );
};

export default HomePage;
