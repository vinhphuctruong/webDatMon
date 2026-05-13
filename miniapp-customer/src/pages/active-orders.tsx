import React, { FC, useEffect, useState } from "react";
import { Box, Header, Page, Text, useSnackbar, useNavigate, Modal, Input } from "zmp-ui";
import { DisplayPrice } from "components/display/price";
import { fetchOrders } from "services/backend";
import { confirmReceived, requestCancelOrder } from "services/api";
import { initSocket } from "services/socket";
import { VietMapView, MapMarker } from "components/vietmap";
import { THU_DAU_MOT_CENTER, normalizeStoredCoordinates } from "utils/location";
import { formatStoreOrderCode } from "utils/order-code";
import { calculateDistance } from "utils/location";

const SHOW_ACTIVE_ORDER_MAP = false;

/* ── Star Rating Component ────────────────── */
const StarRating: FC<{
  value: number;
  onChange: (v: number) => void;
  size?: number;
  label?: string;
}> = ({ value, onChange, size = 28, label }) => (
  <div style={{ marginBottom: 12 }}>
    {label && (
      <Text size="xSmall" style={{ fontWeight: 600, color: "var(--tm-text-secondary)", marginBottom: 6 }}>
        {label}
      </Text>
    )}
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => onChange(star)}
          style={{
            fontSize: size,
            cursor: "pointer",
            color: star <= value ? "#ffb800" : "#e5e7eb",
            transition: "color 0.15s, transform 0.15s",
            transform: star <= value ? "scale(1.1)" : "scale(1)",
          }}
        >
          
        </span>
      ))}
    </div>
  </div>
);

/* ── Map component ────────────────────────── */
const OrderLocationMap: FC<{ order: any }> = ({ order }) => {
  const storeLoc = normalizeStoredCoordinates(order.store?.latitude, order.store?.longitude) || THU_DAU_MOT_CENTER;
  const customerLoc = normalizeStoredCoordinates(order.deliveryAddress?.latitude, order.deliveryAddress?.longitude) || { lat: storeLoc.lat - 0.01, lng: storeLoc.lng + 0.01 };

  const markers = [
    { lat: storeLoc.lat, lng: storeLoc.lng, label: order.store?.name || "Quán", type: "store" as any },
    { lat: customerLoc.lat, lng: customerLoc.lng, label: order.deliveryAddress?.receiverName || "Khách", type: "customer" as any },
  ];

  const distance = calculateDistance(storeLoc.lat, storeLoc.lng, customerLoc.lat, customerLoc.lng);

  return (
    <div style={{ marginTop: 12, marginBottom: 12, position: "relative" }}>
      <VietMapView
        center={[storeLoc.lng, storeLoc.lat]}
        zoom={13}
        markers={markers}
        height={160}
        showRoute={false}
        style={{ borderRadius: 12, border: "1px solid var(--tm-border)" }}
      />
      <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(255,255,255,0.9)", padding: "4px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600, color: "#e53935", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        Khoảng cách chim bay: {distance.toFixed(1)} km
      </div>
    </div>
  );
};

/* ── Order Card ───────────────────────────── */
const OrderCard: FC<{ order: any; onRefresh: () => void }> = ({ order, onRefresh }) => {
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const requestCancelReason = () => {
    const input = window.prompt("Vui lòng nhập lý do hủy đơn", "Khách hàng đổi ý");
    if (input == null) return null;
    const reason = input.trim();
    if (reason.length < 2) {
      snackbar.openSnackbar({ type: "warning", text: "Lý do hủy đơn phải từ 2 ký tự" });
      return null;
    }
    return reason;
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    DELIVERED: { label: "Đã giao", color: "#10b981", bg: "#ecfdf5", icon: "" },
    CANCELLED: { label: "Đã huỷ", color: "var(--tm-danger)", bg: "#fef2f2", icon: "" },
    FAILED: { label: "Giao thất bại", color: "var(--tm-danger)", bg: "#fef2f2", icon: "" },
    PENDING: { label: "Chờ xác nhận", color: "var(--tm-warning)", bg: "#fef9e7", icon: "⏳" },
    CONFIRMED: { label: "Quán đã nhận", color: "var(--tm-primary)", bg: "#e6f7ef", icon: "" },
    PREPARING: { label: "Đang chuẩn bị", color: "var(--tm-primary)", bg: "#e6f7ef", icon: "" },
    READY: { label: "Chờ lấy món", color: "var(--tm-warning)", bg: "#fef9e7", icon: "" },
    PICKED_UP: { label: "Đang giao", color: "var(--tm-primary)", bg: "var(--tm-primary-light)", icon: "" },
  };
  const status = statusConfig[order.status] || { label: "Đang xử lý", color: "var(--tm-warning)", bg: "#fef9e7", icon: "⏳" };

  const dateStr = order.estimatedDeliveryAt
    ? new Date(order.estimatedDeliveryAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  const isDelivered = order.status === "DELIVERED";
  const hasConfirmed = !!order.customerConfirmedAt;
  const hasReviewed = !!order.review;

  const handleCancel = async () => {
    if (order.cancelRequestStatus === "PENDING") {
      snackbar.openSnackbar({ type: "info", text: "Yêu cầu huỷ đang chờ quán duyệt." });
      return;
    }
    if (!["PENDING", "CONFIRMED", "PREPARING", "READY"].includes(order.status)) {
      if (order.status === "PICKED_UP") {
        snackbar.openSnackbar({
          type: "warning",
          text: "Đơn đã được lấy hàng. Vui lòng gọi CSKH để được hỗ trợ huỷ.",
        });
        return;
      }
      snackbar.openSnackbar({ type: "error", text: "Không thể hủy đơn ở trạng thái hiện tại." });
      return;
    }
    const reason = requestCancelReason();
    if (!reason) return;
    setCancelling(true);
    try {
      await requestCancelOrder(order.id, reason);
      snackbar.openSnackbar({
        type: order.status === "PENDING" ? "success" : "info",
        text:
          order.status === "PENDING"
            ? "Đơn đã được huỷ và hoàn tiền tự động."
            : "Đã gửi yêu cầu huỷ tới quán. Vui lòng chờ phản hồi.",
      });
      onRefresh();
    } catch (error) {
      snackbar.openSnackbar({ type: "error", text: error instanceof Error ? error.message : "Hủy đơn thất bại" });
    } finally {
      setCancelling(false);
    }
  };

  const handleCallSupport = () => {
    try {
      window.location.href = "tel:19001234";
    } catch (_error) {
      snackbar.openSnackbar({
        type: "info",
        text: "Vui lòng liên hệ CSKH qua số 1900 1234 để được hỗ trợ.",
      });
    }
  };

  const handleConfirmReceived = async () => {
    setConfirming(true);
    try {
      await confirmReceived(order.id);
      snackbar.openSnackbar({ type: "success", text: "Xác nhận nhận hàng thành công!" });
      onRefresh();
    } catch (error) {
      snackbar.openSnackbar({ type: "error", text: error instanceof Error ? error.message : "Xác nhận thất bại" });
    } finally {
      setConfirming(false);
    }
  };



  return (
    <div className="tm-card" style={{ padding: "14px 16px", marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <Text style={{ fontWeight: 600, fontSize: 14, color: "var(--tm-text-primary)" }}>
            #{formatStoreOrderCode(order)}
          </Text>
          <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>
            {dateStr}
          </Text>
        </div>
        <span
          style={{
            background: status.bg, color: status.color,
            padding: "3px 10px", borderRadius: 12,
            fontSize: 11, fontWeight: 600,
          }}
        >
          {status.icon} {status.label}
        </span>
      </div>

      {/* Store & items info */}
      <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
        {order.store?.name} · {order.items?.length || 0} món
      </Text>
      {order.cancelRequestStatus === "PENDING" && (
        <Text
          size="xxSmall"
          style={{
            color: "#92400e",
            background: "#fef3c7",
            borderRadius: 8,
            padding: "4px 8px",
            display: "inline-block",
            marginBottom: 6,
          }}
        >
          Đang chờ quán duyệt yêu cầu huỷ
        </Text>
      )}
      {order.cancelRequestStatus === "REJECTED" && (
        <Text
          size="xxSmall"
          style={{
            color: "#b91c1c",
            background: "#fee2e2",
            borderRadius: 8,
            padding: "4px 8px",
            display: "inline-block",
            marginBottom: 6,
          }}
        >
          Yêu cầu huỷ bị từ chối
          {order.cancelReason ? `: ${order.cancelReason}` : ""}
        </Text>
      )}
      {["CANCELLED", "FAILED"].includes(order.status) && !!order.cancelReason && (
        <Text
          size="xxSmall"
          style={{
            color: "#7f1d1d",
            background: "#fef2f2",
            borderRadius: 8,
            padding: "4px 8px",
            display: "inline-block",
            marginBottom: 6,
          }}
        >
          Lý do: {order.cancelReason}
        </Text>
      )}
      <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {order.items?.map((item: any) => `${item.productName || item.name} x${item.quantity}`).join(", ")}
      </Text>

      {/* Map preview hidden to reduce VietMap API usage */}
      {SHOW_ACTIVE_ORDER_MAP && order.status === "PICKED_UP" && <OrderLocationMap order={order} />}

      {/* Delivered banner - confirm received prompt */}
      {isDelivered && !hasConfirmed && (
        <div style={{
          marginTop: 12,
          padding: "12px 14px",
          background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
          borderRadius: 14,
          border: "1px solid #a7f3d0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}></span>
            <div>
              <Text style={{ fontWeight: 700, fontSize: 13, color: "#065f46" }}>
                Tài xế đã giao đơn hàng của bạn!
              </Text>
              <Text size="xxxSmall" style={{ color: "#047857" }}>
                Vui lòng xác nhận đã nhận được món
              </Text>
            </div>
          </div>
          <button
            onClick={handleConfirmReceived}
            disabled={confirming}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              opacity: confirming ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
              transition: "all 0.2s",
            }}
          >
            {confirming ? "Đang xử lý..." : " Đã nhận được món"}
          </button>
        </div>
      )}



      {/* Footer: price + actions */}
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--tm-border)",
        }}
      >
        <Text style={{ fontWeight: 700, color: "var(--tm-primary)", fontSize: 15 }}>
          <DisplayPrice>{order.total}</DisplayPrice>
        </Text>
        <div style={{ display: "flex", gap: 8 }}>
          {["PENDING", "CONFIRMED", "PREPARING", "READY"].includes(order.status) && order.cancelRequestStatus !== "PENDING" && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              style={{
                background: "#fef2f2", color: "var(--tm-danger)",
                border: "none", borderRadius: 12, padding: "5px 14px",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                opacity: cancelling ? 0.7 : 1
              }}
            >
              {cancelling ? "Đang xử lý..." : order.status === "PENDING" ? "Hủy đơn" : "Yêu cầu hủy"}
            </button>
          )}
          {order.status === "PICKED_UP" && (
            <button
              onClick={handleCallSupport}
              style={{
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "none",
                borderRadius: 12,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Gọi CSKH
            </button>
          )}
          <button
            onClick={() => navigate("/")}
            style={{
              background: "var(--tm-primary-light)", color: "var(--tm-primary)",
              border: "none", borderRadius: 12, padding: "5px 14px",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Đặt lại
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Page Content ──────────────────────────── */
export const ActiveOrdersContent: FC<{ orders: any[], loading: boolean, onRefresh: () => void }> = ({ orders, loading, onRefresh }) => {
  useEffect(() => {
    const socket = initSocket();
    if (socket) {
      socket.on("order_status_updated", () => {
        onRefresh();
      });
    }
    return () => {
      if (socket) {
        socket.off("order_status_updated");
      }
    };
  }, [onRefresh]);

  return (
    <Box style={{ padding: "16px", paddingBottom: "100px" }}>
      {loading ? (
        <Box className="flex flex-col items-center justify-center py-10">
          <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
        </Box>
      ) : orders.length === 0 ? (
        <Box className="flex flex-col items-center justify-center py-10">
          <Text style={{ color: "var(--tm-text-secondary)" }}>Bạn chưa có đơn hàng nào đang xử lý</Text>
        </Box>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <OrderCard key={`${order.id}-${i}`} order={order} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </Box>
  );
};
