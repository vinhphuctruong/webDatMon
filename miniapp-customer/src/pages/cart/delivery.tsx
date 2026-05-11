import { ElasticTextarea } from "components/elastic-textarea";
import { VietMapView, MapMarker } from "components/vietmap";
import React, { FC, Suspense, useMemo } from "react";
import { Box, Text } from "zmp-ui";
import { RequestPersonPickerPhone } from "./person-picker";
import { CustomerLocationPicker, StorePicker } from "./store-picker";
import { TimePicker } from "./time-picker";
import { useRecoilState, useRecoilValueLoadable, useRecoilValue } from "recoil";
import { orderNoteState, selectedStoreState, locationState, cartState } from "state";
import { THU_DAU_MOT_CENTER, calculateDistance, calculateETA, displayDistance } from "utils/location";

const DeliveryRow: FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <div style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '14px 0',
    borderBottom: '1px solid var(--tm-border)',
  }}>
    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

const DeliveryMap: FC = () => {
  const selectedStore = useRecoilValueLoadable(selectedStoreState);
  const userLocation = useRecoilValueLoadable(locationState);

  // Check if user has a real confirmed location
  const hasRealLocation = userLocation.state === "hasValue" && userLocation.contents !== null;

  // If no real location, show a prompt instead of a fake map
  if (!hasRealLocation) {
    return (
      <div style={{
        height: 180, borderRadius: 12,
        background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
        border: '1.5px dashed #86efac',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, marginBottom: 8, padding: 16, textAlign: 'center',
      }}>
        <span style={{ fontSize: 40 }}></span>
        <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--tm-text-primary)' }}>
          Chưa có vị trí giao hàng
        </Text>
        <Text style={{ fontSize: 12, color: 'var(--tm-text-secondary)', lineHeight: 1.4, maxWidth: 240 }}>
          Vui lòng chọn địa chỉ giao hàng bên dưới để hiển thị bản đồ và tính phí ship chính xác
        </Text>
      </div>
    );
  }

  const customerLat = parseFloat(String(userLocation.contents!.latitude));
  const customerLng = parseFloat(String(userLocation.contents!.longitude));

  const storeLat = selectedStore.state === "hasValue" && selectedStore.contents
    ? selectedStore.contents.lat : THU_DAU_MOT_CENTER.lat;
  const storeLng = selectedStore.state === "hasValue" && selectedStore.contents
    ? selectedStore.contents.long : THU_DAU_MOT_CENTER.lng;
  const storeName = selectedStore.state === "hasValue" && selectedStore.contents
    ? selectedStore.contents.name : "TM Food - Thủ Dầu Một";

  const markers = useMemo<MapMarker[]>(() => {
    const result: MapMarker[] = [];

    // Customer
    result.push({
      lat: customerLat, lng: customerLng,
      label: "Vị trí của bạn", type: "customer",
    });

    // Store
    result.push({
      lat: storeLat, lng: storeLng,
      label: storeName, type: "store",
    });

    return result;
  }, [customerLat, customerLng, storeLat, storeLng, storeName]);

  const center = useMemo<[number, number]>(() => {
    return [storeLng, storeLat];
  }, [storeLng, storeLat]);

  const distance = calculateDistance(customerLat, customerLng, storeLat, storeLng);
  const eta = calculateETA(distance);

  return (
    <div style={{ position: "relative" }}>
      <VietMapView
        center={center}
        zoom={14}
        markers={markers}
        height={220}
        showRoute={true}
        onMarkerClick={() => {}}
        style={{ margin: '0 0 8px', borderRadius: 12, border: '1px solid var(--tm-border)' }}
      />
      {/* ETA Overlay */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        padding: '8px 12px', borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column', gap: 2,
        border: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontSize: 11, color: 'var(--tm-text-secondary)', fontWeight: 600 }}>Dự kiến giao hàng</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tm-primary)' }}>{eta}</div>
        <div style={{ fontSize: 10, color: 'var(--tm-text-tertiary)' }}>{displayDistance(distance)} từ quán đến bạn</div>
      </div>
      {/* Legend */}
      <div style={{
        display: 'flex', gap: 12, padding: '6px 4px', flexWrap: 'wrap',
      }}>
        <LegendItem emoji="" color="#4285f4" label="Bạn" />
        <LegendItem emoji="" color="#00a96d" label="Quán" />
      </div>
    </div>
  );
};

const LegendItem: FC<{ emoji: string; color: string; label: string }> = ({ emoji, color, label }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 11, color: 'var(--tm-text-secondary)',
  }}>
    <span style={{
      width: 14, height: 14, borderRadius: '50%',
      background: color, border: '2px solid #fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8,
    }}>{emoji}</span>
    <span style={{ fontWeight: 500 }}>{label}</span>
  </div>
);

const SHOW_DELIVERY_MAP = true;

export const Delivery: FC = () => {
  const [note, setNote] = useRecoilState(orderNoteState);
  const cart = useRecoilValue(cartState);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("zaui_food_session"));
  }, []);

  if (!isLoggedIn || cart.length === 0) {
    return null;
  }

  return (
    <Box style={{ padding: '16px', background: '#fff' }}>
      <Text style={{ fontWeight: 700, fontSize: 15, color: 'var(--tm-text-primary)', marginBottom: 12 }}>
         Thông tin giao hàng
      </Text>

      {SHOW_DELIVERY_MAP ? (
        <Suspense fallback={
          <div style={{
            height: 220, borderRadius: 12, background: 'var(--tm-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12, border: '1px solid var(--tm-border)',
          }}>
            <Text size="xSmall" style={{ color: 'var(--tm-text-tertiary)' }}> Đang tải bản đồ...</Text>
          </div>
        }>
          <DeliveryMap />
        </Suspense>
      ) : (
        <div
          className="tm-card"
          style={{
            marginBottom: 12,
            border: "1px dashed var(--tm-border)",
            background: "var(--tm-bg)",
            boxShadow: "none",
            padding: "10px 12px",
          }}
        >
          <Text size="xSmall" style={{ color: "var(--tm-text-tertiary)" }}>
             Tạm ẩn bản đồ giao hàng theo yêu cầu.
          </Text>
        </div>
      )}

      <div className="tm-card" style={{ padding: '0 16px', boxShadow: 'none' }}>
        <DeliveryRow icon="">
          <CustomerLocationPicker />
        </DeliveryRow>
        <DeliveryRow icon="">
          <StorePicker />
        </DeliveryRow>
        <DeliveryRow icon="">
          <Box flex className="space-x-2">
            <Box className="flex-1 space-y-[2px]">
              <TimePicker />
              <Text size="xxxSmall" style={{ color: 'var(--tm-text-tertiary)' }}>
                Khung giờ giao dự kiến
              </Text>
            </Box>
          </Box>
        </DeliveryRow>
        <DeliveryRow icon="">
          <RequestPersonPickerPhone />
        </DeliveryRow>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0' }}>
          <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}></span>
          <div style={{ flex: 1 }}>
            <ElasticTextarea
              placeholder="Ghi chú cho quán/tài xế..."
              className="border-none px-0 w-full focus:outline-none"
              maxRows={4}
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
            />
          </div>
        </div>
      </div>
    </Box>
  );
};
