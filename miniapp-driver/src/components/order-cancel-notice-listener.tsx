import { FC, useEffect } from "react";
import { useSnackbar } from "zmp-ui";
import { initSocket } from "services/socket";

type CancelNoticePayload = {
  orderId?: string;
  action?: string;
  cancelReason?: string;
};

const formatOrderRef = (orderId?: string) => {
  if (!orderId) return "";
  return orderId.length <= 8 ? orderId : orderId.slice(-8);
};

const buildNoticeMessage = (payload: CancelNoticePayload) => {
  const orderRef = formatOrderRef(payload.orderId);
  const reason = (payload.cancelReason || "").trim();
  if (!reason) return "";

  if (payload.action === "CANCEL_REQUESTED") {
    return `Khách yêu cầu huỷ đơn #${orderRef}: ${reason}`;
  }
  if (payload.action === "CANCEL_REQUEST_REJECTED") {
    return `Yêu cầu huỷ đơn #${orderRef} đã bị từ chối: ${reason}`;
  }
  if (payload.action === "CANCEL_REQUEST_APPROVED" || payload.action === "ORDER_CANCELLED") {
    return `Đơn #${orderRef} đã huỷ: ${reason}`;
  }
  if (payload.action === "DRIVER_RELEASED") {
    return `Đơn #${orderRef} đã được nhả lại hệ thống: ${reason}`;
  }
  if (payload.action === "DELIVERY_FAILED") {
    return `Báo giao thất bại cho đơn #${orderRef}: ${reason}`;
  }

  return `Cập nhật huỷ đơn #${orderRef}: ${reason}`;
};

export const OrderCancelNoticeListener: FC = () => {
  const snackbar = useSnackbar();

  useEffect(() => {
    let active = true;
    let socketRef: any = null;
    let handlerRef: ((payload: CancelNoticePayload) => void) | null = null;

    const start = async () => {
      const socket = await initSocket();
      if (!active || !socket) return;
      socketRef = socket;

      const handleNotice = (payload: CancelNoticePayload) => {
        const message = buildNoticeMessage(payload);
        if (!message) return;
        snackbar.openSnackbar({ type: "info", text: message });
      };

      handlerRef = handleNotice;
      socket.on("order_cancellation_notice", handleNotice);
    };

    void start();

    return () => {
      active = false;
      if (socketRef && handlerRef) {
        socketRef.off("order_cancellation_notice", handlerRef);
      }
    };
  }, [snackbar]);

  return null;
};
