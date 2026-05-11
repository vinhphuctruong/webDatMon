import { FC, useEffect } from "react";
import { useSnackbar } from "zmp-ui";
import { initSocket } from "services/socket";

type CancelNoticePayload = {
  orderId?: string;
  action?: string;
  actorRole?: string;
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
    return `Yêu cầu huỷ đơn #${orderRef}: ${reason}`;
  }
  if (payload.action === "CANCEL_REQUEST_REJECTED") {
    return `Yêu cầu huỷ đơn #${orderRef} bị từ chối: ${reason}`;
  }
  if (payload.action === "CANCEL_REQUEST_APPROVED" || payload.action === "ORDER_CANCELLED") {
    return `Đơn #${orderRef} đã bị huỷ: ${reason}`;
  }
  if (payload.action === "DRIVER_RELEASED") {
    return `Tài xế đã nhả đơn #${orderRef}: ${reason}`;
  }
  if (payload.action === "DELIVERY_FAILED") {
    return `Đơn #${orderRef} giao thất bại: ${reason}`;
  }

  return `Cập nhật huỷ đơn #${orderRef}: ${reason}`;
};

export const OrderCancelNoticeListener: FC = () => {
  const snackbar = useSnackbar();

  useEffect(() => {
    const socket = initSocket();
    if (!socket) return;

    const handleNotice = (payload: CancelNoticePayload) => {
      const message = buildNoticeMessage(payload);
      if (!message) return;
      snackbar.openSnackbar({ type: "info", text: message });
    };

    socket.on("order_cancellation_notice", handleNotice);
    return () => {
      socket.off("order_cancellation_notice", handleNotice);
    };
  }, [snackbar]);

  return null;
};

