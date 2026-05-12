import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { VietMapView, MapMarker, RouteInstruction, RouteSummary } from "components/vietmap";
import { calculateDistance, calculateETA, displayDistance, getDriverLocationSafe } from "utils/location";

/**
 * Full-screen VietMap navigation page.
 * Receives origin/destination via URL search params:
 *   ?originLat=...&originLng=...&destLat=...&destLng=...&destName=...
 */
const NavigationPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const destLat = parseFloat(params.get("destLat") || "0");
  const destLng = parseFloat(params.get("destLng") || "0");
  const destName = params.get("destName") || "Điểm đến";
  const destType = (params.get("destType") || "store") as "store" | "customer";

  const [driverLat, setDriverLat] = useState<number | null>(
    params.get("originLat") ? parseFloat(params.get("originLat")!) : null
  );
  const [driverLng, setDriverLng] = useState<number | null>(
    params.get("originLng") ? parseFloat(params.get("originLng")!) : null
  );
  const [driverHeading, setDriverHeading] = useState<number>(0);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [followMode, setFollowMode] = useState(false);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const previousDriverPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const overviewShownRef = useRef(false);
  const suppressUserMoveUntilRef = useRef(0);

  const triggerFollowNow = () => {
    suppressUserMoveUntilRef.current = Date.now() + 1200;
    setFollowMode(true);
  };

  const calculateBearing = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const phi1 = toRad(fromLat);
    const phi2 = toRad(toLat);
    const deltaLambda = toRad(toLng - fromLng);
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  // Live GPS tracking
  useEffect(() => {
    const fetchLocation = async () => {
      const pos = await getDriverLocationSafe({
        maxAgeMs: 10000,
        allowStale: true,
        quiet: true,
      });
      if (pos) {
        const prev = previousDriverPointRef.current;
        if (prev) {
          const movedKm = calculateDistance(prev.lat, prev.lng, pos.latitude, pos.longitude);
          if (movedKm >= 0.005) {
            const nextHeading = calculateBearing(prev.lat, prev.lng, pos.latitude, pos.longitude);
            setDriverHeading((current) => {
              const delta = ((nextHeading - current + 540) % 360) - 180;
              return (current + delta * 0.45 + 360) % 360;
            });
          }
        }
        previousDriverPointRef.current = { lat: pos.latitude, lng: pos.longitude };
        setDriverLat(pos.latitude);
        setDriverLng(pos.longitude);
      }
    };

    fetchLocation();
    const interval = setInterval(fetchLocation, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    overviewShownRef.current = false;
    setNavigationStarted(false);
    setFollowMode(false);
  }, [destLat, destLng]);

  useEffect(() => {
    if (!driverLat || !driverLng || navigationStarted || overviewShownRef.current) {
      return;
    }
    overviewShownRef.current = true;
    const timer = setTimeout(() => {
      if (!navigationStarted) {
        setFollowMode(true);
      }
    }, 2600);
    return () => clearTimeout(timer);
  }, [driverLat, driverLng, navigationStarted]);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [
      { lat: destLat, lng: destLng, label: destName, type: destType },
    ];
    if (driverLat && driverLng) {
      list.push({ lat: driverLat, lng: driverLng, label: "Bạn", type: "driver", heading: driverHeading });
    }
    return list;
  }, [destLat, destLng, destName, destType, driverLat, driverLng, driverHeading]);

  const center = useMemo<[number, number]>(() => {
    if (followMode && driverLat && driverLng) {
      return [driverLng, driverLat];
    }
    if (driverLat && driverLng) {
      return [(driverLng + destLng) / 2, (driverLat + destLat) / 2];
    }
    return [destLng, destLat];
  }, [followMode, driverLat, driverLng, destLat, destLng]);

  const distance = useMemo(() => {
    if (driverLat && driverLng) {
      return calculateDistance(driverLat, driverLng, destLat, destLng);
    }
    return 0;
  }, [driverLat, driverLng, destLat, destLng]);

  const routeDistanceKm = useMemo(
    () => (routeSummary ? routeSummary.distanceMeters / 1000 : distance),
    [routeSummary, distance],
  );
  const routeEta = useMemo(() => calculateETA(routeDistanceKm), [routeDistanceKm]);

  const routeSteps = useMemo(() => {
    return (routeSummary?.instructions || [])
      .filter((step) => step.sign !== 5)
      .slice(0, 7);
  }, [routeSummary]);

  const nextStep = useMemo(
    () => routeSteps.find((step) => step.sign !== 4) || routeSteps[0] || null,
    [routeSteps],
  );

  const signIcon = (sign: number) => {
    if (sign <= -8 || sign >= 8) return "↩";
    if (sign === -7) return "↖";
    if (sign === -3) return "⬉";
    if (sign === -2) return "←";
    if (sign === -1) return "↙";
    if (sign === 1) return "↘";
    if (sign === 2) return "→";
    if (sign === 3) return "⬊";
    if (sign === 6) return "⟳";
    if (sign === 7) return "↗";
    if (sign === 4) return "✓";
    return "↑";
  };

  const formatStepDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
    }
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return `${rounded} m`;
  };

  const formatStepTime = (timeMs: number) => {
    const mins = Math.max(1, Math.round(timeMs / 60000));
    return `${mins} phút`;
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      background: "#0f1923",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        paddingTop: `calc(var(--tm-safe-area-inset-top, 0px) + 10px)`,
        background: "linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)",
        color: "#fff",
        flexShrink: 0,
        zIndex: 10,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "#fff",
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Dẫn đường tới {destName}
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>
            {destLat.toFixed(6)}, {destLng.toFixed(6)}
          </div>
        </div>
      </div>

      {/* Full-screen VietMap */}
      <div style={{ flex: 1, position: "relative" }}>
        <VietMapView
          center={center}
          zoom={14.4}
          markers={markers}
          height="100%"
          showRoute={true}
          routeVehicle="motorcycle"
          onRouteResolved={setRouteSummary}
          followCenter={followMode}
          followCenterDurationMs={900}
          onUserMapMoveStart={() => {
            if (Date.now() < suppressUserMoveUntilRef.current) {
              return;
            }
            setFollowMode(false);
          }}
          style={{ borderRadius: 0, width: "100%", height: "100%" }}
        />

        {!followMode && driverLat && driverLng && (
          <button
            onClick={triggerFollowNow}
            style={{
              position: "absolute",
              left: 12,
              bottom: "calc(var(--tm-safe-area-inset-bottom, 0px) + 76px)",
              minHeight: 44,
              padding: "0 16px",
              borderRadius: 22,
              border: "1px solid #d7dce3",
              background: "rgba(255,255,255,0.98)",
              color: "#1f4f8f",
              boxShadow: "0 3px 10px rgba(0,0,0,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 6,
              zIndex: 12,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 700,
            }}
            aria-label="Về giữa"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            Về giữa
          </button>
        )}

        {nextStep && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: 12,
              background: "rgba(15,25,35,0.86)",
              color: "#fff",
              borderRadius: 14,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              zIndex: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {signIcon(nextStep.sign)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {nextStep.text}
              </div>
              <div style={{ fontSize: 11, opacity: 0.88, marginTop: 2 }}>
                {formatStepDistance(nextStep.distanceMeters)} • {formatStepTime(nextStep.timeMs)}
              </div>
            </div>
          </div>
        )}

        {!navigationStarted && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 16,
              right: 16,
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(10px)",
              borderRadius: 16,
              padding: "14px 14px 8px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
              zIndex: 10,
              maxHeight: "46vh",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingBottom: "calc(var(--tm-safe-area-inset-bottom, 0px) + 8px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#00a96d", lineHeight: 1 }}>
                  {routeEta}
                </div>
                <div style={{ fontSize: 13, color: "#666", fontWeight: 600 }}>
                  {displayDistance(routeDistanceKm)} • Xe máy
                </div>
              </div>
              <button
                onClick={() => {
                  setNavigationStarted(true);
                  triggerFollowNow();
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#e8f5e9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#00a96d",
                  flexShrink: 0,
                  border: "none",
                  cursor: "pointer",
                }}
                aria-label="Bắt đầu đi"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
              </button>
            </div>

            <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 8, overflowY: "auto" }}>
              {routeSteps.length > 0 ? (
                routeSteps.map((step: RouteInstruction, index) => (
                  <div
                    key={`${step.text}-${index}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "6px 0",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#eef2ff",
                        color: "#1a73e8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {signIcon(step.sign)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1f2937" }}>{step.text}</div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                        {formatStepDistance(step.distanceMeters)} • {formatStepTime(step.timeMs)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, color: "#6b7280", padding: "8px 0 4px" }}>
                  Đang tải chỉ dẫn đường đi...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavigationPage;
