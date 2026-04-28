import React, { FC, useEffect, useState, useCallback } from "react";
import { Box, Page, Text, Header, useSnackbar, Modal } from "zmp-ui";
import { fetchMyOrders, completeOrder, reportFailedDelivery } from "services/driver-api";
import { DisplayPrice } from "components/display/price";

const ActiveDeliveryPage: FC = () => {
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [failModal, setFailModal] = useState<{ orderId: string; visible: boolean }>({ orderId: "", visible: false });
  const [failReason, setFailReason] = useState("");
  const [failing, setFailing] = useState(false);
  const snackbar = useSnackbar();

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetchMyOrders();
      const active = (res.data || []).filter((o: any) =>
        ["PICKED_UP", "CONFIRMED", "PREPARING"].includes(o.status)
      );
      setActiveOrders(active);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleComplete = async (orderId: string) => {
    setCompleting(orderId);
    try {
      await completeOrder(orderId);
      snackbar.openSnackbar({ type: "success", text: "Giao hàng thành công! ✅" });
      loadOrders();
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Lỗi" });
    } finally {
      setCompleting(null);
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
      snackbar.openSnackbar({ type: "error", text: error.message || "Lỗi" });
    } finally {
      setFailing(false);
    }
  };

  const statusLabels: Record<string, string> = {
    PICKED_UP: "🚗 Đang giao",
    CONFIRMED: "✅ Quán đã nhận",
    PREPARING: "🍳 Đang chế biến",
  };

  return (
    <Page className="page-with-bg">
      <Header title="Đơn đang giao" showBackIcon />
      <Box style={{ padding: 16 }}>
        {loading ? (
          <Box className="flex items-center justify-center" style={{ padding: 48 }}>
            <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
          </Box>
        ) : activeOrders.length === 0 ? (
          <div className="tm-empty-state">
            <span className="tm-empty-icon">🚗</span>
            <Text style={{ fontWeight: 600, marginBottom: 4 }}>Không có đơn đang giao</Text>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
              Vào "Đơn chờ nhận" để nhận đơn mới nhé
            </Text>
          </div>
        ) : (
          activeOrders.map((order) => (
            <div key={order.id} className="tm-order-card animate-slide-up">
              {/* Status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{
                  background: "var(--tm-primary-light)", color: "var(--tm-primary)",
                  padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                }}>
                  {statusLabels[order.status] || order.status}
                </span>
                <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>
                  #{order.id.slice(0, 8)}
                </Text>
              </div>

              {/* Store Info */}
              <div style={{ background: "var(--tm-bg)", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <Text style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🏪 {order.store?.name}</Text>
                <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                  {order.store?.address}
                </Text>
              </div>

              {/* Customer Info */}
              <div style={{ background: "#fffbeb", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <Text style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>📍 Giao tới</Text>
                <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                  {order.deliveryAddress?.receiverName} · {order.deliveryAddress?.phone}
                </Text>
                <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                  {order.deliveryAddress?.street}, {order.deliveryAddress?.ward}, {order.deliveryAddress?.district}
                </Text>
              </div>

              {/* Items */}
              <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 8 }}>
                {order.items?.map((i: any) => `${i.productName} x${i.quantity}`).join(", ")}
              </Text>

              {/* Payment & Actions */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                paddingTop: 12, borderTop: "1px solid var(--tm-border)",
              }}>
                <div>
                  <Text style={{ fontWeight: 700, color: "var(--tm-primary)", fontSize: 16 }}>
                    <DisplayPrice>{order.total || 0}</DisplayPrice>
                  </Text>
                  <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>
                    {order.paymentMethod === "COD" ? "💵 Thu tiền mặt" : "💳 Đã thanh toán online"}
                  </Text>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setFailModal({ orderId: order.id, visible: true })}
                    style={{
                      background: "#fef2f2", color: "var(--tm-danger)",
                      border: "none", borderRadius: 10, padding: "8px 14px",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Thất bại
                  </button>
                  <button
                    onClick={() => handleComplete(order.id)}
                    disabled={completing === order.id}
                    style={{
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      color: "#fff", border: "none", borderRadius: 10,
                      padding: "8px 20px", fontWeight: 700, fontSize: 13,
                      cursor: "pointer", opacity: completing === order.id ? 0.7 : 1,
                    }}
                  >
                    {completing === order.id ? "..." : "✅ Đã giao"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </Box>

      {/* Failed Delivery Modal */}
      <Modal
        visible={failModal.visible}
        title="Báo giao thất bại"
        onClose={() => setFailModal({ orderId: "", visible: false })}
      >
        <Box p={4}>
          <Text style={{ marginBottom: 12 }}>Lý do giao thất bại:</Text>
          <textarea
            value={failReason}
            onChange={(e) => setFailReason(e.target.value)}
            placeholder="VD: Khách không nghe máy, sai địa chỉ..."
            rows={3}
            style={{
              width: "100%", padding: 12, borderRadius: 8,
              border: "1px solid var(--tm-border)", marginBottom: 16,
            }}
          />
          <button
            onClick={handleFailed}
            disabled={failing}
            style={{
              width: "100%", padding: 12, borderRadius: 12,
              background: "var(--tm-danger)", color: "#fff",
              fontWeight: 600, border: "none", opacity: failing ? 0.7 : 1,
            }}
          >
            {failing ? "Đang xử lý..." : "Xác nhận giao thất bại"}
          </button>
        </Box>
      </Modal>
    </Page>
  );
};

export default ActiveDeliveryPage;
