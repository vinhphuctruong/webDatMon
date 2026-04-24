import React, { FC } from "react";
import { useRecoilValueLoadable } from "recoil";
import { useNavigate, Text, Box } from "zmp-ui";
import { activeOrdersState } from "state";
import { THU_DAU_MOT_CENTER } from "utils/location";

const getStatusLabel = (status: string) => {
  switch (status) {
    case "PENDING":
      return "Đang chờ xác nhận";
    case "PREPARING":
      return "Đang chuẩn bị món";
    case "DISPATCHING":
      return "Đang tìm tài xế";
    case "READY":
      return "Đang chờ tài xế lấy";
    case "DELIVERING":
      return "Đang giao đến bạn";
    default:
      return "Đang xử lý";
  }
};

export const ActiveOrderBanner: FC = () => {
  const navigate = useNavigate();
  const ordersLoadable = useRecoilValueLoadable(activeOrdersState);

  if (ordersLoadable.state !== "hasValue" || !ordersLoadable.contents.length) {
    return null;
  }

  const activeOrdersCount = ordersLoadable.contents.length;
  const activeOrder = ordersLoadable.contents[0]; // Most recent active order

  return (
    <Box style={{ padding: "0 16px 16px 16px" }}>
      <div
        className="tm-card"
        style={{
          background: "linear-gradient(135deg, var(--tm-primary-light), #e6f7ef)",
          border: "1px solid var(--tm-primary)",
          padding: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
        }}
        onClick={() => {
          if (activeOrdersCount > 1) {
            navigate("/active-orders");
          } else {
            navigate("/result", {
              state: {
                localOrderStatus: "success",
                localOrderId: activeOrder.id.slice(0, 8),
                localOrderMessage: `Đơn #${activeOrder.id.slice(0, 8)} đang được xử lý.`,
                trackingSnapshot: {
                  storeName: activeOrder.store?.name || "TM Food",
                  storeLat: THU_DAU_MOT_CENTER.lat,
                  storeLng: THU_DAU_MOT_CENTER.lng,
                  customerLat: THU_DAU_MOT_CENTER.lat - 0.01,
                  customerLng: THU_DAU_MOT_CENTER.lng + 0.01,
                }
              },
            });
          }
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            background: "#fff",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
          }}
        >
          🛵
        </div>
        <div style={{ flex: 1 }}>
          {activeOrdersCount > 1 ? (
            <>
              <Text style={{ fontWeight: 700, fontSize: 14, color: "var(--tm-text-primary)" }}>
                Bạn có {activeOrdersCount} đơn hàng
              </Text>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
                Đang được giao / xử lý
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontWeight: 700, fontSize: 14, color: "var(--tm-text-primary)" }}>
                Đơn hàng đang giao
              </Text>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
                #{activeOrder.id.slice(0, 8)} · {getStatusLabel(activeOrder.status)}
              </Text>
            </>
          )}
        </div>
        <div style={{ color: "var(--tm-primary)", fontWeight: 700 }}>
          ❯
        </div>
      </div>
    </Box>
  );
};
