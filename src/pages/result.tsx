import { MapMarker, VietMapView } from "components/vietmap";
import React, { FC, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useRecoilValueLoadable, useResetRecoilState } from "recoil";
import { AsyncCallbackFailObject, CheckTransactionReturns, Payment } from "zmp-sdk";
import { Box, Header, Page, Text, useNavigate } from "zmp-ui";
import { cartState, locationState, selectedStoreState } from "state";
import { DriverDispatchResult } from "services/dispatch";
import { THU_DAU_MOT_CENTER } from "utils/location";

interface TrackingSnapshot {
  customerLat: number;
  customerLng: number;
  storeLat: number;
  storeLng: number;
  storeName: string;
}

interface LocalResultState {
  localOrderStatus: "success" | "failed";
  localOrderMessage?: string;
  localOrderId?: string;
  trackingSnapshot?: TrackingSnapshot;
  dispatchInfo?: DriverDispatchResult;
}

const SHOW_TRACKING_MAP = false;

const getStepStatus = (status: "done" | "active" | "pending") => {
  if (status === "done") {
    return {
      bg: "var(--tm-primary)",
      color: "#fff",
      opacity: 1,
    };
  }

  if (status === "active") {
    return {
      bg: "var(--tm-primary-light)",
      color: "var(--tm-primary)",
      opacity: 1,
    };
  }

  return {
    bg: "var(--tm-border)",
    color: "var(--tm-text-tertiary)",
    opacity: 0.6,
  };
};

const LegendItem: FC<{ emoji: string; color: string; label: string }> = ({ emoji, color, label }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      fontSize: 11,
      color: "var(--tm-text-secondary)",
    }}
  >
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: color,
        border: "2px solid #fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 8,
      }}
    >
      {emoji}
    </span>
    <span style={{ fontWeight: 500 }}>{label}</span>
  </div>
);

const TrackingStep: FC<{ index: number; text: string; status: "done" | "active" | "pending" }> = ({
  index,
  text,
  status,
}) => {
  const ui = getStepStatus(status);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        opacity: ui.opacity,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: ui.bg,
          color: ui.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {status === "done" ? "✓" : index + 1}
      </div>
      <Text size="small" style={{ fontWeight: status !== "pending" ? 600 : 400, color: "var(--tm-text-primary)" }}>
        {text}
      </Text>
    </div>
  );
};

const StatusActionButton: FC<{ text: string; onClick: () => void; secondary?: boolean }> = ({
  text,
  onClick,
  secondary = false,
}) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      padding: "14px 0",
      borderRadius: 14,
      border: secondary ? "2px solid var(--tm-primary)" : "none",
      background: secondary ? "transparent" : "linear-gradient(135deg, var(--tm-primary), #00c97d)",
      color: secondary ? "var(--tm-primary)" : "#fff",
      fontSize: 15,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "Inter, sans-serif",
      boxShadow: secondary ? "none" : "0 4px 16px rgba(0,169,109,0.3)",
    }}
  >
    {text}
  </button>
);

const ResultSummary: FC<{ title: string; message: string; icon: string; color: string }> = ({
  title,
  message,
  icon,
  color,
}) => (
  <Box className="flex-1 flex flex-col justify-center items-center text-center" style={{ padding: "24px" }}>
    <div
      className="animate-float"
      style={{
        width: 96,
        height: 96,
        borderRadius: "50%",
        background: `${color}15`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24,
        fontSize: 48,
      }}
    >
      {icon}
    </div>
    <Text style={{ fontSize: 22, fontWeight: 700, color: "var(--tm-text-primary)", marginBottom: 8 }}>
      {title}
    </Text>
    <Text style={{ color: "var(--tm-text-secondary)", fontSize: 14, lineHeight: "22px", maxWidth: 320 }}>
      {message}
    </Text>
  </Box>
);

const DriverDispatchCard: FC<{ dispatchInfo: DriverDispatchResult }> = ({ dispatchInfo }) => (
  <div className="tm-card" style={{ marginTop: 12, padding: 14 }}>
    <Text style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "var(--tm-text-primary)" }}>
      Tài xế nhận đơn
    </Text>
    <Text size="small" style={{ fontWeight: 600, color: "var(--tm-text-primary)" }}>
      {dispatchInfo.driver.name}
    </Text>
    <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
      SĐT: {dispatchInfo.driver.phone}
    </Text>
    <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
      Phương tiện: {dispatchInfo.driver.vehicleType} · {dispatchInfo.driver.licensePlate}
    </Text>
    <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
      Cách quán: {dispatchInfo.distanceToStoreKm} km
    </Text>
    <div
      style={{
        marginTop: 10,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px dashed var(--tm-border)",
        background: "var(--tm-bg)",
      }}
    >
      <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)" }}>
        Thông báo cho quán: {dispatchInfo.storeNotice}
      </Text>
      <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 4 }}>
        Thông báo cho khách: {dispatchInfo.customerNotice}
      </Text>
      <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 4 }}>
        Nội dung đã gửi tài xế: {dispatchInfo.dispatchMessage}
      </Text>
    </div>
  </div>
);

const OrderTrackingMap: FC<{ snapshot: TrackingSnapshot }> = ({ snapshot }) => {
  const center = useMemo<[number, number]>(() => {
    return [(snapshot.storeLng + snapshot.customerLng) / 2, (snapshot.storeLat + snapshot.customerLat) / 2];
  }, [snapshot]);

  const markers = useMemo<MapMarker[]>(() => {
    const driverProgress = 0.35;
    const driverLat = snapshot.storeLat + (snapshot.customerLat - snapshot.storeLat) * driverProgress;
    const driverLng = snapshot.storeLng + (snapshot.customerLng - snapshot.storeLng) * driverProgress;

    return [
      {
        lat: snapshot.customerLat,
        lng: snapshot.customerLng,
        label: "Vị trí của bạn",
        type: "customer",
      },
      {
        lat: snapshot.storeLat,
        lng: snapshot.storeLng,
        label: snapshot.storeName,
        type: "store",
      },
      {
        lat: driverLat,
        lng: driverLng,
        label: "Tài xế Minh",
        type: "driver",
      },
    ];
  }, [snapshot]);

  return (
    <div className="tm-card" style={{ padding: 12, marginTop: 14 }}>
      <Text style={{ fontWeight: 700, fontSize: 14, color: "var(--tm-text-primary)", marginBottom: 8 }}>
        Bản đồ giao hàng
      </Text>
      <VietMapView
        center={center}
        zoom={14}
        markers={markers}
        height={230}
        showRoute={true}
        style={{ borderRadius: 12, border: "1px solid var(--tm-border)" }}
      />
      <div style={{ display: "flex", gap: 12, padding: "8px 4px 2px", flexWrap: "wrap" }}>
        <LegendItem emoji="📍" color="#4285f4" label="Bạn" />
        <LegendItem emoji="🏪" color="#00a96d" label="Quán" />
        <LegendItem emoji="🏍️" color="#ff6b35" label="Tài xế" />
      </div>
    </div>
  );
};

const CheckoutResultPage: FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const selectedStore = useRecoilValueLoadable(selectedStoreState);
  const userLocation = useRecoilValueLoadable(locationState);
  const [paymentResult, setPaymentResult] = useState<
    CheckTransactionReturns | AsyncCallbackFailObject
  >();

  const localState =
    state &&
    typeof state === "object" &&
    "localOrderStatus" in state &&
    typeof state.localOrderStatus === "string"
      ? (state as LocalResultState)
      : undefined;

  const fallbackTrackingSnapshot = useMemo<TrackingSnapshot>(() => {
    const customerLat =
      userLocation.state === "hasValue" && userLocation.contents
        ? parseFloat(String(userLocation.contents.latitude))
        : THU_DAU_MOT_CENTER.lat;
    const customerLng =
      userLocation.state === "hasValue" && userLocation.contents
        ? parseFloat(String(userLocation.contents.longitude))
        : THU_DAU_MOT_CENTER.lng;

    const storeLat =
      selectedStore.state === "hasValue" && selectedStore.contents
        ? selectedStore.contents.lat
        : THU_DAU_MOT_CENTER.lat;
    const storeLng =
      selectedStore.state === "hasValue" && selectedStore.contents
        ? selectedStore.contents.long
        : THU_DAU_MOT_CENTER.lng;
    const storeName =
      selectedStore.state === "hasValue" && selectedStore.contents
        ? selectedStore.contents.name
        : "TM Food - Thủ Dầu Một";

    return { customerLat, customerLng, storeLat, storeLng, storeName };
  }, [selectedStore.state, selectedStore.contents, userLocation.state, userLocation.contents]);

  const trackingSnapshot = localState?.trackingSnapshot || fallbackTrackingSnapshot;

  useEffect(() => {
    if (localState) {
      setPaymentResult({
        resultCode: localState.localOrderStatus === "success" ? 1 : -1,
      } as CheckTransactionReturns);
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;

    const check = () => {
      let data = state;
      if (data) {
        if ("path" in data) {
          data = data.path;
        } else if ("data" in data) {
          data = data.data;
        }
      } else {
        data = window.location.search.slice(1);
      }

      Payment.checkTransaction({
        data,
        success: (rs) => {
          setPaymentResult(rs);
          if (rs.resultCode === 0) {
            timeout = setTimeout(check, 3000);
          }
        },
        fail: (err) => {
          setPaymentResult(err);
        },
      });
    };

    check();

    return () => {
      clearTimeout(timeout);
    };
  }, [localState]);

  const clearCart = useResetRecoilState(cartState);
  useEffect(() => {
    if (paymentResult?.resultCode >= 0) {
      clearCart();
    }
  }, [paymentResult]);

  const isSuccess = paymentResult?.resultCode === 1;
  const isPending = paymentResult?.resultCode === 0 || !paymentResult;
  const isFailed =
    !!paymentResult &&
    paymentResult.resultCode !== undefined &&
    paymentResult.resultCode !== 0 &&
    paymentResult.resultCode !== 1;

  return (
    <Page className="flex flex-col" style={{ background: "#fff" }}>
      <Header title={isSuccess ? "Theo dõi đơn hàng" : "Trạng thái đơn hàng"} />

      {isSuccess ? (
        <Box className="flex-1" style={{ padding: "16px" }}>
          <div className="tm-card" style={{ padding: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 700, color: "var(--tm-primary)" }}>
              Đặt đơn thành công
            </Text>
            <Text style={{ marginTop: 4, color: "var(--tm-text-secondary)", lineHeight: "22px" }}>
              {localState?.localOrderMessage || "Quán đã nhận đơn. Bạn có thể theo dõi tài xế ngay bên dưới."}
            </Text>
            {localState?.localOrderId && (
              <Text
                size="xSmall"
                style={{
                  marginTop: 8,
                  display: "inline-block",
                  color: "var(--tm-primary)",
                  background: "var(--tm-primary-light)",
                  padding: "4px 8px",
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                Mã đơn: #{localState.localOrderId}
              </Text>
            )}
          </div>

          {SHOW_TRACKING_MAP ? (
            <OrderTrackingMap snapshot={trackingSnapshot} />
          ) : (
            <div
              className="tm-card"
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px dashed var(--tm-border)",
                background: "var(--tm-bg)",
                boxShadow: "none",
              }}
            >
              <Text size="xSmall" style={{ color: "var(--tm-text-tertiary)" }}>
                🗺️ Tạm ẩn bản đồ theo dõi đơn hàng.
              </Text>
            </div>
          )}

          {localState?.dispatchInfo && <DriverDispatchCard dispatchInfo={localState.dispatchInfo} />}

          <div className="tm-card" style={{ marginTop: 12, padding: 14 }}>
            <Text style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "var(--tm-text-primary)" }}>
              Tiến trình đơn hàng
            </Text>
            <TrackingStep index={0} text="Đơn đã xác nhận" status="done" />
            <TrackingStep index={1} text="Quán đang chuẩn bị món" status="active" />
            <TrackingStep index={2} text="Tài xế đang đến quán" status="pending" />
            <TrackingStep index={3} text="Đang giao đến bạn" status="pending" />
          </div>
        </Box>
      ) : isFailed ? (
        <ResultSummary
          title="Đặt đơn thất bại"
          message={
            localState?.localOrderMessage ||
            "Có lỗi trong quá trình xử lý, vui lòng thử lại hoặc liên hệ hỗ trợ."
          }
          icon="❌"
          color="var(--tm-danger)"
        />
      ) : (
        <ResultSummary
          title="Đang xử lý..."
          message="Hệ thống đang kiểm tra thanh toán. Vui lòng chờ trong ít phút..."
          icon="⏳"
          color="var(--tm-warning)"
        />
      )}

      {paymentResult && (
        <div style={{ padding: "16px", display: "flex", gap: 12 }}>
          {isSuccess && (
            <StatusActionButton
              text="Đặt thêm"
              secondary={true}
              onClick={() => navigate("/", { replace: true })}
            />
          )}
          <StatusActionButton
            text={isSuccess ? "Về trang chủ" : isPending ? "Tiếp tục chờ" : "Đóng"}
            onClick={() => navigate("/", { replace: true })}
          />
        </div>
      )}
    </Page>
  );
};

export default CheckoutResultPage;
