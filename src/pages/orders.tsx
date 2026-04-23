import React, { FC } from "react";
import { Box, Header, Page, Text } from "zmp-ui";
import { useRecoilValue } from "recoil";
import { orderHistoryState, OrderHistoryItem } from "services/features";
import { DisplayPrice } from "components/display/price";

const OrderCard: FC<{ order: OrderHistoryItem }> = ({ order }) => {
  const statusConfig = {
    success: { label: "Thành công", color: "var(--tm-primary)", bg: "var(--tm-primary-light)" },
    failed: { label: "Thất bại", color: "var(--tm-danger)", bg: "#fef2f2" },
    pending: { label: "Đang xử lý", color: "var(--tm-warning)", bg: "#fef9e7" },
  };
  const status = statusConfig[order.status] || statusConfig.pending;
  const date = new Date(order.date);
  const dateStr = date.toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="tm-card" style={{ padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <Text style={{ fontWeight: 600, fontSize: 14, color: "var(--tm-text-primary)" }}>
            #{order.id}
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
        {order.storeName} · {order.items.length} món
      </Text>
      <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)" }}>
        {order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}
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
        <button
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
  );
};

const OrdersPage: FC = () => {
  const orders = useRecoilValue(orderHistoryState);

  return (
    <Page style={{ background: "var(--tm-bg)" }}>
      <Header title="Lịch sử đơn hàng" showBackIcon />
      <Box style={{ padding: "16px" }}>
        {orders.length === 0 ? (
          <Box className="flex flex-col items-center justify-center py-10">
            <Text style={{ color: "var(--tm-text-secondary)" }}>Bạn chưa có đơn hàng nào</Text>
          </Box>
        ) : (
          <div className="space-y-3">
            {orders.map((order, i) => (
              <OrderCard key={`${order.id}-${i}`} order={order} />
            ))}
          </div>
        )}
      </Box>
    </Page>
  );
};

export default OrdersPage;
