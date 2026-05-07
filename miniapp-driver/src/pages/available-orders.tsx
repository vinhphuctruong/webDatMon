import React, { FC, useCallback, useEffect, useRef, useState } from "react";
import { Box, Modal, Page, Text, useSnackbar } from "zmp-ui";
import { claimOrder, fetchAvailableOrders, syncDriverLocation } from "services/driver-api";
import { DisplayPrice } from "components/display/price";
import { MapMarker, VietMapView } from "components/vietmap";
import { THU_DAU_MOT_CENTER, normalizeStoredCoordinates } from "utils/location";
import { getLocation } from "zmp-sdk";

type ViewMode = "list" | "map";

const AvailableOrdersPage: FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [incomingOrder, setIncomingOrder] = useState<any | null>(null);
  const snackbar = useSnackbar();
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const didInitOrderRef = useRef(false);

  const readAndSyncDriverLocation = useCallback(async () => {
    try {
      const pos = await getLocation({});
      if (!pos?.latitude || !pos?.longitude) {
        return null;
      }

      const latitude = parseFloat(pos.latitude as string);
      const longitude = parseFloat(pos.longitude as string);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      setDriverLat(latitude);
      setDriverLng(longitude);

      try {
        await syncDriverLocation(latitude, longitude);
      } catch (locationSyncError) {
        console.warn("Sync driver location failed", locationSyncError);
      }

      return { latitude, longitude };
    } catch (locationError) {
      console.warn("Get location failed", locationError);
      return null;
    }
  }, []);

  const [error, setError] = useState<any>(null);
  if (error) throw error;

  const loadOrders = useCallback(async () => {
    try {
      const liveLocation = await readAndSyncDriverLocation();
      const res = await fetchAvailableOrders(liveLocation ?? undefined);
      const nextOrders = res.data || [];
      setOrders(nextOrders);

      const nextIds = new Set(nextOrders.map((order) => order.id));
      if (!didInitOrderRef.current) {
        knownOrderIdsRef.current = nextIds;
        didInitOrderRef.current = true;
        return;
      }

      const incoming = nextOrders.filter((order) => !knownOrderIdsRef.current.has(order.id));
      if (incoming.length > 0) {
        const nearestIncoming = incoming
          .slice()
          .sort(
            (a, b) =>
              (a.distanceToStoreKm ?? Number.POSITIVE_INFINITY) -
              (b.distanceToStoreKm ?? Number.POSITIVE_INFINITY),
          )[0];
        setIncomingOrder(nearestIncoming);
      }

      knownOrderIdsRef.current = nextIds;
    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [readAndSyncDriverLocation]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 10000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleClaim = async (orderId: string) => {
    setClaiming(orderId);
    try {
      await claimOrder(orderId);
      snackbar.openSnackbar({ type: "success", text: "Nhận đơn thành công" });
      if (incomingOrder?.id === orderId) {
        setIncomingOrder(null);
      }
      await loadOrders();
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Nhận đơn thất bại" });
    } finally {
      setClaiming(null);
    }
  };

  const mapMarkers = React.useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (driverLat && driverLng) {
      list.push({ id: "driver-self", lat: driverLat, lng: driverLng, label: "Ban", type: "driver" });
    }
    orders.forEach((order) => {
      const normalizedStoreCoordinates = normalizeStoredCoordinates(
        order.store?.latitude,
        order.store?.longitude,
      );
      const lat = normalizedStoreCoordinates?.lat ?? THU_DAU_MOT_CENTER.lat;
      const lng = normalizedStoreCoordinates?.lng ?? THU_DAU_MOT_CENTER.lng;
      list.push({ id: order.id, lat, lng, label: order.store?.name || "Don hang", type: "store" });
    });
    return list;
  }, [orders, driverLat, driverLng]);

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
        <Text.Title style={{ color: "#fff", fontSize: 20 }}>Đơn chờ nhận</Text.Title>
        <Text size="xSmall" style={{ color: "rgba(255,255,255,0.82)", marginTop: 4 }}>
          {orders.length} đơn khả dụng · Cập nhật mỗi 10 giây
        </Text>
      </Box>

      <Box p={4} className="tm-content-pad" style={{ marginTop: -26 }}>
        <div
          className="tm-card"
          style={{
            padding: 4,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
            marginBottom: 12,
          }}
        >
          {(["list", "map"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                border: "none",
                borderRadius: 10,
                padding: "10px 0",
                fontSize: 13,
                fontWeight: 700,
                background: viewMode === mode ? "var(--tm-primary)" : "#fff",
                color: viewMode === mode ? "#fff" : "var(--tm-text-secondary)",
              }}
            >
              {mode === "map" ? "Bản đồ" : "Danh sách"}
            </button>
          ))}
        </div>

        {viewMode === "map" ? (
          <div style={{ position: "relative" }}>
            <VietMapView
              center={
                driverLat && driverLng
                  ? [driverLng, driverLat]
                  : [THU_DAU_MOT_CENTER.lng, THU_DAU_MOT_CENTER.lat]
              }
              zoom={14}
              markers={mapMarkers}
              height={460}
              onMarkerClick={(marker) => {
                if (marker.type === "store") {
                  const order = orders.find((o) => String(o.id) === String(marker.id));
                  if (order) setSelectedOrder(order);
                }
              }}
            />
            {selectedOrder && (
              <div
                className="tm-card"
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  bottom: 12,
                  zIndex: 10,
                  padding: 14,
                  boxShadow: "var(--tm-shadow-md)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                  <Text style={{ fontWeight: 700 }}>🏪 {selectedOrder.store?.name}</Text>
                  <Text style={{ fontWeight: 700, color: "var(--tm-primary)" }}>
                    <DisplayPrice>{selectedOrder.driverPayout || selectedOrder.deliveryFee || 0}</DisplayPrice>
                  </Text>
                </div>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 10 }}>
                  {selectedOrder.store?.address}
                </Text>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    style={{
                      border: "1px solid var(--tm-border)",
                      borderRadius: 10,
                      background: "#fff",
                      padding: "10px 12px",
                      fontWeight: 600,
                    }}
                  >
                    Đóng
                  </button>
                  <button
                    onClick={() => {
                      handleClaim(selectedOrder.id);
                      setSelectedOrder(null);
                    }}
                    disabled={claiming === selectedOrder.id}
                    style={{
                      border: "none",
                      borderRadius: 10,
                      background: "var(--tm-primary)",
                      color: "#fff",
                      padding: "10px 12px",
                      fontWeight: 700,
                    }}
                  >
                    {claiming === selectedOrder.id ? "Đang nhận..." : "Nhận đơn"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <Box className="flex items-center justify-center" style={{ padding: 48 }}>
            <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
          </Box>
        ) : orders.length === 0 ? (
          <div className="tm-empty-state tm-card" style={{ padding: "42px 20px" }}>
            <span className="tm-empty-icon">📭</span>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>Chưa có đơn nào</Text>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
              Hệ thống sẽ tự động cập nhật khi có đơn mới
            </Text>
          </div>
        ) : (
          <div>
            {orders.map((order) => (
              <div key={order.id} className="tm-order-card animate-fade-in">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <Text style={{ fontWeight: 700, fontSize: 14 }}>🏪 {order.store?.name || "Quán"}</Text>
                    <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>#{order.id.slice(0, 8)}</Text>
                  </div>
                  <span
                    style={{
                      background: order.paymentMethod === "COD" ? "#fef9e7" : "#ecfdf5",
                      color: order.paymentMethod === "COD" ? "#a16207" : "#047857",
                      padding: "3px 10px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {order.paymentMethod === "COD" ? "COD" : "Online"}
                  </span>
                </div>

                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 6 }}>
                  {order.items?.map((i: any) => `${i.productName} x${i.quantity}`).join(", ")}
                </Text>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 4 }}>
                  🏪 Lấy: {order.store?.address?.slice(0, 50) || "Quán đối tác"}
                  {order.distanceToStoreKm != null ? ` (Cách bạn ${order.distanceToStoreKm}km)` : ""}
                </Text>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
                  🏁 Giao: {order.deliveryAddress?.address?.slice(0, 60) || "Không rõ"}
                </Text>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid var(--tm-border)",
                    gap: 10,
                  }}
                >
                  <div>
                    <Text style={{ fontWeight: 800, color: "var(--tm-primary)", fontSize: 20 }}>
                      <DisplayPrice>{order.driverPayout || order.deliveryFee || 0}</DisplayPrice>
                    </Text>
                    <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>Thu nhập</Text>
                  </div>
                  <button
                    className="tm-interactive animate-pulse-soft"
                    onClick={() => handleClaim(order.id)}
                    disabled={claiming === order.id}
                    style={{
                      background: "linear-gradient(135deg, #10b981, #047857)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 14,
                      padding: "14px 28px",
                      fontWeight: 800,
                      fontSize: 16,
                      boxShadow: "var(--tm-shadow-floating)",
                      opacity: claiming === order.id ? 0.7 : 1,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {claiming === order.id ? "Đang nhận..." : "Nhận đơn"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Box>

      <Modal visible={!!incomingOrder} title="Có đơn mới gần bạn" onClose={() => setIncomingOrder(null)}>
        <Box p={4}>
          <Text style={{ fontWeight: 700, marginBottom: 6 }}>{incomingOrder?.store?.name || "Đơn giao hàng mới"}</Text>
          <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 6 }}>
            #{incomingOrder?.id?.slice(0, 8)} · {incomingOrder?.paymentMethod === "COD" ? "COD" : "Online"}
          </Text>
          {incomingOrder?.distanceToStoreKm != null && (
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
              📍 Lấy hàng cách bạn: <b>{incomingOrder.distanceToStoreKm} km</b>
            </Text>
          )}
          <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 12 }}>
            🏁 Giao đến: {incomingOrder?.deliveryAddress?.address || "Không rõ"}
          </Text>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              onClick={() => setIncomingOrder(null)}
              style={{
                border: "2px solid #fecdd3",
                borderRadius: 10,
                background: "#fff1f2",
                color: "#e53935",
                padding: "10px 12px",
                fontWeight: 700,
              }}
            >
              Từ chối
            </button>
            <button
              onClick={() => {
                if (!incomingOrder?.id) return;
                handleClaim(incomingOrder.id);
              }}
              disabled={claiming === incomingOrder?.id}
              style={{
                border: "none",
                borderRadius: 10,
                background: "var(--tm-primary)",
                color: "#fff",
                padding: "10px 12px",
                fontWeight: 700,
              }}
            >
              {claiming === incomingOrder?.id ? "Đang nhận..." : "Nhận đơn"}
            </button>
          </div>
        </Box>
      </Modal>
    </Page>
  );
};

export default AvailableOrdersPage;
