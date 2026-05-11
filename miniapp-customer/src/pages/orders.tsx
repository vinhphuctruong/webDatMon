import React, { FC, useEffect, useState } from "react";
import { Box, Header, Page, Text, useSnackbar, useNavigate, Input, Tabs } from "zmp-ui";
import { ActiveOrdersContent } from "./active-orders";
import { Sheet } from "components/fullscreen-sheet";
import { DisplayPrice } from "components/display/price";
import { fetchOrders } from "services/backend";
import { requestCancelOrder, submitReview } from "services/api";
import { formatStoreOrderCode } from "utils/order-code";

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

/* ── Review Sheet Component ───────────────── */
const ReviewSheet: FC<{
  visible: boolean;
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ visible, order, onClose, onSuccess }) => {
  const snackbar = useSnackbar();
  const [storeRating, setStoreRating] = useState(5);
  const [storeComment, setStoreComment] = useState("");
  const [driverRating, setDriverRating] = useState(5);
  const [driverComment, setDriverComment] = useState("");
  const [productRatings, setProductRatings] = useState<Record<string, { rating: number; comment: string }>>({});
  const [submittingReview, setSubmittingReview] = useState(false);

  // Reset state when order changes
  useEffect(() => {
    if (visible && order) {
      setStoreRating(5);
      setStoreComment("");
      setDriverRating(5);
      setDriverComment("");
      const pr: Record<string, { rating: number; comment: string }> = {};
      order.items?.forEach((item: any) => {
        pr[item.productId] = { rating: 5, comment: "" };
      });
      setProductRatings(pr);
      setSubmittingReview(false);
    }
  }, [visible, order]);

  if (!order) return null;

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      const productRatingsList = Object.entries(productRatings).map(([productId, data]) => ({
        productId,
        rating: data.rating,
        comment: data.comment.trim() || undefined,
      }));

      await submitReview(order.id, {
        storeRating,
        comment: storeComment.trim() || undefined,
        driverRating: order.driverId ? driverRating : undefined,
        driverComment: driverComment.trim() || undefined,
        productRatings: productRatingsList.length > 0 ? productRatingsList : undefined,
      });
      snackbar.openSnackbar({ type: "success", text: "Cảm ơn bạn đã đánh giá!" });
      onSuccess();
    } catch (error) {
      snackbar.openSnackbar({ type: "error", text: error instanceof Error ? error.message : "Đánh giá thất bại" });
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      autoHeight
      swipeToClose
      mask
      maskClosable
    >
      <Box p={4} style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{
          textAlign: "center",
          padding: "12px 0 16px",
          background: "linear-gradient(135deg, #fef9e7, #fff7ed)",
          borderRadius: 16,
          marginBottom: 20,
        }}>
          <span style={{ fontSize: 36 }}>⭐</span>
          <Text style={{ fontWeight: 700, fontSize: 15, color: "var(--tm-text-primary)", marginTop: 4 }}>
            Đơn hàng #{formatStoreOrderCode(order)}
          </Text>
          <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)" }}>
            Chia sẻ trải nghiệm của bạn
          </Text>
        </div>

        <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 14, marginBottom: 16 }}>
          <StarRating value={storeRating} onChange={setStoreRating} label={` ${order.store?.name || "Quán"}`} size={30} />
          <Input.TextArea
            placeholder="Nhận xét về quán..."
            value={storeComment}
            onChange={(e) => setStoreComment(e.target.value)}
            rows={2}
            style={{ borderRadius: 12, marginTop: 8 }}
          />
        </div>

        {order.driverId && (
          <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 14, marginBottom: 16 }}>
            <StarRating value={driverRating} onChange={setDriverRating} label=" Tài xế" size={30} />
            <Input.TextArea
              placeholder="Nhận xét về tài xế..."
              value={driverComment}
              onChange={(e) => setDriverComment(e.target.value)}
              rows={2}
              style={{ borderRadius: 12, marginTop: 8 }}
            />
          </div>
        )}

        {order.items && order.items.length > 0 && (
          <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 14, marginBottom: 20 }}>
            <Text size="xSmall" style={{ fontWeight: 600, color: "var(--tm-text-secondary)", marginBottom: 8 }}>
               Đánh giá món ăn
            </Text>
            {order.items.map((item: any, idx: number) => {
              const pData = productRatings[item.productId] || { rating: 5, comment: "" };
              return (
                <div key={`${item.productId}-${idx}`} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: idx < order.items.length - 1 ? "1px solid #e5e7eb" : "none" }}>
                  <Text size="xSmall" style={{ color: "var(--tm-text-primary)", fontWeight: 600, marginBottom: 4 }}>
                    {item.productName}
                  </Text>
                  <StarRating 
                    value={pData.rating} 
                    onChange={(r) => setProductRatings(prev => ({ ...prev, [item.productId]: { ...pData, rating: r } }))} 
                    size={22} 
                  />
                  <Input.TextArea
                    placeholder={`Nhận xét về ${item.productName}...`}
                    value={pData.comment}
                    onChange={(e) => setProductRatings(prev => ({ ...prev, [item.productId]: { ...pData, comment: e.target.value } }))}
                    rows={1}
                    style={{ borderRadius: 10, marginTop: 4, fontSize: 13 }}
                  />
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={handleSubmitReview}
          disabled={submittingReview}
          style={{
            width: "100%", padding: "13px", borderRadius: 14,
            background: "linear-gradient(135deg, var(--tm-primary), #047857)",
            color: "#fff", fontWeight: 700, fontSize: 15,
            border: "none", cursor: "pointer",
            opacity: submittingReview ? 0.7 : 1,
            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
            transition: "all 0.2s",
          }}
        >
          {submittingReview ? "Đang gửi..." : "Gửi đánh giá ⭐"}
        </button>
      </Box>
    </Sheet>
  );
};

/* ── Order Card Component ─────────────────── */
const OrderCard: FC<{ order: any; onCancelSuccess: () => void; onReview: (order: any) => void }> = ({ order, onCancelSuccess, onReview }) => {
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);

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

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    DELIVERED: { label: "Thành công", color: "var(--tm-primary)", bg: "var(--tm-primary-light)" },
    CANCELLED: { label: "Đã huỷ", color: "var(--tm-danger)", bg: "#fef2f2" },
    FAILED: { label: "Giao thất bại", color: "var(--tm-danger)", bg: "#fef2f2" },
    PENDING: { label: "Chờ xác nhận", color: "var(--tm-warning)", bg: "#fef9e7" },
    CONFIRMED: { label: "Quán đã nhận", color: "var(--tm-primary)", bg: "#e6f7ef" },
    PREPARING: { label: "Đang chuẩn bị", color: "var(--tm-primary)", bg: "#e6f7ef" },
    READY: { label: "Chờ lấy món", color: "var(--tm-warning)", bg: "#fef9e7" },
    PICKED_UP: { label: "Đang giao", color: "var(--tm-primary)", bg: "var(--tm-primary-light)" },
  };
  const status = statusConfig[order.status] || { label: "Đang xử lý", color: "var(--tm-warning)", bg: "#fef9e7" };
  
  const dateStr = order.estimatedDeliveryAt 
    ? new Date(order.estimatedDeliveryAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  const handleCancel = async () => {
    if (!["PENDING", "CONFIRMED", "PREPARING", "READY"].includes(order.status)) {
      if (order.status === "PICKED_UP") {
        snackbar.openSnackbar({
          type: "warning",
          text: "Đơn đã được tài xế lấy hàng. Vui lòng gọi CSKH để hỗ trợ huỷ.",
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
      if (order.status === "PENDING") {
        snackbar.openSnackbar({ type: "success", text: "Đơn đã được huỷ và hoàn tiền tự động." });
      } else {
        snackbar.openSnackbar({
          type: "info",
          text: "Đã gửi yêu cầu huỷ đơn tới quán. Vui lòng chờ phản hồi.",
        });
      }
      onCancelSuccess();
    } catch (error) {
      snackbar.openSnackbar({ type: "error", text: error instanceof Error ? error.message : "Hủy đơn thất bại" });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="tm-card" style={{ padding: "14px 16px", marginBottom: 12 }}>
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
          {status.label}
        </span>
      </div>
      <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
        {order.store?.name} · {order.items?.length || 0} món
      </Text>
      <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {order.items?.map((item: any) => `${item.productName || item.name} x${item.quantity}`).join(", ")}
      </Text>
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
          {["PENDING", "CONFIRMED", "PREPARING", "READY"].includes(order.status) && (
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
          {order.review && (
            <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center" }}>
              ⭐ {order.review.rating}/5
            </span>
          )}
          {order.status === "DELIVERED" && !order.review && (
            <button
              onClick={() => onReview(order)}
              style={{
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#fff",
                border: "none", borderRadius: 12, padding: "5px 14px",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Đánh giá
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

/* ── History Page Content ───────────────────── */
const HistoryOrdersContent: FC<{ orders: any[], loading: boolean, selectedOrderForReview: any, setSelectedOrderForReview: (o: any) => void, onRefresh: () => void }> = ({ orders, loading, selectedOrderForReview, setSelectedOrderForReview, onRefresh }) => {
  return (
    <Box style={{ padding: "16px", paddingBottom: "100px" }}>
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
            <OrderCard 
              key={`${order.id}-${i}`} 
              order={order} 
              onCancelSuccess={onRefresh} 
              onReview={(o) => setSelectedOrderForReview(o)}
            />
          ))}
        </div>
      )}
    </Box>
  );
};

/* ── Unified Orders Page ───────────────────── */

const OrdersPage: FC = () => {
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<any>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await fetchOrders();
      setAllOrders(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [selectedOrderForReview]); // re-fetch when review sheet closes

  const activeOrders = allOrders.filter((o: any) =>
    ["PENDING", "CONFIRMED", "PREPARING", "READY", "PICKED_UP"].includes(o.status) ||
    (o.status === "DELIVERED" && !o.customerConfirmedAt)
  );

  const historyOrders = allOrders.filter((o: any) => 
    (o.status === "DELIVERED" && o.customerConfirmedAt) ||
    ["CANCELLED", "FAILED"].includes(o.status)
  );

  return (
    <Page style={{ background: "var(--tm-bg)" }}>
      <Header title="Đơn hàng" showBackIcon />
      <Tabs id="orders-tab" scrollable={false} className="bg-white">
        <Tabs.Tab key="active" label="Đang diễn ra">
          <ActiveOrdersContent orders={activeOrders} loading={loading} onRefresh={loadOrders} />
        </Tabs.Tab>
        <Tabs.Tab key="history" label="Lịch sử">
          <HistoryOrdersContent 
            orders={historyOrders}
            loading={loading}
            selectedOrderForReview={selectedOrderForReview} 
            setSelectedOrderForReview={setSelectedOrderForReview} 
            onRefresh={loadOrders}
          />
        </Tabs.Tab>
      </Tabs>

      <ReviewSheet
        visible={!!selectedOrderForReview}
        order={selectedOrderForReview}
        onClose={() => setSelectedOrderForReview(null)}
        onSuccess={() => {
          setSelectedOrderForReview(null);
        }}
      />
    </Page>
  );
};

export default OrdersPage;
