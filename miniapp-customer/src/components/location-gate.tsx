import React, { FC, useState, useCallback } from "react";
import { Text } from "zmp-ui";
import { useRecoilState, useSetRecoilState } from "recoil";
import { requestLocationTriesState, manualCustomerLocationState, customerAddressTextState } from "state";
import { getLocation } from "zmp-sdk";
import { isWithinThuDauMotServiceArea, reverseGeocode } from "utils/location";

interface LocationGateProps {
  children: React.ReactNode;
  /** "blocking" = full-screen gate, "inline" = small prompt banner */
  mode?: "blocking" | "inline";
  /** Custom message */
  message?: string;
}

/**
 * LocationGate: ShopeeFood-style component that gates map/checkout features
 * behind a confirmed delivery location (GPS or manual address pick).
 * 
 * If user has no location set, shows a prompt to either:
 * 1. Allow GPS access
 * 2. Pick address manually on map
 */
export const LocationGate: FC<LocationGateProps> = ({ 
  children, 
  mode = "blocking",
  message = "Cho phép truy cập vị trí để tìm quán gần bạn và tính phí giao hàng chính xác",
}) => {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const setLocationTries = useSetRecoilState(requestLocationTriesState);
  const [manualLocation, setManualLocation] = useRecoilState(manualCustomerLocationState);
  const setAddressText = useSetRecoilState(customerAddressTextState);

  // Already have a manual location = GPS confirmed or address picked
  const hasLocation = !!manualLocation;

  const requestGPS = useCallback(async () => {
    setRequesting(true);
    setError("");

    const applyCoords = async (lat: number, lng: number) => {
      if (isWithinThuDauMotServiceArea(lat, lng)) {
        setManualLocation({ latitude: String(lat), longitude: String(lng) });
        try {
          const address = await reverseGeocode(lat, lng);
          if (address) setAddressText(address);
        } catch {
          setAddressText(`Vị trí GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}), Bình Dương`);
        }
        return true;
      } else {
        setError("Vị trí của bạn ngoài khu vực phục vụ (Bình Dương). Vui lòng chọn địa chỉ giao hàng thủ công.");
        return false;
      }
    };

    try {
      setLocationTries(prev => prev + 1);
      let resolved = false;

      // 1. Try Zalo SDK first (with timeout)
      try {
        const zaloPromise = getLocation({ fail: console.warn });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 4000)
        );
        const result = await Promise.race([zaloPromise, timeoutPromise]) as any;
        if (result?.latitude && result?.longitude) {
          resolved = await applyCoords(Number(result.latitude), Number(result.longitude));
        }
      } catch {
        // Zalo SDK failed or timed out — try fallback
      }

      // 2. Fallback: HTML5 Geolocation API
      if (!resolved && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true, timeout: 8000, maximumAge: 0,
            });
          });
          resolved = await applyCoords(pos.coords.latitude, pos.coords.longitude);
        } catch {
          // HTML5 also failed
        }
      }

      if (!resolved && !error) {
        setError("Không thể lấy vị trí GPS. Hãy kiểm tra:\n• Đã bật Định vị trên thiết bị\n• Đã cấp quyền vị trí cho Zalo/trình duyệt\nHoặc chọn địa chỉ thủ công bên dưới");
      }
    } catch (err) {
      console.warn("GPS request failed:", err);
      setError("Không thể truy cập GPS. Vui lòng chọn địa chỉ thủ công.");
    } finally {
      setRequesting(false);
    }
  }, [setLocationTries, setManualLocation, setAddressText]);

  // If user already has a location, render children directly
  if (hasLocation) {
    return <>{children}</>;
  }

  // Inline mode: small banner
  if (mode === "inline") {
    return (
      <div style={{
        background: "linear-gradient(135deg, #fff7ed, #fef3c7)",
        border: "1px solid #fbbf24",
        borderRadius: 12,
        padding: "12px 14px",
        margin: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <span style={{ fontSize: 22 }}>📍</span>
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: "#92400e", lineHeight: 1.4 }}>
            Chưa có vị trí giao hàng
          </Text>
          <Text style={{ fontSize: 11, color: "#a16207", marginTop: 2 }}>
            Bật định vị hoặc chọn địa chỉ để xem phí ship
          </Text>
        </div>
        <button
          onClick={requestGPS}
          disabled={requesting}
          style={{
            padding: "6px 12px", borderRadius: 8, border: "none",
            background: "#f59e0b", color: "#fff", fontSize: 11,
            fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            fontFamily: "Inter, sans-serif",
            opacity: requesting ? 0.6 : 1,
          }}
        >
          {requesting ? "..." : "Bật GPS"}
        </button>
      </div>
    );
  }

  // Blocking mode: full-screen overlay
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--tm-bg, #f7f8fa)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      textAlign: "center",
    }}>
      {/* Location illustration */}
      <div style={{
        width: 120, height: 120, borderRadius: "50%",
        background: "linear-gradient(135deg, #e8f5e9, #c8e6c9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 56, marginBottom: 24,
        boxShadow: "0 8px 32px rgba(0, 169, 109, 0.15)",
        animation: "tm-marker-pulse 2s ease-in-out infinite",
      }}>
        📍
      </div>

      <Text style={{ fontSize: 20, fontWeight: 800, color: "var(--tm-text-primary)", marginBottom: 8 }}>
        Cho phép truy cập vị trí
      </Text>

      <Text style={{
        fontSize: 13, color: "var(--tm-text-secondary)",
        maxWidth: 280, lineHeight: 1.6, marginBottom: 24,
      }}>
        {message}
      </Text>

      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 10, padding: "10px 14px", marginBottom: 16,
          maxWidth: 320,
        }}>
          <Text style={{ fontSize: 12, color: "#dc2626", lineHeight: 1.4 }}>{error}</Text>
        </div>
      )}

      {/* Primary: GPS */}
      <button
        onClick={requestGPS}
        disabled={requesting}
        style={{
          width: "100%", maxWidth: 300,
          padding: "14px 0", borderRadius: 14, border: "none",
          background: requesting
            ? "#e5e7eb"
            : "linear-gradient(135deg, var(--tm-primary, #00a96d) 0%, #00c97d 100%)",
          color: requesting ? "#999" : "#fff",
          fontSize: 15, fontWeight: 700, cursor: requesting ? "wait" : "pointer",
          fontFamily: "Inter, sans-serif",
          boxShadow: requesting ? "none" : "0 4px 16px rgba(0, 169, 109, 0.3)",
          marginBottom: 12,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {requesting ? (
          <>⏳ Đang lấy vị trí...</>
        ) : (
          <>🛰️ Sử dụng vị trí hiện tại</>
        )}
      </button>

      {/* Secondary: Manual pick */}
      <button
        onClick={() => {
          // Navigate to the map address picker  
          window.location.href = "#/addresses";
        }}
        style={{
          width: "100%", maxWidth: 300,
          padding: "12px 0", borderRadius: 14,
          border: "1.5px solid var(--tm-border, #e5e7eb)",
          background: "#fff",
          color: "var(--tm-text-primary, #1a1a1a)",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        🗺️ Chọn địa chỉ trên bản đồ
      </button>

      <Text style={{ fontSize: 11, color: "var(--tm-text-muted, #bbb)", marginTop: 16, maxWidth: 260 }}>
        Thông tin vị trí chỉ được sử dụng để tính phí giao hàng và tìm quán gần bạn
      </Text>
    </div>
  );
};
