import React, { useEffect, useState, useMemo } from "react";
import { Page, Box, Text, Tabs, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { fetchStoreOrders, confirmStoreOrder, markStoreOrderReady } from "services/api";
import { formatCurrency } from "utils/formatter";

const OrdersPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("PENDING");
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await fetchStoreOrders({ limit: 50 });
      setOrders(response.data);
    } catch (error: any) {
      openSnackbar({ text: error.message || "Lỗi tải danh sách đơn", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 10000); // Auto refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (orderId: string, action: "CONFIRM" | "READY") => {
    try {
      if (action === "CONFIRM") {
        await confirmStoreOrder(orderId);
        openSnackbar({ text: "Đã nhận đơn", type: "success" });
      } else {
        await markStoreOrderReady(orderId);
        openSnackbar({ text: "Đã báo sẵn sàng", type: "success" });
      }
      loadOrders();
    } catch (error: any) {
      openSnackbar({ text: error.message || "Có lỗi xảy ra", type: "error" });
    }
  };

  const filteredOrders = useMemo(() => {
    if (activeTab === "ALL") return orders;
    return orders.filter(o => o.status === activeTab);
  }, [orders, activeTab]);

  return (
    <Page className="page-with-bg pb-20">
      <Box className="tm-page-topbar tm-page-safe-top">
        <div className="tm-page-topbar-title">
          <Text.Title style={{ marginBottom: 0 }}>Quản lý Đơn hàng</Text.Title>
        </div>
      </Box>
      <Box p={4} pb={0} className="tm-content-pad" style={{ background: "#fff" }}>
        <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k)}>
          <Tabs.Tab key="PENDING" label={`Mới (${orders.filter(o => o.status === "PENDING").length})`} />
          <Tabs.Tab key="CONFIRMED" label={`Chuẩn bị (${orders.filter(o => o.status === "CONFIRMED").length})`} />
          <Tabs.Tab key="PREPARING" label={`Chờ tài xế (${orders.filter(o => o.status === "PREPARING").length})`} />
          <Tabs.Tab key="PICKED_UP" label="Đang giao" />
          <Tabs.Tab key="DELIVERED" label="Hoàn thành" />
        </Tabs>
      </Box>

      <Box p={4} className="tm-content-pad">
        {loading && orders.length === 0 ? (
          <Text style={{ textAlign: "center", color: "var(--tm-text-secondary)", marginTop: 20 }}>Đang tải...</Text>
        ) : filteredOrders.length === 0 ? (
          <Text style={{ textAlign: "center", color: "var(--tm-text-secondary)", marginTop: 20 }}>Không có đơn hàng nào.</Text>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filteredOrders.map(order => (
              <div 
                key={order.id} 
                className="tm-card tm-interactive animate-slide-up" 
                style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, border: "none", boxShadow: "var(--tm-shadow-md)" }}
                onClick={() => navigate(`/order-detail/${order.id}`)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text.Title style={{ fontSize: 16 }}>Đơn #{order.id.slice(-6).toUpperCase()}</Text.Title>
                  <Text style={{ fontWeight: 800, color: "var(--tm-primary)", fontSize: 18 }}>{formatCurrency(order.total)}</Text>
                </div>
                
                <div style={{ paddingBottom: 12, borderBottom: "1px dashed var(--tm-border)" }}>
                  <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
                    🕒 {new Date(order.createdAt).toLocaleString("vi-VN")}
                  </Text>
                  <Text size="small" style={{ fontWeight: 600, color: "var(--tm-text-primary)" }}>
                    📦 {order.items.length} món
                  </Text>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {order.status === "PENDING" && (
                    <button 
                      className="tm-interactive"
                      onClick={(e) => { e.stopPropagation(); handleAction(order.id, "CONFIRM"); }}
                      style={{ flex: "1 1 auto", minWidth: 100, padding: "12px", borderRadius: 12, background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))", color: "#fff", fontWeight: 700, border: "none", boxShadow: "var(--tm-shadow-floating)" }}
                    >
                      Nhận đơn
                    </button>
                  )}
                  {order.status === "CONFIRMED" && (
                    <button 
                      className="tm-interactive"
                      onClick={(e) => { e.stopPropagation(); handleAction(order.id, "READY"); }}
                      style={{ flex: "1 1 auto", minWidth: 100, padding: "12px", borderRadius: 12, background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))", color: "#fff", fontWeight: 700, border: "none", boxShadow: "var(--tm-shadow-floating)" }}
                    >
                      Báo xong
                    </button>
                  )}
                  <button 
                    className="tm-interactive"
                    style={{ flex: order.status === "PENDING" || order.status === "CONFIRMED" ? "0 1 auto" : "1 1 auto", minWidth: 80, padding: "12px", borderRadius: 12, background: "var(--tm-bg)", color: "var(--tm-text-primary)", fontWeight: 600, border: "none" }}
                  >
                    Chi tiết
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

export default OrdersPage;
