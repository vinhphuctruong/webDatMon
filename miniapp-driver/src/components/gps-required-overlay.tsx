import React, { FC, useState, useCallback, useEffect } from "react";
import { Text } from "zmp-ui";
import { getDriverLocationSafe } from "utils/location";

interface GpsRequiredOverlayProps {
  children: React.ReactNode;
}

/**
 * GpsRequiredOverlay: Blocks the entire Driver app if GPS is not available.
 * Drivers MUST have GPS enabled to receive and deliver orders.
 * Persists the GPS status in sessionStorage so we don't re-ask on every render.
 */
export const GpsRequiredOverlay: FC<GpsRequiredOverlayProps> = ({ children }) => {
  const [gpsGranted, setGpsGranted] = useState<boolean | null>(() => {
    // Check sessionStorage for cached GPS status
    try {
      const cached = sessionStorage.getItem("tm_driver_gps_granted");
      return cached === "true" ? true : null;
    } catch {
      return null;
    }
  });
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const checkGPS = useCallback(async () => {
    setChecking(true);
    setError("");

    try {
      const result = await getDriverLocationSafe({
        maxAgeMs: 0,
        allowStale: false,
        forceRefresh: true,
        quiet: false,
      });

      if (result?.latitude && result?.longitude) {
        setGpsGranted(true);
        sessionStorage.setItem("tm_driver_gps_granted", "true");
      } else {
        setGpsGranted(false);
        setError("Không thể truy cập GPS. Hãy kiểm tra:\n• Đã bật Định vị (GPS) trên thiết bị\n• Đã cấp quyền vị trí cho Zalo\n• Thử tắt/bật lại GPS rồi bấm nút bên dưới");
      }
    } catch (err) {
      console.warn("GPS check failed:", err);
      setGpsGranted(false);
      setError("Truy cập GPS thất bại. Vui lòng bật Định vị và cấp quyền cho Zalo.");
    } finally {
      setChecking(false);
    }
  }, []);

  // Auto-check on mount if not yet granted
  useEffect(() => {
    if (gpsGranted === null) {
      checkGPS();
    }
  }, []);

  // GPS already confirmed
  if (gpsGranted === true) {
    return <>{children}</>;
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #006b45 0%, #008f5d 50%, #00a96d 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 24px",
      textAlign: "center",
    }}>
      {/* GPS Icon */}
      <div style={{
        width: 110, height: 110, borderRadius: "50%",
        background: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 52, marginBottom: 28,
        border: "2px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 8px 40px rgba(0, 0, 0, 0.2)",
        animation: "tm-marker-pulse 2s ease-in-out infinite",
      }}>
        
      </div>

      <Text style={{
        fontSize: 22, fontWeight: 800, color: "#fff",
        marginBottom: 10, fontFamily: "Inter, sans-serif",
      }}>
        Bắt buộc bật định vị GPS
      </Text>

      <Text style={{
        fontSize: 13, color: "rgba(255, 255, 255, 0.7)",
        maxWidth: 300, lineHeight: 1.7, marginBottom: 28,
        fontFamily: "Inter, sans-serif",
      }}>
        Ứng dụng Tài xế cần truy cập vị trí GPS để nhận cuốc, điều hướng tới quán và giao hàng cho khách.
      </Text>

      {error && (
        <div style={{
          background: "rgba(239, 68, 68, 0.15)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 12, padding: "10px 16px", marginBottom: 20,
          maxWidth: 320,
        }}>
          <Text style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.4 }}>{error}</Text>
        </div>
      )}

      <button
        onClick={checkGPS}
        disabled={checking}
        style={{
          width: "100%", maxWidth: 300,
          padding: "14px 0", borderRadius: 14, border: "none",
          background: checking
            ? "rgba(255, 255, 255, 0.1)"
            : "linear-gradient(135deg, #00a96d 0%, #00c97d 100%)",
          color: "#fff",
          fontSize: 15, fontWeight: 700,
          cursor: checking ? "wait" : "pointer",
          fontFamily: "Inter, sans-serif",
          boxShadow: checking ? "none" : "0 4px 20px rgba(0, 169, 109, 0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          opacity: checking ? 0.6 : 1,
          transition: "all 0.2s",
        }}
      >
        {checking ? "⏳ Đang kiểm tra..." : " Cho phép truy cập GPS"}
      </button>

      <Text style={{
        fontSize: 11, color: "rgba(255, 255, 255, 0.4)",
        marginTop: 20, maxWidth: 280, fontFamily: "Inter, sans-serif",
      }}>
        Vị trí GPS chỉ được sử dụng khi bạn đang Online nhận đơn
      </Text>
    </div>
  );
};
