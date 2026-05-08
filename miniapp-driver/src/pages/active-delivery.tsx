import React, { FC, useCallback, useEffect, useMemo, useState } from "react";
import { Box, Modal, Page, Text, useSnackbar } from "zmp-ui";
import { fetchMyOrders, completeOrder, pickupOrder, reportFailedDelivery } from "services/driver-api";
import { DisplayPrice } from "components/display/price";
import { VietMapView, MapMarker } from "components/vietmap";
import {
  THU_DAU_MOT_CENTER,
  calculateDistance,
  calculateETA,
  displayDistance,
  normalizeStoredCoordinates,
} from "utils/location";
import { getLocation } from "zmp-sdk";
import { formatStoreOrderCode } from "utils/order-code";

const DeliveryRouteMap: FC<{ order: any }> = ({ order }) => {
  const normalizedStoreCoordinates = normalizeStoredCoordinates(
    order.store?.latitude,
    order.store?.longitude,
  );
  const normalizedCustomerCoordinates = normalizeStoredCoordinates(
    order.deliveryAddress?.latitude,
    order.deliveryAddress?.longitude,
  );
  const storeLat = normalizedStoreCoordinates?.lat ?? THU_DAU_MOT_CENTER.lat;
  const storeLng = normalizedStoreCoordinates?.lng ?? THU_DAU_MOT_CENTER.lng;
  const customerLat = normalizedCustomerCoordinates?.lat ?? THU_DAU_MOT_CENTER.lat - 0.01;
  const customerLng = normalizedCustomerCoordinates?.lng ?? THU_DAU_MOT_CENTER.lng + 0.01;

  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const pos = await getLocation({});
        if (pos && pos.latitude && pos.longitude) {
          setDriverLat(parseFloat(pos.latitude as string));
          setDriverLng(parseFloat(pos.longitude as string));
        }
      } catch (error) {
        console.error("Failed to get driver location", error);
      }
    };

    fetchLocation();
    const interval = setInterval(fetchLocation, 10000);
    return () => clearInterval(interval);
  }, []);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [
      { lat: storeLat, lng: storeLng, label: order.store?.name || "Quán", type: "store" },
      {
        lat: customerLat,
        lng: customerLng,
        label: order.deliveryAddress?.receiverName || "Khách",
        type: "customer",
      },
    ];

    if (driverLat && driverLng) {
      list.push({ lat: driverLat, lng: driverLng, label: "Bạn", type: "driver" });
    }

    return list;
  }, [storeLat, storeLng, customerLat, customerLng, order.store?.name, order.deliveryAddress?.receiverName, driverLat, driverLng]);

  const center = useMemo<[number, number]>(() => {
    if (driverLat && driverLng) return [driverLng, driverLat];
    return [(storeLng + customerLng) / 2, (storeLat + customerLat) / 2];
  }, [storeLng, customerLng, storeLat, customerLat, driverLat, driverLng]);

  // Only navigate to customer when driver has actually picked up food
  const isPickedUp = order.status === "PICKED_UP";
  const targetLat = isPickedUp ? customerLat : storeLat;
  const targetLng = isPickedUp ? customerLng : storeLng;

  const distance =
    driverLat && driverLng
      ? calculateDistance(driverLat, driverLng, targetLat, targetLng)
      : calculateDistance(storeLat, storeLng, customerLat, customerLng);

  const eta = calculateETA(distance);

  const googleMapsUrl = driverLat && driverLng
    ? `https://www.google.com/maps/dir/?api=1&origin=${driverLat},${driverLng}&destination=${targetLat},${targetLng}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=driving`;

  return (
    <div style={{ marginBottom: 10, position: "relative" }}>
      <VietMapView
        center={center}
        zoom={14}
        markers={markers}
        height={190}
        showRoute={false}
        style={{ borderRadius: 12, border: "1px solid var(--tm-border)" }}
      />

      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 1000,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
          padding: "6px 10px",
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontSize: 10, color: "var(--tm-text-secondary)", fontWeight: 600 }}>
          ETA tới {isPickedUp ? "khách" : "quán"}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--tm-primary)" }}>{eta}</div>
        <div style={{ fontSize: 10, color: "var(--tm-text-tertiary)" }}>{displayDistance(distance)}</div>
      </div>

      <button
        onClick={async () => {
          const url = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=driving`;

          // Try openOutApp first (may open in browser or native app)
          try {
            const { openOutApp } = await import("zmp-sdk/apis");
            await openOutApp({ url });
            return;
          } catch (e1) {
            console.warn("openOutApp failed:", e1);
          }

          // Fallback: openWebview
          try {
            const { openWebview } = await import("zmp-sdk/apis");
            await openWebview({ url, config: { style: "normal" } });
            return;
          } catch (e2) {
            console.warn("openWebview failed:", e2);
          }

          // Last resort
          window.location.href = url;
        }}
        style={{
          width: "100%",
          marginTop: 10,
          background: "#4285F4",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "10px",
          fontWeight: 700,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          fontSize: 14
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        Dẫn đường bằng Google Maps
      </button>

    </div>
  );
};

const statusLabels: Record<string, string> = {
  PICKED_UP: "Đang giao tới khách",
  CONFIRMED: "Đang tới quán lấy hàng",
  PREPARING: "Quán đang chuẩn bị",
  DRIVER_ASSIGNED: "Đang tới quán lấy hàng",
  ASSIGNED: "Đang tới quán lấy hàng",
};

const ActiveDeliveryPage: FC = () => {
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [pickingUp, setPickingUp] = useState<string | null>(null);
  const [failModal, setFailModal] = useState<{ orderId: string; visible: boolean }>({ orderId: "", visible: false });
  const [failReason, setFailReason] = useState("");
  const [failing, setFailing] = useState(false);
  const snackbar = useSnackbar();

  const [error, setError] = useState<any>(null);
  if (error) throw error;

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetchMyOrders();
      const active = (res.data || []).filter((o: any) => ["PICKED_UP", "CONFIRMED", "PREPARING"].includes(o.status));
      setActiveOrders(active);
    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleComplete = async (orderId: string) => {
    setCompleting(orderId);
    try {
      await completeOrder(orderId);
      snackbar.openSnackbar({ type: "success", text: "Giao hàng thành công" });
      loadOrders();
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Không thể hoàn tất đơn" });
    } finally {
      setCompleting(null);
    }
  };

  const handlePickup = async (orderId: string) => {
    setPickingUp(orderId);
    try {
      await pickupOrder(orderId);
      snackbar.openSnackbar({ type: "success", text: "Đã lấy hàng từ quán, bắt đầu giao!" });
      loadOrders();
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Không thể cập nhật trạng thái" });
    } finally {
      setPickingUp(null);
    }
  };

  const handleFailed = async () => {
    setFailing(true);
    try {
      await reportFailedDelivery(failModal.orderId, failReason);
      snackbar.openSnackbar({ type: "success", text: "Đã báo giao thất bại" });
      setFailModal({ orderId: "", visible: false });
      setFailReason("");
      loadOrders();
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Không thể gửi báo cáo" });
    } finally {
      setFailing(false);
    }
  };

  return (
    <Page className="page-with-bg pb-20">
      <Box
        p={4}
        className="tm-content-pad tm-page-safe-top"
        style={{
          background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
          paddingBottom: 42,
        }}
      >
        <Text.Title style={{ color: "#fff", fontSize: 20 }}>Đơn đang giao</Text.Title>
        <Text size="xSmall" style={{ color: "rgba(255,255,255,0.82)", marginTop: 4 }}>
          Theo dõi tiến trình và hoàn tất đơn ngay tại đây
        </Text>
      </Box>

      <Box p={4} className="tm-content-pad" style={{ marginTop: -26 }}>
        {loading ? (
          <Box className="flex items-center justify-center" style={{ padding: 48 }}>
            <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
          </Box>
        ) : activeOrders.length === 0 ? (
          <div className="tm-empty-state tm-card" style={{ padding: "42px 20px" }}>
            <span className="tm-empty-icon">🛵</span>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>Không có đơn đang giao</Text>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
              Vào mục "Đơn chờ" để nhận thêm cuốc mới
            </Text>
          </div>
        ) : (
          activeOrders.map((order) => (
            <div key={order.id} className="tm-order-card animate-slide-up">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                <span
                  style={{
                    background: "var(--tm-primary-light)",
                    color: "var(--tm-primary)",
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {statusLabels[order.status] || order.status}
                </span>
                <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>
                  #{formatStoreOrderCode(order)}
                </Text>
              </div>

              <div style={{ background: "var(--tm-bg)", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <Text style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>🏪 {order.store?.name}</Text>
                <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>{order.store?.address}</Text>
              </div>

              <div style={{ background: "#f8faf8", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <Text style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>📍 Giao tới khách</Text>
                <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                  {order.deliveryAddress?.receiverName} · {order.deliveryAddress?.phone}
                </Text>
                <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                  {order.deliveryAddress?.street}, {order.deliveryAddress?.ward}, {order.deliveryAddress?.district}
                </Text>
              </div>

              <DeliveryRouteMap order={order} />

              <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 8 }}>
                {order.items?.map((i: any) => `${i.productName} x${i.quantity}`).join(", ")}
              </Text>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 12,
                  borderTop: "1px solid var(--tm-border)",
                  gap: 10,
                }}
              >
                <div>
                  <Text style={{ fontWeight: 700, color: "var(--tm-primary)", fontSize: 16 }}>
                    <DisplayPrice>{order.total || 0}</DisplayPrice>
                  </Text>
                  <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>
                    {order.paymentMethod === "COD" ? "Khách trả tiền mặt" : "Khách đã thanh toán online"}
                  </Text>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 8 }}>
                  <button
                    className="tm-interactive"
                    onClick={() => setFailModal({ orderId: order.id, visible: true })}
                    style={{
                      background: "#fff1f2",
                      color: "var(--tm-danger)",
                      border: "2px solid #fecdd3",
                      borderRadius: 14,
                      padding: "12px",
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    Thất bại
                  </button>
                  {order.status === "PICKED_UP" ? (
                    <button
                      className="tm-interactive animate-pulse-soft"
                      onClick={() => handleComplete(order.id)}
                      disabled={completing === order.id}
                      style={{
                        background: "linear-gradient(135deg, #10b981, #047857)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 14,
                        padding: "12px",
                        fontWeight: 800,
                        fontSize: 16,
                        boxShadow: "var(--tm-shadow-floating)",
                        opacity: completing === order.id ? 0.7 : 1,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {completing === order.id ? "Đang xử lý..." : "ĐÃ GIAO"}
                    </button>
                  ) : (
                    <button
                      className="tm-interactive animate-pulse-soft"
                      onClick={() => handlePickup(order.id)}
                      disabled={pickingUp === order.id}
                      style={{
                        background: "linear-gradient(135deg, #f59e0b, #d97706)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 14,
                        padding: "12px",
                        fontWeight: 800,
                        fontSize: 14,
                        boxShadow: "var(--tm-shadow-floating)",
                        opacity: pickingUp === order.id ? 0.7 : 1,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {pickingUp === order.id ? "Đang xử lý..." : "ĐÃ LẤY HÀNG"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </Box>

      <Modal
        visible={failModal.visible}
        title="Báo giao thất bại"
        onClose={() => setFailModal({ orderId: "", visible: false })}
      >
        <Box p={4}>
          <Text style={{ marginBottom: 12 }}>Lý do giao thất bại</Text>
          <textarea
            value={failReason}
            onChange={(event) => setFailReason(event.target.value)}
            placeholder="Ví dụ: Khách không nghe máy, sai địa chỉ..."
            rows={3}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--tm-border)",
              marginBottom: 16,
            }}
          />
          <button
            onClick={handleFailed}
            disabled={failing}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              background: "var(--tm-danger)",
              color: "#fff",
              fontWeight: 700,
              border: "none",
              opacity: failing ? 0.7 : 1,
            }}
          >
            {failing ? "Đang xử lý..." : "Xác nhận"}
          </button>
        </Box>
      </Modal>
    </Page>
  );
};

export default ActiveDeliveryPage;
