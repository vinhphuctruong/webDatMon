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
    return `Bạn đã từ chối huỷ đơn #${orderRef}: ${reason}`;
  }
  if (payload.action === "CANCEL_REQUEST_APPROVED") {
    return `Bạn đã duyệt huỷ đơn #${orderRef}: ${reason}`;
  }
  if (payload.action === "ORDER_CANCELLED") {
    return `Đơn #${orderRef} đã bị huỷ: ${reason}`;
  }
  if (payload.action === "DRIVER_RELEASED") {
    return `Tài xế nhả đơn #${orderRef}: ${reason}`;
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

