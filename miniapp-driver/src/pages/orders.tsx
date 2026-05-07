import React, { FC, useEffect, useMemo, useState } from "react";
import { Box, Page, Text } from "zmp-ui";
import { fetchMyOrders } from "services/driver-api";
import { DisplayPrice } from "components/display/price";

const OrdersPage: FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyOrders()
      .then((res) => {
        const history = (res.data || []).filter((o: any) => ["DELIVERED", "CANCELLED", "FAILED"].includes(o.status));
        setOrders(history);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = useMemo(
    () => ({
      DELIVERED: { label: "Thành công", color: "#047857", bg: "#ecfdf5" },
      CANCELLED: { label: "Đã huỷ", color: "var(--tm-danger)", bg: "#fef2f2" },
      FAILED: { label: "Thất bại", color: "var(--tm-danger)", bg: "#fef2f2" },
    }),
    [],
  );

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
        <Text.Title style={{ color: "#fff", fontSize: 20 }}>Lịch sử đơn hàng</Text.Title>
        <Text size="xSmall" style={{ color: "rgba(255,255,255,0.82)", marginTop: 4 }}>
          Xem lại cuốc giao đã hoàn tất và thu nhập từng đơn
        </Text>
      </Box>

      <Box p={4} className="tm-content-pad" style={{ marginTop: -26 }}>
        {loading ? (
          <Box className="flex items-center justify-center" style={{ padding: 48 }}>
            <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
          </Box>
        ) : orders.length === 0 ? (
          <div className="tm-empty-state tm-card" style={{ padding: "42px 20px" }}>
            <span className="tm-empty-icon">📦</span>
            <Text style={{ fontWeight: 700 }}>Chưa có đơn hàng nào</Text>
          </div>
        ) : (
          orders.map((order) => {
            const st = statusConfig[order.status] || {
              label: order.status,
              color: "var(--tm-text-secondary)",
              bg: "var(--tm-bg)",
            };
            const date = order.completedAt
              ? new Date(order.completedAt).toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            return (
              <div key={order.id} className="tm-order-card animate-fade-in">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div>
                    <Text style={{ fontWeight: 700, fontSize: 14 }}>#{order.id.slice(0, 8)}</Text>
                    <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>{date}</Text>
                  </div>
                  <span
                    style={{
                      background: st.bg,
                      color: st.color,
                      padding: "3px 10px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {st.label}
                  </span>
                </div>

                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
                  🏪 {order.store?.name} · {order.items?.length || 0} món
                </Text>
                <Text
                  size="xSmall"
                  style={{
                    color: "var(--tm-text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {order.items?.map((i: any) => `${i.productName} x${i.quantity}`).join(", ")}
                </Text>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid var(--tm-border)",
                  }}
                >
                  <Text style={{ fontWeight: 700, color: "var(--tm-primary)", fontSize: 15 }}>
                    +<DisplayPrice>{order.driverPayout || 0}</DisplayPrice>
                  </Text>
                  <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>
                    {order.paymentMethod === "COD" ? "COD" : "Online"}
                  </Text>
                </div>
              </div>
            );
          })
        )}
      </Box>
    </Page>
  );
};

export default OrdersPage;
