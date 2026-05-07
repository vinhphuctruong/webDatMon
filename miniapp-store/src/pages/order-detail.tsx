import React, { useEffect, useState } from "react";
import { Page, Box, Text, useSnackbar } from "zmp-ui";
import { useParams, useNavigate } from "react-router";
import { fetchStoreOrders, confirmStoreOrder, markStoreOrderReady, cancelOrder } from "services/api";
import { formatCurrency } from "utils/formatter";
import { VietMapView, MapMarker } from "components/vietmap";
import { THU_DAU_MOT_CENTER, normalizeStoredCoordinates } from "utils/location";
import { formatStoreOrderCode } from "utils/order-code";

const OrderDetailPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const loadOrder = async () => {
    try {
      // Temporary workaround since we don't have getOrderById for store manager yet
      // Fetch all active orders and find it
      const response = await fetchStoreOrders({ limit: 100 });
      const found = response.data.find((o: any) => o.id === id);
      if (found) {
        setOrder(found);
      } else {
        openSnackbar({ text: "Không tìm thấy đơn hàng", type: "error" });
        navigate("/orders");
      }
    } catch (error: any) {
      openSnackbar({ text: error.message || "Lỗi tải đơn hàng", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [id]);

  const handleAction = async (action: "CONFIRM" | "READY" | "REJECT") => {
    if (!order) return;
    try {
      if (action === "CONFIRM") {
        await confirmStoreOrder(order.id);
        openSnackbar({ text: "Đã nhận đơn", type: "success" });
      } else if (action === "REJECT") {
        await cancelOrder(order.id, "Quán từ chối đơn");
        openSnackbar({ text: "Đã từ chối đơn", type: "success" });
        navigate("/orders");
        return;
      } else {
        await markStoreOrderReady(order.id);
        openSnackbar({ text: "Đã báo sẵn sàng", type: "success" });
      }
      loadOrder(); // Reload
    } catch (error: any) {
      openSnackbar({ text: error.message || "Có lỗi xảy ra", type: "error" });
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

  if (!order) return null;
  const orderCode = formatStoreOrderCode(order);

  const toFiniteNumber = (value: unknown): number | null => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizedStoreCoordinates = normalizeStoredCoordinates(
    order.store?.latitude,
    order.store?.longitude,
  );
  const normalizedDeliveryCoordinates = normalizeStoredCoordinates(
    order.deliveryAddress?.latitude,
    order.deliveryAddress?.longitude,
  );
  const deliveryLat = normalizedDeliveryCoordinates?.lat ?? toFiniteNumber(order.deliveryAddress?.latitude);
  const deliveryLng = normalizedDeliveryCoordinates?.lng ?? toFiniteNumber(order.deliveryAddress?.longitude);

  const mapMarkers: MapMarker[] = [];
  if (normalizedStoreCoordinates) {
    mapMarkers.push({
      id: "store",
      lat: normalizedStoreCoordinates.lat,
      lng: normalizedStoreCoordinates.lng,
      type: "store",
      label: order.store?.name || "Cua hang",
    });
  }
  if (deliveryLat !== null && deliveryLng !== null) {
    mapMarkers.push({
      id: "customer",
      lat: deliveryLat,
      lng: deliveryLng,
      type: "customer",
      label: order.deliveryAddress?.receiverName || "Khach hang",
    });
  }

  const showRoute = mapMarkers.some((marker) => marker.type === "store")
    && mapMarkers.some((marker) => marker.type === "customer");
  const mapCenter: [number, number] =
    mapMarkers.length > 0
      ? [mapMarkers[0].lng, mapMarkers[0].lat]
      : [THU_DAU_MOT_CENTER.lng, THU_DAU_MOT_CENTER.lat];

  return (
    <Page className="page-with-bg pb-20">
      <Box className="tm-page-topbar tm-page-safe-top" style={{ justifyContent: "flex-start", gap: 12 }}>
        <div className="tm-link-back" onClick={() => navigate(-1)}>
          ← Quay lại
        </div>
        <div className="tm-page-topbar-title">
          <Text.Title style={{ marginBottom: 0 }}>Chi tiết đơn hàng</Text.Title>
        </div>
      </Box>

      <Box p={4} className="tm-content-pad">
        <div className="tm-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--tm-border)", paddingBottom: 12, marginBottom: 12 }}>
            <Text.Title style={{ fontSize: 18 }}>Đơn #{orderCode}</Text.Title>
            <div style={{ background: "rgba(0,169,109,0.1)", color: "var(--tm-primary)", padding: "4px 8px", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
              {order.status}
            </div>
          </div>

          <Text style={{ fontWeight: 600, marginBottom: 8 }}>Danh sách món:</Text>
          <div style={{ display: "grid", gap: 12 }}>
            {order.items.map((item: any) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 600 }}>{item.quantity}x {item.productName}</Text>
                  {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                    <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
                      Tùy chọn: {Object.values(item.selectedOptions).join(", ")}
                    </Text>
                  )}
                </div>
                <Text style={{ fontWeight: 600 }}>{formatCurrency(item.lineTotal)}</Text>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px dashed var(--tm-border)", paddingTop: 12, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "var(--tm-text-secondary)" }}>Khách trả</Text>
              <Text.Title style={{ fontSize: 18, color: "var(--tm-primary)" }}>{formatCurrency(order.total)}</Text.Title>
            </div>
            {order.note && (
              <div style={{ background: "#fef3c7", padding: 8, borderRadius: 8, marginTop: 8 }}>
                <Text size="small" style={{ color: "#d97706", fontWeight: 600 }}>Ghi chú: {order.note}</Text>
              </div>
            )}
          </div>
        </div>

        <div className="tm-card" style={{ padding: 16, marginTop: 16 }}>
          <Text.Title style={{ fontSize: 16, marginBottom: 12 }}>Bản đồ giao hàng</Text.Title>
          {mapMarkers.length === 0 ? (
            <Text size="small" style={{ color: "var(--tm-text-secondary)" }}>
              Chưa có tọa độ hợp lệ cho cửa hàng hoặc địa chỉ giao hàng.
            </Text>
          ) : (
            <VietMapView
              center={mapCenter}
              zoom={14}
              height={180}
              showRoute={showRoute}
              markers={mapMarkers}
              style={{ borderRadius: 12, border: "1px solid var(--tm-border)" }}
            />
          )}
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {order.status === "PENDING" && (
            <button 
              onClick={() => handleAction("CONFIRM")}
              style={{ padding: "14px", borderRadius: 12, background: "var(--tm-primary)", color: "#fff", fontWeight: 700, border: "none", fontSize: 16 }}
            >
              Nhận đơn ngay
            </button>
          )}
          {order.status === "CONFIRMED" && (
            <button 
              onClick={() => handleAction("READY")}
              style={{ padding: "14px", borderRadius: 12, background: "var(--tm-primary)", color: "#fff", fontWeight: 700, border: "none", fontSize: 16 }}
            >
              Báo món đã xong
            </button>
          )}
          {order.status === "PENDING" && (
            <button 
              onClick={() => handleAction("REJECT")}
              style={{ padding: "14px", borderRadius: 12, background: "#fee2e2", color: "#ef4444", fontWeight: 700, border: "none", fontSize: 16 }}
            >
              Từ chối đơn
            </button>
          )}
        </div>
      </Box>
    </Page>
  );
};

export default OrderDetailPage;
