import React, { FC, useEffect, useState, useCallback } from "react";
import { Box, Page, Text, Header, useSnackbar } from "zmp-ui";
import { fetchAvailableOrders, claimOrder } from "services/driver-api";
import { DisplayPrice } from "components/display/price";

const AvailableOrdersPage: FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const snackbar = useSnackbar();

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetchAvailableOrders();
      setOrders(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleClaim = async (orderId: string) => {
    setClaiming(orderId);
    try {
      await claimOrder(orderId);
      snackbar.openSnackbar({ type: "success", text: "Nhận đơn thành công! 🎉" });
      loadOrders();
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Nhận đơn thất bại" });
    } finally {
      setClaiming(null);
    }
  };

  return (
    <Page className="page-with-bg">
      <Header title="Đơn chờ nhận" showBackIcon />
      <Box style={{ padding: 16 }}>
        {loading ? (
          <Box className="flex items-center justify-center" style={{ padding: 48 }}>
            <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
          </Box>
        ) : orders.length === 0 ? (
          <div className="tm-empty-state">
            <span className="tm-empty-icon">📭</span>
            <Text style={{ fontWeight: 600, marginBottom: 4 }}>Chưa có đơn nào</Text>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
              Hệ thống sẽ tự động cập nhật khi có đơn mới
            </Text>
          </div>
        ) : (
          <div>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 12 }}>
              {orders.length} đơn đang chờ · Tự cập nhật mỗi 10s
            </Text>
            {orders.map((order) => (
              <div key={order.id} className="tm-order-card animate-fade-in">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <Text style={{ fontWeight: 700, fontSize: 14 }}>
                      🏪 {order.store?.name || "Quán"}
                    </Text>
                    <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>
                      #{order.id.slice(0, 8)}
                    </Text>
                  </div>
                  <span style={{
                    background: order.paymentMethod === "COD" ? "#fef9e7" : "#ecfdf5",
                    color: order.paymentMethod === "COD" ? "var(--tm-warning)" : "var(--tm-success)",
                    padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                  }}>
                    {order.paymentMethod === "COD" ? "💵 COD" : "💳 Online"}
                  </span>
                </div>

                <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
                  {order.items?.map((i: any) => `${i.productName} x${i.quantity}`).join(", ")}
                </Text>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                  <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
                    📍 {order.store?.address?.slice(0, 40) || "Quán đối tác"}
                  </Text>
                </div>

                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--tm-border)",
                }}>
                  <div>
                    <Text style={{ fontWeight: 700, color: "var(--tm-primary)", fontSize: 16 }}>
                      <DisplayPrice>{order.driverPayout || order.deliveryFee || 0}</DisplayPrice>
                    </Text>
                    <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>Thu nhập</Text>
                  </div>
                  <button
                    onClick={() => handleClaim(order.id)}
                    disabled={claiming === order.id}
                    style={{
                      background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))",
                      color: "#fff", border: "none", borderRadius: 12,
                      padding: "10px 24px", fontWeight: 700, fontSize: 14,
                      cursor: "pointer", opacity: claiming === order.id ? 0.7 : 1,
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
    </Page>
  );
};

export default AvailableOrdersPage;
