import React, { FC, useCallback, useEffect, useState } from "react";
import { Box, Modal, Page, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { ApiError, hasSessionAsync } from "services/api";
import {
  fetchMyOrders,
  completeOrder,
  pickupOrder,
  rejectAssignedOrder,
  reportFailedDelivery,
} from "services/driver-api";
import { DisplayPrice } from "components/display/price";
import {
  THU_DAU_MOT_CENTER,
  calculateDistance,
  calculateETA,
  displayDistance,
  getDriverLocationSafe,
  normalizeStoredCoordinates,
} from "utils/location";
import { formatStoreOrderCode } from "utils/order-code";

const DeliveryRouteMap: FC<{ order: any }> = ({ order }) => {
  const navigate = useNavigate();
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
      const pos = await getDriverLocationSafe({
        maxAgeMs: 12000,
        allowStale: true,
        quiet: true,
      });
      if (pos) {
        setDriverLat(pos.latitude);
        setDriverLng(pos.longitude);
      }
    };

    fetchLocation();
    const interval = setInterval(fetchLocation, 10000);
    return () => clearInterval(interval);
  }, []);

  // Only navigate to customer when driver has actually picked up food
  const isPickedUp = order.status === "PICKED_UP";
  const targetLat = isPickedUp ? customerLat : storeLat;
  const targetLng = isPickedUp ? customerLng : storeLng;

  const distance =
    driverLat && driverLng
      ? calculateDistance(driverLat, driverLng, targetLat, targetLng)
      : calculateDistance(storeLat, storeLng, customerLat, customerLng);

  const eta = calculateETA(distance);


  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          borderRadius: 12,
          border: "1px solid var(--tm-border)",
          background: "linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%)",
          padding: "10px 12px",
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--tm-text-secondary)", fontWeight: 600 }}>
          ETA tới {isPickedUp ? "khách" : "quán"}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--tm-primary)", marginTop: 2 }}>{eta}</div>
        <div style={{ fontSize: 12, color: "var(--tm-text-tertiary)" }}>
          {displayDistance(distance)} {driverLat && driverLng ? "• Cập nhật theo GPS" : "• Ước tính"}
        </div>
      </div>

      <button
        onClick={() => {
          const params = new URLSearchParams({
            destLat: String(targetLat),
            destLng: String(targetLng),
            destName: isPickedUp
              ? (order.deliveryAddress?.receiverName || "Khách hàng")
              : (order.store?.name || "Quán"),
            destType: isPickedUp ? "customer" : "store",
          });
          if (driverLat && driverLng) {
            params.set("originLat", String(driverLat));
            params.set("originLng", String(driverLng));
          }
          navigate(`/navigation?${params.toString()}`);
        }}
        style={{
          width: "100%",
          marginTop: 10,
          background: "linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "12px",
          fontWeight: 700,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(26,115,232,0.35)",
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
        Mở bản đồ dẫn đường
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
  const [rejectModal, setRejectModal] = useState<{ orderId: string; visible: boolean }>({
    orderId: "",
    visible: false,
  });
  const [failReason, setFailReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [failing, setFailing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const snackbar = useSnackbar();
  const navigate = useNavigate();

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetchMyOrders();
      const active = (res.data || []).filter((o: any) => ["PICKED_UP", "CONFIRMED", "PREPARING"].includes(o.status));
      setActiveOrders(active);
    } catch (err: any) {
      console.error(err);
      if (err instanceof ApiError) {
        if (err.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (err.status === 403) {
          navigate("/register", { replace: true });
          return;
        }
      }
      snackbar.openSnackbar({ type: "error", text: err?.message || "Không tải được đơn đang giao" });
    } finally {
      setLoading(false);
    }
  }, [navigate, snackbar]);

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const bootstrap = async () => {
      if (!active) return;
      await loadOrders();
      interval = setInterval(loadOrders, 15000);
    };

    void bootstrap();
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
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
    const reason = failReason.trim();
    if (reason.length < 2) {
      snackbar.openSnackbar({ type: "warning", text: "Vui lòng nhập lý do giao thất bại (tối thiểu 2 ký tự)" });
      return;
    }
    setFailing(true);
    try {
      await reportFailedDelivery(failModal.orderId, reason);
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

  const handleRejectAssigned = async () => {
    const reason = rejectReason.trim();
    if (reason.length < 2) {
      snackbar.openSnackbar({ type: "warning", text: "Vui lòng nhập lý do nhả đơn (tối thiểu 2 ký tự)" });
      return;
    }
    setRejecting(true);
    try {
      await rejectAssignedOrder(rejectModal.orderId, reason);
      snackbar.openSnackbar({ type: "success", text: "Đã nhả đơn về hệ thống dispatch" });
      setRejectModal({ orderId: "", visible: false });
      setRejectReason("");
      loadOrders();
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Không thể nhả đơn" });
    } finally {
      setRejecting(false);
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
            <span className="tm-empty-icon"></span>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>Không có đơn đang giao</Text>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
              Bật trạng thái online để nhận đơn phân công tự động
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
                <Text style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}> {order.store?.name}</Text>
                <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>{order.store?.address}</Text>
              </div>

              <div style={{ background: "#f8faf8", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <Text style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}> Giao tới khách</Text>
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
                    onClick={() =>
                      setRejectModal({
                        orderId: order.id,
                        visible: true,
                      })
                    }
                    style={{
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "2px solid #bfdbfe",
                      borderRadius: 14,
                      padding: "12px",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Nhả đơn
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

      <Modal
        visible={rejectModal.visible}
        title="Nhả đơn về hệ thống"
        onClose={() => setRejectModal({ orderId: "", visible: false })}
      >
        <Box p={4}>
          <Text style={{ marginBottom: 12 }}>
            Đơn sẽ được dispatch lại cho tài xế khác và ảnh hưởng chỉ số nhận chuyến của bạn.
          </Text>
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Lý do nhả đơn (tuỳ chọn)"
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
            onClick={handleRejectAssigned}
            disabled={rejecting}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              background: "#1d4ed8",
              color: "#fff",
              fontWeight: 700,
              border: "none",
              opacity: rejecting ? 0.7 : 1,
            }}
          >
            {rejecting ? "Đang xử lý..." : "Xác nhận nhả đơn"}
          </button>
        </Box>
      </Modal>
    </Page>
  );
};

export default ActiveDeliveryPage;
