import React, { FC, useEffect, useRef, useState } from "react";
import vietmapgl from "@vietmap/vietmap-gl-js/dist/vietmap-gl";
import "@vietmap/vietmap-gl-js/dist/vietmap-gl.css";

export interface MapMarker {
  id?: string | number;
  lng: number;
  lat: number;
  label?: string;
  color?: string;
  type?: "customer" | "store" | "driver";
  icon?: string;
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

const DEFAULT_CENTER: [number, number] = [106.6519, 10.9804];
const ROUTE_SOURCE_ID = "tm-route-source";
const ROUTE_LAYER_ID = "tm-route-layer";

const MARKER_CONFIG: Record<string, { emoji: string; color: string; size: number; pulse?: boolean }> = {
  customer: { emoji: "📍", color: "#4285f4", size: 38, pulse: true },
  store: { emoji: "🏪", color: "#00a96d", size: 36 },
  driver: { emoji: "🏍️", color: "#ff6b35", size: 36, pulse: true },
};

const POPUP_LABELS: Record<string, string> = {
  customer: "Vi tri giao hang",
  store: "Cua hang",
  driver: "Tai xe",
};

function toFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildRouteCoordinates(path: unknown): [number, number][] | null {
  if (!path || typeof path !== "object") {
    return null;
  }

  const row = path as Record<string, unknown>;
  const points = row.points;

  if (points && typeof points === "object") {
    const pointsRow = points as Record<string, unknown>;
    if (Array.isArray(pointsRow.coordinates)) {
      const coordinates = pointsRow.coordinates
        .map((point) => {
          if (!Array.isArray(point) || point.length < 2) {
            return null;
          }
          const lng = toFiniteNumber(point[0]);
          const lat = toFiniteNumber(point[1]);
          if (lng === null || lat === null) {
            return null;
          }
          return [lng, lat] as [number, number];
        })
        .filter((item): item is [number, number] => item !== null);

      if (coordinates.length >= 2) {
        return coordinates;
      }
    }
  }

  if (row.geometry && typeof row.geometry === "object") {
    const geometryRow = row.geometry as Record<string, unknown>;
    if (Array.isArray(geometryRow.coordinates)) {
      const coordinates = geometryRow.coordinates
        .map((point) => {
          if (!Array.isArray(point) || point.length < 2) {
            return null;
          }
          const lng = toFiniteNumber(point[0]);
          const lat = toFiniteNumber(point[1]);
          if (lng === null || lat === null) {
            return null;
          }
          return [lng, lat] as [number, number];
        })
        .filter((item): item is [number, number] => item !== null);

      if (coordinates.length >= 2) {
        return coordinates;
      }
    }
  }

  return null;
}

async function fetchRoadRoute(apiKey: string, from: MapMarker, to: MapMarker): Promise<[number, number][] | null> {
  const url = new URL("https://maps.vietmap.vn/api/route");
  url.searchParams.set("api-version", "1.1");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.append("point", `${from.lat},${from.lng}`);
  url.searchParams.append("point", `${to.lat},${to.lng}`);
  url.searchParams.set("vehicle", "car");
  url.searchParams.set("points_encoded", "false");
  url.searchParams.set("instructions", "false");
  url.searchParams.set("calc_points", "true");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();

    if (Array.isArray(payload?.paths) && payload.paths.length > 0) {
      const coords = buildRouteCoordinates(payload.paths[0]);
      if (coords) {
        return coords;
      }
    }

    if (Array.isArray(payload?.routes) && payload.routes.length > 0) {
      const coords = buildRouteCoordinates(payload.routes[0]);
      if (coords) {
        return coords;
      }
    }

    return null;
  } catch {
    return null;
  }
}

let cssInjected = false;
function injectCSS() {
  if (cssInjected) {
    return;
  }
  cssInjected = true;

  const styleTag = document.createElement("style");
  styleTag.textContent = `
    @keyframes tm-marker-pulse {
      0%, 100% { box-shadow: 0 3px 12px rgba(0,0,0,0.35); }
      50% { box-shadow: 0 3px 12px rgba(0,0,0,0.35), 0 0 0 12px rgba(66,133,244,0.15); }
    }
    .tm-vietmap-marker {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 3px solid #fff;
      box-shadow: 0 3px 12px rgba(0,0,0,0.35);
      transform: translate(-50%, -50%);
      user-select: none;
    }
    .tm-vietmap-marker-label {
      position: absolute;
      left: 50%;
      top: calc(100% + 4px);
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
    }
    .tm-vietmap-popup .vietmapgl-popup-content {
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      padding: 10px 12px;
      font-family: Inter, sans-serif;
    }
    .tm-vietmap-popup .vietmapgl-popup-close-button {
      font-size: 14px;
      color: #666;
      padding: 4px 6px;
    }
    .tm-vietmap-popup-title {
      font-weight: 700;
      font-size: 14px;
      color: #1a1a2e;
      margin-bottom: 2px;
    }
    .tm-vietmap-popup-detail {
      font-size: 12px;
      color: #666;
      line-height: 1.4;
    }
  `;

  document.head.appendChild(styleTag);
}

function createMarkerElement(marker: MapMarker) {
  const config = MARKER_CONFIG[marker.type || "store"] || MARKER_CONFIG.store;
  const size = config.size;

  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = `${size}px`;
  wrapper.style.height = `${size}px`;
  wrapper.style.cursor = "pointer";

  const icon = document.createElement("div");
  icon.className = "tm-vietmap-marker";
  icon.style.width = `${size}px`;
  icon.style.height = `${size}px`;
  icon.style.background = marker.color || config.color;
  icon.style.fontSize = `${Math.round(size * 0.45)}px`;
  if (config.pulse) {
    icon.style.animation = "tm-marker-pulse 2s ease-in-out infinite";
  }
  icon.textContent = marker.icon || config.emoji;

  wrapper.appendChild(icon);

  if (marker.label) {
    const label = document.createElement("div");
    label.className = "tm-vietmap-marker-label";
    label.textContent = marker.label;
    wrapper.appendChild(label);
  }

  return wrapper;
}

function removeRouteLayer(map: vietmapgl.Map) {
  if (map.getLayer(ROUTE_LAYER_ID)) {
    map.removeLayer(ROUTE_LAYER_ID);
  }
  if (map.getSource(ROUTE_SOURCE_ID)) {
    map.removeSource(ROUTE_SOURCE_ID);
  }
}

function addRouteLayer(map: vietmapgl.Map, coordinates: [number, number][]) {
  removeRouteLayer(map);

  map.addSource(ROUTE_SOURCE_ID, {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates,
      },
    },
  });

  map.addLayer({
    id: ROUTE_LAYER_ID,
    type: "line",
    source: ROUTE_SOURCE_ID,
    paint: {
      "line-color": "#00a96d",
      "line-width": 4,
      "line-opacity": 0.75,
      "line-dasharray": [2, 2],
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  });
}

export const VietMapView: FC<VietMapProps> = ({
  center = DEFAULT_CENTER,
  zoom = 14,
  markers = [],
  height = 220,
  onMarkerClick,
  className,
  style: wrapperStyle,
  showRoute = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<vietmapgl.Map | null>(null);
  const markerInstancesRef = useRef<vietmapgl.Marker[]>([]);
  const initialFitDoneRef = useRef(false);
  const mapLoadedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiKey = (import.meta.env.VITE_VIETMAP_API_KEY || "").trim();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    injectCSS();

    if (!apiKey) {
      setErrorMessage("Thieu VITE_VIETMAP_API_KEY");
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const map = new vietmapgl.Map({
      container: containerRef.current,
      style: `https://maps.vietmap.vn/api/maps/light/styles.json?apikey=${apiKey}`,
      center,
      zoom,
    });

    map.addControl(new vietmapgl.NavigationControl(), "top-right");

    map.on("load", () => {
      mapLoadedRef.current = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setLoaded(true);
      setErrorMessage(null);
    });

    map.on("error", (event) => {
      console.warn("Mapbox GL Error:", event?.error?.message);
    });

    timeoutId = setTimeout(() => {
      if (!mapLoadedRef.current) {
        setErrorMessage("Khong the tai ban do Vietmap");
      }
    }, 10000);

    mapRef.current = map;

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      markerInstancesRef.current.forEach((marker) => marker.remove());
      markerInstancesRef.current = [];
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
      setLoaded(false);
    };
  }, [apiKey, center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    map.resize();

    markerInstancesRef.current.forEach((marker) => marker.remove());
    markerInstancesRef.current = [];

    if (markers.length === 0) {
      return;
    }

    // Lọc bỏ tài xế (nếu có) không cần thiết nữa theo yêu cầu
    const displayMarkers = markers.filter(m => m.type !== "driver");

    displayMarkers.forEach((markerData) => {
      const element = createMarkerElement(markerData);

      element.addEventListener("click", () => {
        onMarkerClick?.(markerData);
      });

      const popup = new vietmapgl.Popup({ offset: 18, className: "tm-vietmap-popup" }).setHTML(`
        <div class="tm-vietmap-popup-title">${markerData.label || POPUP_LABELS[markerData.type || "store"]}</div>
        <div class="tm-vietmap-popup-detail">
          ${markerData.type === "customer" ? "Điểm giao đến" : ""}
          ${markerData.type === "store" ? "Điểm lấy hàng" : ""}
        </div>
      `);

      const marker = new vietmapgl.Marker({ element, anchor: "center" })
        .setLngLat([markerData.lng, markerData.lat])
        .setPopup(popup)
        .addTo(map);

      markerInstancesRef.current.push(marker);
    });

    if (!initialFitDoneRef.current) {
      initialFitDoneRef.current = true;
      if (displayMarkers.length > 1) {
        const bounds = new vietmapgl.LngLatBounds();
        displayMarkers.forEach((marker) => {
          bounds.extend([marker.lng, marker.lat]);
        });
        map.fitBounds(bounds, { padding: 36, maxZoom: 16, duration: 0 });
      } else if (displayMarkers.length === 1) {
        map.flyTo({ center: [displayMarkers[0].lng, displayMarkers[0].lat], zoom: 15, duration: 0 });
      }
    }
  }, [markers, loaded, onMarkerClick]);

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
        ref={containerRef}
        style={{
          width: "100%",
          height: typeof height === "number" ? `${height}px` : height,
          minHeight: 120,
        }}
      />
      {!loaded && !errorMessage && (
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
            <div>Dang tai ban do...</div>
          </div>
        </div>
      )}
      {errorMessage && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff7ed",
            color: "#9a3412",
            textAlign: "center",
            padding: 16,
            fontSize: 12,
            lineHeight: 1.5,
            zIndex: 1001,
          }}
        >
          Khong the tai Vietmap. Kiem tra API key va ket noi mang.
        </div>
      )}
    </div>
  );
};
