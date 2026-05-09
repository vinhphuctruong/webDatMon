import React, { FC, useEffect, useState } from "react";
import { Box, Header, Page, Text, useSnackbar, useNavigate, Modal, Input } from "zmp-ui";
import { DisplayPrice } from "components/display/price";
import { fetchOrders } from "services/backend";
import { cancelOrder, confirmReceived, submitReview } from "services/api";
import { initSocket } from "services/socket";
import { VietMapView, MapMarker } from "components/vietmap";
import { THU_DAU_MOT_CENTER, normalizeStoredCoordinates } from "utils/location";
import { formatStoreOrderCode } from "utils/order-code";
import { calculateDistance } from "utils/location";

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
          ★
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
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [storeRating, setStoreRating] = useState(5);
  const [driverRating, setDriverRating] = useState(5);
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    DELIVERED: { label: "Đã giao", color: "#10b981", bg: "#ecfdf5", icon: "✅" },
    CANCELLED: { label: "Đã huỷ", color: "var(--tm-danger)", bg: "#fef2f2", icon: "❌" },
    FAILED: { label: "Giao thất bại", color: "var(--tm-danger)", bg: "#fef2f2", icon: "⚠️" },
    PENDING: { label: "Chờ xác nhận", color: "var(--tm-warning)", bg: "#fef9e7", icon: "⏳" },
    CONFIRMED: { label: "Quán đã nhận", color: "var(--tm-primary)", bg: "#e6f7ef", icon: "👍" },
    PREPARING: { label: "Đang chuẩn bị", color: "var(--tm-primary)", bg: "#e6f7ef", icon: "🍳" },
    READY: { label: "Chờ lấy món", color: "var(--tm-warning)", bg: "#fef9e7", icon: "📦" },
    PICKED_UP: { label: "Đang giao", color: "var(--tm-primary)", bg: "var(--tm-primary-light)", icon: "🛵" },
  };
  const status = statusConfig[order.status] || { label: "Đang xử lý", color: "var(--tm-warning)", bg: "#fef9e7", icon: "⏳" };

  const dateStr = order.estimatedDeliveryAt
    ? new Date(order.estimatedDeliveryAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  const isDelivered = order.status === "DELIVERED";
  const hasConfirmed = !!order.customerConfirmedAt;
  const hasReviewed = !!order.review;

  const handleCancel = async () => {
    if (order.status !== "PENDING") {
      snackbar.openSnackbar({ type: "error", text: "Chỉ có thể tự hủy khi đơn đang chờ xác nhận." });
      return;
    }
    setCancelling(true);
    try {
      await cancelOrder(order.id, "Khách hàng đổi ý");
      snackbar.openSnackbar({ type: "success", text: "Hủy đơn thành công." });
      onRefresh();
    } catch (error) {
      snackbar.openSnackbar({ type: "error", text: error instanceof Error ? error.message : "Hủy đơn thất bại" });
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirmReceived = async () => {
    setConfirming(true);
    try {
      await confirmReceived(order.id);
      snackbar.openSnackbar({ type: "success", text: "Xác nhận nhận hàng thành công!" });
      // Auto open review modal
      setReviewModalVisible(true);
      onRefresh();
    } catch (error) {
      snackbar.openSnackbar({ type: "error", text: error instanceof Error ? error.message : "Xác nhận thất bại" });
    } finally {
      setConfirming(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      const productRatingsList = Object.entries(productRatings).map(([productId, rating]) => ({
        productId,
        rating,
      }));

      await submitReview(order.id, {
        storeRating,
        driverRating: order.driverId ? driverRating : undefined,
        productRatings: productRatingsList.length > 0 ? productRatingsList : undefined,
        comment: comment.trim() || undefined,
      });
      snackbar.openSnackbar({ type: "success", text: "Cảm ơn bạn đã đánh giá! 🎉" });
      setReviewModalVisible(false);
      onRefresh();
    } catch (error) {
      snackbar.openSnackbar({ type: "error", text: error instanceof Error ? error.message : "Đánh giá thất bại" });
    } finally {
      setSubmittingReview(false);
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
      <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {order.items?.map((item: any) => `${item.productName || item.name} x${item.quantity}`).join(", ")}
      </Text>

      {/* Map for picked up orders */}
      {order.status === "PICKED_UP" && <OrderLocationMap order={order} />}

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
            <span style={{ fontSize: 20 }}>📦</span>
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
            {confirming ? "Đang xử lý..." : "✅ Đã nhận được món"}
          </button>
        </div>
      )}

      {/* Already confirmed but not yet reviewed */}
      {isDelivered && hasConfirmed && !hasReviewed && (
        <div style={{
          marginTop: 12,
          padding: "12px 14px",
          background: "linear-gradient(135deg, #fef9e7, #fef3c7)",
          borderRadius: 14,
          border: "1px solid #fcd34d",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <Text style={{ fontWeight: 700, fontSize: 13, color: "#92400e" }}>
              Hãy đánh giá trải nghiệm của bạn!
            </Text>
          </div>
          <button
            onClick={() => setReviewModalVisible(true)}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
            }}
          >
            ⭐ Đánh giá ngay
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
          {order.status === "PENDING" && (
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
              {cancelling ? "Đang hủy..." : "Hủy đơn"}
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

      {/* ── Comprehensive Review Modal ───────── */}
      <Modal
        visible={reviewModalVisible}
        title="Đánh giá đơn hàng"
        onClose={() => setReviewModalVisible(false)}
      >
        <Box p={4}>
          <div style={{
            textAlign: "center",
            padding: "12px 0 16px",
            background: "linear-gradient(135deg, #fef9e7, #fff7ed)",
            borderRadius: 16,
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 36 }}>🎉</span>
            <Text style={{ fontWeight: 700, fontSize: 15, color: "var(--tm-text-primary)", marginTop: 4 }}>
              Đơn hàng #{formatStoreOrderCode(order)}
            </Text>
            <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)" }}>
              Chia sẻ trải nghiệm của bạn
            </Text>
          </div>

          {/* Store Rating */}
          <div style={{
            padding: "12px 14px",
            background: "#f9fafb",
            borderRadius: 14,
            marginBottom: 12,
          }}>
            <StarRating
              value={storeRating}
              onChange={setStoreRating}
              label={`🏪 ${order.store?.name || "Quán"}`}
              size={30}
            />
          </div>

          {/* Driver Rating */}
          {order.driverId && (
            <div style={{
              padding: "12px 14px",
              background: "#f9fafb",
              borderRadius: 14,
              marginBottom: 12,
            }}>
              <StarRating
                value={driverRating}
                onChange={setDriverRating}
                label="🛵 Tài xế"
                size={30}
              />
            </div>
          )}

          {/* Product Ratings */}
          {order.items && order.items.length > 0 && (
            <div style={{
              padding: "12px 14px",
              background: "#f9fafb",
              borderRadius: 14,
              marginBottom: 12,
            }}>
              <Text size="xSmall" style={{ fontWeight: 600, color: "var(--tm-text-secondary)", marginBottom: 8 }}>
                🍽️ Đánh giá món ăn
              </Text>
              {order.items.map((item: any) => (
                <div key={item.id} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: "1px solid #f3f4f6",
                }}>
                  <Text size="xxSmall" style={{
                    color: "var(--tm-text-primary)",
                    fontWeight: 500,
                    maxWidth: "45%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {item.productName} x{item.quantity}
                  </Text>
                  <div style={{ display: "flex", gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        onClick={() => setProductRatings(prev => ({ ...prev, [item.productId]: star }))}
                        style={{
                          fontSize: 18,
                          cursor: "pointer",
                          color: star <= (productRatings[item.productId] || 5) ? "#ffb800" : "#e5e7eb",
                          transition: "color 0.15s",
                        }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment */}
          <Input.TextArea
            placeholder="Chia sẻ thêm về trải nghiệm (không bắt buộc) ✍️"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            style={{ marginBottom: 20, borderRadius: 14 }}
          />

          {/* Submit */}
          <button
            onClick={handleSubmitReview}
            disabled={submittingReview}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 14,
              background: "linear-gradient(135deg, var(--tm-primary), #047857)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
              opacity: submittingReview ? 0.7 : 1,
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
              transition: "all 0.2s",
            }}
          >
            {submittingReview ? "Đang gửi..." : "Gửi đánh giá ⭐"}
          </button>
        </Box>
      </Modal>
    </div>
  );
};

/* ── Page ──────────────────────────────────── */
const ActiveOrdersPage: FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      const data = await fetchOrders();
      // Include DELIVERED orders that haven't been confirmed/reviewed yet
      const activeData = (data || []).filter((o: any) =>
        ["PENDING", "CONFIRMED", "PREPARING", "READY", "PICKED_UP"].includes(o.status) ||
        (o.status === "DELIVERED" && (!o.customerConfirmedAt || !o.review))
      );
      setOrders(activeData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const socket = initSocket();
    if (socket) {
      socket.on("order_status_updated", () => {
        loadOrders();
      });
      return () => {
        socket.off("order_status_updated");
      };
    }
  }, []);

  return (
    <Page style={{ background: "var(--tm-bg)" }}>
      <Header title="Đơn hàng đang xử lý" showBackIcon />
      <Box style={{ padding: "16px" }}>
        {loading ? (
          <Box className="flex flex-col items-center justify-center py-10">
            <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
          </Box>
        ) : orders.length === 0 ? (
          <Box className="flex flex-col items-center justify-center py-10">
            <Text style={{ color: "var(--tm-text-secondary)" }}>Bạn chưa có đơn hàng nào</Text>
          </Box>
        ) : (
          <div className="space-y-3">
            {orders.map((order, i) => (
              <OrderCard key={`${order.id}-${i}`} order={order} onRefresh={loadOrders} />
            ))}
          </div>
        )}
      </Box>
    </Page>
  );
};

export default ActiveOrdersPage;
