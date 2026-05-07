import React, { FC, useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { Box, Modal, Text, useSnackbar } from "zmp-ui";
import { initSocket, getSocket } from "services/socket";
import { DisplayPrice } from "components/display/price";
import { requestNotificationPermission, showNativeNotification } from "utils/notification";

export const IncomingStoreOrderAlert: FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  
  const [incomingOrder, setIncomingOrder] = useState<any | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop playing audio when unmounting or dismissed
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  useEffect(() => {
    // Only listen if logged in
    const hasSession = !!localStorage.getItem("zaui_food_session");
    if (!hasSession) return;

    // Yêu cầu quyền Notification
    requestNotificationPermission();

    // Create audio instance once
    if (!audioRef.current) {
      // Assuming we have a bell sound in public/assets or we can use a base64
      // Use a standard short bell or beep sound, looping
      audioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      audioRef.current.loop = true;
    }

    const socket = initSocket();
    if (!socket) return;

    const handleNewOrder = (order: any) => {
      setIncomingOrder(order);
      // Play sound
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.log("Audio play blocked by browser", e));
      }
      showNativeNotification("🔔 Quán có đơn hàng mới!", {
        body: `Đơn hàng #${order.id?.slice(0, 8)} giá trị ${order.total?.toLocaleString("vi-VN")}đ`,
      });
    };

    socket.on("new_order_to_store", handleNewOrder);

    return () => {
      socket.off("new_order_to_store", handleNewOrder);
      stopAudio();
    };
  }, [stopAudio]);

  const handleDismiss = () => {
    stopAudio();
    setIncomingOrder(null);
  };

  const handleViewOrder = () => {
    stopAudio();
    if (incomingOrder?.id) {
      navigate(`/order-detail/${incomingOrder.id}`);
    } else {
      navigate("/orders");
    }
    setIncomingOrder(null);
  };

  return (
    <Modal
      visible={!!incomingOrder}
      title=""
      onClose={handleDismiss}
      className="tm-glass"
      style={{ borderRadius: 20 }}
    >
      <Box p={4} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div 
          className="animate-pulse-soft"
          style={{ 
            width: 64, height: 64, borderRadius: "50%", background: "var(--tm-primary-light)", 
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32,
            marginBottom: 16
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
        
        <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 12 }}>
          Số lượng: <Text style={{ fontWeight: 700 }}>{incomingOrder?.items?.length || 0}</Text> món
        </Text>

        <div style={{ background: "var(--tm-bg)", padding: "12px 24px", borderRadius: 16, marginBottom: 20 }}>
          <Text size="small" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>Tổng tiền</Text>
          <Text style={{ color: "var(--tm-primary)", fontWeight: 800, fontSize: 20 }}>
            <DisplayPrice>{incomingOrder?.total || 0}</DisplayPrice>
          </Text>
        </div>

        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          <button
            className="tm-interactive"
            onClick={handleDismiss}
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
            Xem ngay
          </button>
        </div>
      </Box>
    </Modal>
  );
};
