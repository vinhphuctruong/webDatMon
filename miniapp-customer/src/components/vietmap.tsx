import React, { FC, useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  lng: number;
  lat: number;
  label?: string;
  color?: string;
  type?: "customer" | "store" | "driver";
  icon?: string; // emoji
}

export interface VietMapProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  markers?: MapMarker[];
  height?: number | string;
  onMarkerClick?: (marker: MapMarker) => void;
  className?: string;
  style?: React.CSSProperties;
  showRoute?: boolean;
}

// Create custom icon from emoji/type
function createMarkerIcon(marker: MapMarker): L.DivIcon {
  const configs: Record<string, { emoji: string; bg: string; size: number; pulse?: boolean }> = {
    customer: { emoji: "📍", bg: "#4285f4", size: 38, pulse: true },
    store: { emoji: "🏪", bg: "#00a96d", size: 36 },
    driver: { emoji: "🏍️", bg: "#ff6b35", size: 36, pulse: true },
  };

  const cfg = configs[marker.type || "store"] || configs.store;
  const emoji = marker.icon || cfg.emoji;

  return L.divIcon({
    className: "tm-map-marker",
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${cfg.size}px;
        height: ${cfg.size}px;
        border-radius: 50%;
        background: ${marker.color || cfg.bg};
        border: 3px solid #fff;
        box-shadow: 0 3px 12px rgba(0,0,0,0.35);
        font-size: ${cfg.size * 0.45}px;
        cursor: pointer;
        ${cfg.pulse ? "animation: tm-marker-pulse 2s ease-in-out infinite;" : ""}
        transform: translate(-50%, -50%);
      ">
        ${emoji}
      </div>
      ${marker.label ? `
        <div style="
          position: absolute;
          top: ${cfg.size + 4}px;
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          border-radius: 8px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 600;
          color: #1a1a2e;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: Inter, sans-serif;
        ">${marker.label}</div>
      ` : ""}
    `,
    iconSize: [cfg.size, cfg.size],
    iconAnchor: [cfg.size / 2, cfg.size / 2],
    popupAnchor: [0, -(cfg.size / 2 + 5)],
  });
}

// Inject marker animation CSS once
let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes tm-marker-pulse {
      0%, 100% { box-shadow: 0 3px 12px rgba(0,0,0,0.35); }
      50% { box-shadow: 0 3px 12px rgba(0,0,0,0.35), 0 0 0 12px rgba(66,133,244,0.15); }
    }
    .tm-map-marker {
      background: none !important;
      border: none !important;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 12px !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
      font-family: Inter, sans-serif !important;
    }
    .leaflet-popup-content {
      margin: 10px 14px !important;
      font-size: 13px !important;
      line-height: 1.5 !important;
    }
    .leaflet-popup-tip {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
    }
    .tm-popup-title {
      font-weight: 700;
      font-size: 14px;
      color: #1a1a2e;
      margin-bottom: 4px;
    }
    .tm-popup-detail {
      font-size: 12px;
      color: #666;
    }
    .tm-popup-badge {
      display: inline-block;
      background: #e8f5e9;
      color: #00a96d;
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 6px;
    }
  `;
  document.head.appendChild(style);
}

export const VietMapView: FC<VietMapProps> = ({
  center = [106.6519, 10.9804],
  zoom = 14,
  markers = [],
  height = 220,
  onMarkerClick,
  className,
  style: wrapperStyle,
  showRoute = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const initialFitDoneRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const heightPx = typeof height === "number" ? height : 200;

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    injectCSS();

    const map = L.map(mapContainerRef.current, {
      center: [center[1], center[0]], // Leaflet uses [lat, lng]
      zoom,
      zoomControl: false,
      attributionControl: false,
    });

    // Add zoom control to top-right
    L.control.zoom({ position: "topright" }).addTo(map);

    // Add attribution (bottom-right, small)
    L.control.attribution({ prefix: "© OpenStreetMap" }).addTo(map);

    // OpenStreetMap tiles
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Small delay to let tiles load
    setTimeout(() => setLoaded(true), 300);

    return () => {
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    // Clear old markers
    leafletMarkersRef.current.forEach((m) => m.remove());
    leafletMarkersRef.current = [];

    // Clear old route
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (markers.length === 0) return;

    markers.forEach((markerData) => {
      const icon = createMarkerIcon(markerData);
      const leafletMarker = L.marker([markerData.lat, markerData.lng], { icon })
        .addTo(map);

      // Build popup content
      const typeLabels: Record<string, string> = {
        customer: "📍 Vị trí của bạn",
        store: "🏪 Cửa hàng",
        driver: "🏍️ Tài xế",
      };

      const popupContent = `
        <div class="tm-popup-title">${markerData.label || typeLabels[markerData.type || "store"]}</div>
        <div class="tm-popup-detail">
          ${markerData.type === "customer" ? "Giao hàng đến vị trí này" : ""}
          ${markerData.type === "store" ? "Nhấn để xem chi tiết" : ""}
          ${markerData.type === "driver" ? "Đang trên đường giao hàng" : ""}
        </div>
        <div class="tm-popup-detail" style="margin-top: 4px; color: #999;">
          ${markerData.lat.toFixed(5)}, ${markerData.lng.toFixed(5)}
        </div>
        ${markerData.type === "driver" ?
          '<div class="tm-popup-badge">🕐 ~5 phút</div>' :
          markerData.type === "store" ?
          '<div class="tm-popup-badge">⭐ Đang mở cửa</div>' :
          '<div class="tm-popup-badge">📌 Vị trí hiện tại</div>'
        }
      `;

      leafletMarker.bindPopup(popupContent, {
        maxWidth: 200,
        closeButton: true,
      });

      leafletMarker.on("click", () => {
        onMarkerClick?.(markerData);
      });

      leafletMarkersRef.current.push(leafletMarker);
    });

    // Draw route line following roads via OSRM
    if (showRoute && markers.length >= 2) {
      const store = markers.find((m) => m.type === "store");
      const customer = markers.find((m) => m.type === "customer");

      if (store && customer) {
        // Fetch real road route
        fetch(`https://router.project-osrm.org/route/v1/driving/${store.lng},${store.lat};${customer.lng},${customer.lat}?overview=full&geometries=geojson`)
          .then((res) => res.json())
          .then((data) => {
            if (data.routes?.[0]?.geometry?.coordinates && mapRef.current) {
              const coords = data.routes[0].geometry.coordinates.map(
                (c: [number, number]) => [c[1], c[0]] as [number, number]
              );
              if (routeLayerRef.current) routeLayerRef.current.remove();
              routeLayerRef.current = L.polyline(coords, {
                color: "#00a96d",
                weight: 4,
                opacity: 0.7,
                dashArray: "10, 8",
                lineCap: "round",
              }).addTo(mapRef.current);
            }
          })
          .catch(() => {
            // Fallback: straight line
            if (mapRef.current) {
              routeLayerRef.current = L.polyline(
                [[store.lat, store.lng], [customer.lat, customer.lng]],
                { color: "#00a96d", weight: 4, opacity: 0.5, dashArray: "10, 8" }
              ).addTo(mapRef.current);
            }
          });
      }
    }

    // Only fit bounds ONCE on first load, then let user control freely
    if (!initialFitDoneRef.current && markers.length > 0) {
      initialFitDoneRef.current = true;
      if (markers.length > 1) {
        const group = L.featureGroup(leafletMarkersRef.current);
        map.fitBounds(group.getBounds().pad(0.15), { maxZoom: 16 });
      } else {
        map.setView([markers[0].lat, markers[0].lng], 15);
      }
    }
  }, [markers, loaded, showRoute]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        ...wrapperStyle,
      }}
    >
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: heightPx,
        }}
      />
      {!loaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#e8ecf1",
            zIndex: 1000,
          }}
        >
          <div style={{ textAlign: "center", color: "#888", fontSize: 13 }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🗺️</div>
            <div>Đang tải bản đồ...</div>
          </div>
        </div>
      )}
    </div>
  );
};
