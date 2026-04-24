import React, { FC, useEffect, useState } from "react";
import { Box, Header, Page, Text, useSnackbar, useNavigate } from "zmp-ui";
import { DisplayPrice } from "components/display/price";
import { fetchOrders } from "services/backend";
import { cancelOrder } from "services/api";

const OrderCard: FC<{ order: any; onCancelSuccess: () => void }> = ({ order, onCancelSuccess }) => {
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);

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
  
  // order.placedAt or estimatedDeliveryAt
  const dateStr = order.estimatedDeliveryAt 
    ? new Date(order.estimatedDeliveryAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  const handleCancel = async () => {
    if (order.status !== "PENDING") {
      snackbar.openSnackbar({ type: "error", text: "Chỉ có thể tự hủy khi đơn đang chờ xác nhận." });
      return;
    }
    setCancelling(true);
    try {
      await cancelOrder(order.id, "Khách hàng đổi ý");
      snackbar.openSnackbar({ type: "success", text: "Hủy đơn thành công." });
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
            #{order.id.slice(0, 8)}
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
    </div>
  );
};

const ActiveOrdersPage: FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      const data = await fetchOrders();
      const activeData = (data || []).filter((o: any) => 
        ["PENDING", "CONFIRMED", "PREPARING", "READY", "PICKED_UP"].includes(o.status)
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
              <OrderCard key={`${order.id}-${i}`} order={order} onCancelSuccess={loadOrders} />
            ))}
          </div>
        )}
      </Box>
    </Page>
  );
};

export default ActiveOrdersPage;
