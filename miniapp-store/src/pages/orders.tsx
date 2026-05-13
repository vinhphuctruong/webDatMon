import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Page, Box, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { vibrate as zmpVibrate } from "zmp-sdk";
import {
  approveOrderCancelRequest,
  cancelOrder,
  confirmStoreOrder,
  fetchStoreOrders,
  markStoreOrderReady,
  rejectOrderCancelRequest,
} from "services/api";
import { formatCurrency } from "utils/formatter";
import { formatStoreOrderCode } from "utils/order-code";

const OrdersPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("PENDING");
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const knownPendingOrderIdsRef = useRef<Set<string>>(new Set());
  const didBootstrapOrdersRef = useRef(false);

  const [promptState, setPromptState] = useState<{
    title: string;
    defaultValue: string;
    onConfirm: (val: string) => void;
    onCancel: () => void;
  } | null>(null);

  const requestReason = (title: string, defaultReason: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
        title,
        defaultValue: defaultReason,
        onConfirm: (val) => {
          setPromptState(null);
          resolve(val);
        },
        onCancel: () => {
          setPromptState(null);
          resolve(null);
        },
      });
    });
  };

  const playNewOrderAlert = useCallback(async () => {
    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.24, ctx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      }
    } catch (_error) {
      // Ignore tone failures on restricted webviews
    }

    try {
      await zmpVibrate({ type: "oneShot", milliseconds: 280 });
    } catch (_error) {
      try {
        if (navigator.vibrate) {
          navigator.vibrate([180, 90, 180]);
        }
      } catch (_fallbackError) {
        // Ignore haptic failures
      }
    }
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await fetchStoreOrders({ limit: 50 });
      const nextOrders = response.data || [];
      setOrders(nextOrders);

      const pendingOrders = nextOrders.filter((order: any) => order.status === "PENDING");
      const nextPendingIds = new Set<string>(pendingOrders.map((order: any) => order.id));

      if (didBootstrapOrdersRef.current) {
        const previousPendingIds = knownPendingOrderIdsRef.current;
        const newPendingOrders = pendingOrders.filter((order: any) => !previousPendingIds.has(order.id));
        if (newPendingOrders.length > 0) {
          const newestOrder = newPendingOrders[0];
          openSnackbar({
            text: `Có đơn mới #${formatStoreOrderCode(newestOrder)}`,
            type: "success",
          });
          playNewOrderAlert();
        }
      }

      knownPendingOrderIdsRef.current = nextPendingIds;
      didBootstrapOrdersRef.current = true;
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

  const handleAction = async (orderId: string, action: "CONFIRM" | "READY" | "REJECT") => {
    try {
      if (action === "CONFIRM") {
        await confirmStoreOrder(orderId);
        openSnackbar({ text: "Đã nhận đơn", type: "success" });
      } else if (action === "REJECT") {
        const target = orders.find((order) => order.id === orderId);
        if (target?.cancelRequestStatus === "PENDING") {
          const reason = await requestReason("Nhập lý do từ chối yêu cầu hủy", "Quán từ chối yêu cầu huỷ");
          if (!reason) return;
          await rejectOrderCancelRequest(orderId, reason);
          openSnackbar({ text: "Đã từ chối yêu cầu huỷ", type: "success" });
        } else {
          const reason = await requestReason("Nhập lý do từ chối đơn", "Quán từ chối đơn");
          if (!reason) return;
          await cancelOrder(orderId, reason);
          openSnackbar({ text: "Đã từ chối đơn", type: "success" });
        }
      } else {
        await markStoreOrderReady(orderId);
        openSnackbar({ text: "Đã báo sẵn sàng", type: "success" });
      }
      loadOrders();
    } catch (error: any) {
      openSnackbar({ text: error.message || "Có lỗi xảy ra", type: "error" });
    }
  };

  const orderIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((order, index) => {
      if (order?.id) map.set(order.id, index);
    });
    return map;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const list = activeTab === "ALL" ? [...orders] : orders.filter((o) => o.status === activeTab);
    return list.sort((a, b) => {
      const aHasCancelRequest = a?.cancelRequestStatus === "PENDING";
      const bHasCancelRequest = b?.cancelRequestStatus === "PENDING";
      if (aHasCancelRequest !== bHasCancelRequest) {
        return aHasCancelRequest ? -1 : 1;
      }
      return (orderIndexMap.get(a?.id) ?? Number.MAX_SAFE_INTEGER) - (orderIndexMap.get(b?.id) ?? Number.MAX_SAFE_INTEGER);
    });
  }, [orders, activeTab, orderIndexMap]);

  const tabItems = useMemo(
    () => [
      { key: "PENDING", label: `Mới (${orders.filter((o) => o.status === "PENDING").length})` },
      { key: "CONFIRMED", label: `Chuẩn bị (${orders.filter((o) => o.status === "CONFIRMED").length})` },
      { key: "PREPARING", label: `Chờ tài xế (${orders.filter((o) => o.status === "PREPARING").length})` },
      { key: "PICKED_UP", label: "Đang giao" },
      { key: "DELIVERED", label: "Hoàn thành" },
    ],
    [orders],
  );

  return (
    <Page className="page-with-bg pb-20">
      <Box className="tm-page-topbar tm-page-safe-top">
        <div className="tm-page-topbar-title">
          <Text.Title style={{ marginBottom: 0 }}>Quản lý Đơn hàng</Text.Title>
        </div>
      </Box>
      <Box p={4} pb={0} className="tm-content-pad" style={{ background: "#fff" }}>
        <div
          style={{
            display: "flex",
            overflowX: "auto",
            overflowY: "hidden",
            gap: 8,
            paddingBottom: 2,
            borderBottom: "1px solid var(--tm-border)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {tabItems.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="tm-interactive"
                style={{
                  flex: "0 0 auto",
                  border: "none",
                  background: "transparent",
                  color: active ? "var(--tm-primary)" : "var(--tm-text-secondary)",
                  fontWeight: active ? 700 : 600,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  padding: "10px 6px 11px",
                  borderBottom: active ? "2px solid var(--tm-primary)" : "2px solid transparent",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </Box>

      <Box p={4} className="tm-content-pad">
        {loading && orders.length === 0 ? (
          <Text style={{ textAlign: "center", color: "var(--tm-text-secondary)", marginTop: 20 }}>Đang tải...</Text>
        ) : filteredOrders.length === 0 ? (
          <Text style={{ textAlign: "center", color: "var(--tm-text-secondary)", marginTop: 20 }}>Không có đơn hàng nào.</Text>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filteredOrders.map((order) => {
              const orderCode = formatStoreOrderCode(order);
              const hasCancelRequest = order.cancelRequestStatus === "PENDING";
              const canAcceptOrder = order.status === "PENDING" && !hasCancelRequest;
              const canMarkReady = order.status === "CONFIRMED";
              const canStoreCancel = (order.status === "CONFIRMED" || order.status === "PREPARING") && !hasCancelRequest;
              return (
              <div 
                key={order.id} 
                className="tm-card tm-interactive animate-slide-up" 
                style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, border: "none", boxShadow: "var(--tm-shadow-md)" }}
                onClick={() => navigate(`/order-detail/${order.id}`)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text.Title style={{ fontSize: 16 }}>Đơn #{orderCode}</Text.Title>
                  <Text style={{ fontWeight: 800, color: "var(--tm-primary)", fontSize: 18 }}>{formatCurrency(order.total)}</Text>
                </div>
                
                <div style={{ paddingBottom: 12, borderBottom: "1px dashed var(--tm-border)" }}>
                  <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
                     {new Date(order.createdAt).toLocaleString("vi-VN")}
                  </Text>
                  <Text size="small" style={{ fontWeight: 600, color: "var(--tm-text-primary)" }}>
                     {order.items.length} món
                  </Text>
                </div>

                {hasCancelRequest && (
                  <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 12 }}>
                    <Text style={{ fontWeight: 700, color: "#9a3412", marginBottom: 3 }}>
                      Khách đang yêu cầu huỷ đơn
                    </Text>
                    <Text size="xSmall" style={{ color: "#9a3412", marginBottom: 10 }}>
                      Đơn này được ưu tiên xử lý. Sau khi từ chối, đơn sẽ trở về vị trí ban đầu.
                    </Text>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <button
                        className="tm-interactive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(order.id, "REJECT");
                        }}
                        style={{
                          padding: "11px",
                          borderRadius: 12,
                          background: "#fff",
                          color: "#374151",
                          fontWeight: 700,
                          border: "1px solid #d1d5db",
                        }}
                      >
                        Giữ đơn
                      </button>
                      <button
                        className="tm-interactive"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const reason = await requestReason("Nhập lý do duyệt hủy", "Quán duyệt yêu cầu huỷ");
                          if (!reason) return;
                          try {
                            await approveOrderCancelRequest(order.id, reason);
                            openSnackbar({ text: "Đã duyệt yêu cầu huỷ", type: "success" });
                            loadOrders();
                          } catch (error: any) {
                            openSnackbar({ text: error.message || "Có lỗi xảy ra", type: "error" });
                          }
                        }}
                        style={{
                          padding: "11px",
                          borderRadius: 12,
                          background: "#ef4444",
                          color: "#fff",
                          fontWeight: 700,
                          border: "none",
                        }}
                      >
                        Duyệt huỷ
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {canAcceptOrder && (
                    <>
                      <button 
                        className="tm-interactive"
                        onClick={(e) => { e.stopPropagation(); handleAction(order.id, "REJECT"); }}
                        style={{ flex: "1 1 auto", minWidth: 100, padding: "12px", borderRadius: 12, background: "#fff", color: "#b91c1c", fontWeight: 700, border: "1px solid #fca5a5" }}
                      >
                        Từ chối
                      </button>
                      <button 
                        className="tm-interactive"
                        onClick={(e) => { e.stopPropagation(); handleAction(order.id, "CONFIRM"); }}
                        style={{ flex: "1 1 auto", minWidth: 100, padding: "12px", borderRadius: 12, background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))", color: "#fff", fontWeight: 700, border: "none", boxShadow: "var(--tm-shadow-floating)" }}
                      >
                        Nhận đơn
                      </button>
                    </>
                  )}
                  {canMarkReady && (
                    <button 
                      className="tm-interactive"
                      onClick={(e) => { e.stopPropagation(); handleAction(order.id, "READY"); }}
                      style={{ flex: "1 1 auto", minWidth: 100, padding: "12px", borderRadius: 12, background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))", color: "#fff", fontWeight: 700, border: "none", boxShadow: "var(--tm-shadow-floating)" }}
                    >
                      Báo xong
                    </button>
                  )}
                  {canStoreCancel && (
                    <button
                      className="tm-interactive"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const reason = await requestReason(
                          "Nhập lý do hủy đơn",
                          "Quán huỷ đơn trước khi tài xế lấy hàng",
                        );
                        if (!reason) return;
                        try {
                          await cancelOrder(order.id, reason);
                          openSnackbar({ text: "Đã huỷ đơn", type: "success" });
                          loadOrders();
                        } catch (error: any) {
                          openSnackbar({ text: error.message || "Có lỗi xảy ra", type: "error" });
                        }
                      }}
                      style={{
                        flex: "1 1 auto",
                        minWidth: 100,
                        padding: "12px",
                        borderRadius: 12,
                        background: "#fff",
                        color: "#dc2626",
                        fontWeight: 700,
                        border: "1px solid #fca5a5",
                      }}
                    >
                      Huỷ đơn bởi quán
                    </button>
                  )}
                  <button
                    className="tm-interactive"
                    style={{ marginLeft: "auto", minWidth: 88, padding: "12px", borderRadius: 12, background: "var(--tm-bg)", color: "var(--tm-text-primary)", fontWeight: 600, border: "none" }}
                  >
                    Chi tiết
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </Box>

      {promptState && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 14000,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 340,
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <Text.Title style={{ fontSize: 18, marginBottom: 12, textAlign: "center" }}>
              {promptState.title}
            </Text.Title>
            <textarea
              autoFocus
              id="promptInput"
              defaultValue={promptState.defaultValue}
              rows={3}
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid var(--tm-border)",
                padding: "12px",
                outline: "none",
                resize: "none",
                fontSize: 15,
                background: "#f9fafb",
                boxSizing: "border-box",
                marginBottom: 16,
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={promptState.onCancel}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  const val = (document.getElementById("promptInput") as HTMLTextAreaElement).value.trim();
                  if (val.length < 2) {
                    openSnackbar({ text: "Lý do phải từ 2 ký tự", type: "warning" });
                    return;
                  }
                  promptState.onConfirm(val);
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 12,
                  border: "none",
                  background: "var(--tm-primary)",
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
};

export default OrdersPage;
