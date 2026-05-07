import React, { FC, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Box, Modal, Text, useSnackbar } from "zmp-ui";
import { initSocket } from "services/socket";
import { DisplayPrice } from "components/display/price";
import { requestNotificationPermission, showNativeNotification } from "utils/notification";
import { cancelOrder, confirmStoreOrder } from "services/api";

type StoreOrderAction = "accept" | "reject";

export const IncomingStoreOrderAlert: FC = () => {
  const navigate = useNavigate();
  const snackbar = useSnackbar();

  const [incomingOrder, setIncomingOrder] = useState<any | null>(null);
  const [processingAction, setProcessingAction] = useState<StoreOrderAction | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  useEffect(() => {
    const hasSession = !!localStorage.getItem("zaui_food_session");
    if (!hasSession) return;

    requestNotificationPermission();

    if (!audioRef.current) {
      audioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      audioRef.current.loop = true;
    }

    const socket = initSocket();
    if (!socket) return;

    const handleNewOrder = (order: any) => {
      setIncomingOrder(order);
      setProcessingAction(null);

      if (audioRef.current) {
        audioRef.current.play().catch(() => undefined);
      }

      if (navigator.vibrate) {
        navigator.vibrate([200, 120, 200]);
      }

      const isAutoAccepted = order?.status === "CONFIRMED";
      showNativeNotification(
        isAutoAccepted ? "🔔 Quán có đơn mới (đã tự nhận)" : "🔔 Quán có đơn mới!",
        {
          body: `Đơn #${order.id?.slice(0, 8)} • ${order.total?.toLocaleString("vi-VN")}đ`,
        },
      );
    };

    socket.on("new_order_to_store", handleNewOrder);

    return () => {
      socket.off("new_order_to_store", handleNewOrder);
      stopAudio();
    };
  }, [stopAudio]);

  const closeAlert = () => {
    stopAudio();
    setProcessingAction(null);
    setIncomingOrder(null);
  };

  const handleViewOrder = () => {
    if (incomingOrder?.id) {
      navigate(`/order-detail/${incomingOrder.id}`);
    } else {
      navigate("/orders");
    }
    closeAlert();
  };

  const handleOrderAction = async (action: StoreOrderAction) => {
    if (!incomingOrder?.id || processingAction) return;
    setProcessingAction(action);

    try {
      if (action === "accept") {
        await confirmStoreOrder(incomingOrder.id);
        snackbar.openSnackbar({ type: "success", text: "Đã nhận đơn mới" });
      } else {
        await cancelOrder(incomingOrder.id, "Quán từ chối đơn");
        snackbar.openSnackbar({ type: "success", text: "Đã từ chối đơn mới" });
      }
      closeAlert();
      navigate("/orders");
    } catch (error: any) {
      snackbar.openSnackbar({
        type: "error",
        text: error?.message || "Không xử lý được đơn hàng",
      });
      setProcessingAction(null);
    }
  };

  const isPending = incomingOrder?.status === "PENDING";

  return (
    <Modal
      visible={!!incomingOrder}
      title=""
      onClose={closeAlert}
      className="tm-glass"
      style={{ borderRadius: 20 }}
    >
      <Box p={4} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div
          className="animate-pulse-soft"
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--tm-primary-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            marginBottom: 16,
          }}
        >
          🔔
        </div>
        <Text style={{ fontWeight: 800, marginBottom: 8, fontSize: 18, color: "var(--tm-text-primary)" }}>
          Đơn hàng mới!
        </Text>
        <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
          Mã đơn: #{incomingOrder?.id?.slice(0, 8)}
        </Text>
        <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
          Số lượng: <Text style={{ fontWeight: 700 }}>{incomingOrder?.items?.length || 0}</Text> món
        </Text>
        <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 12 }}>
          {isPending ? "Cần xác nhận thủ công" : "Đơn đã được tự động nhận"}
        </Text>

        <div style={{ background: "var(--tm-bg)", padding: "12px 24px", borderRadius: 16, marginBottom: 20 }}>
          <Text size="small" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>Tổng tiền</Text>
          <Text style={{ color: "var(--tm-primary)", fontWeight: 800, fontSize: 20 }}>
            <DisplayPrice>{incomingOrder?.total || 0}</DisplayPrice>
          </Text>
        </div>

        {isPending ? (
          <div style={{ display: "flex", gap: 12, width: "100%" }}>
            <button
              className="tm-interactive"
              onClick={() => handleOrderAction("reject")}
              disabled={processingAction !== null}
              style={{
                flex: 1,
                border: "1px solid #fecdd3",
                borderRadius: 14,
                background: "#fff1f2",
                color: "#e11d48",
                padding: "12px",
                fontWeight: 700,
                fontSize: 14,
                opacity: processingAction ? 0.7 : 1,
              }}
            >
              {processingAction === "reject" ? "Đang xử lý..." : "Từ chối"}
            </button>
            <button
              className="tm-interactive"
              onClick={() => handleOrderAction("accept")}
              disabled={processingAction !== null}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 14,
                background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))",
                color: "#fff",
                padding: "12px",
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "var(--tm-shadow-floating)",
                opacity: processingAction ? 0.7 : 1,
              }}
            >
              {processingAction === "accept" ? "Đang nhận..." : "Nhận đơn"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, width: "100%" }}>
            <button
              className="tm-interactive"
              onClick={closeAlert}
              style={{
                flex: 1,
                border: "1px solid var(--tm-border)",
                borderRadius: 14,
                background: "#fff",
                padding: "12px",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Đóng
            </button>
            <button
              className="tm-interactive"
              onClick={handleViewOrder}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 14,
                background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))",
                color: "#fff",
                padding: "12px",
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "var(--tm-shadow-floating)",
              }}
            >
              Xem đơn
            </button>
          </div>
        )}
      </Box>
    </Modal>
  );
};
