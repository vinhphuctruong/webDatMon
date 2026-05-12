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
  heading?: number;
}

export interface RouteInstruction {
  sign: number;
  text: string;
  distanceMeters: number;
  timeMs: number;
  streetName?: string;
}

export interface RouteSummary {
  coordinates: [number, number][];
  distanceMeters: number;
  timeMs: number;
  instructions: RouteInstruction[];
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
  routeVehicle?: "car" | "bike" | "foot" | "motorcycle";
  onRouteResolved?: (route: RouteSummary | null) => void;
  followCenter?: boolean;
  followCenterDurationMs?: number;
  mapStylePreset?: "osm-detail" | "vietmap-street" | "vietmap-light" | "vietmap-dark" | "vietmap-hybrid";
  onUserMapMoveStart?: () => void;
}

const DEFAULT_CENTER: [number, number] = [106.6519, 10.9804];
const ROUTE_SOURCE_ID = "tm-route-source";
const ROUTE_LAYER_ID = "tm-route-layer";
const TRANSPARENT_STYLE_IMAGE = {
  width: 1,
  height: 1,
  data: new Uint8Array([0, 0, 0, 0]),
};
const OSM_DETAIL_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm-raster",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const MARKER_CONFIG: Record<string, { glyph: "pin" | "store" | "driver"; color: string; size: number; pulse?: boolean }> = {
  customer: { glyph: "pin", color: "#4285f4", size: 38, pulse: true },
  store: { glyph: "store", color: "#00a96d", size: 36 },
  driver: { glyph: "driver", color: "#ff6b35", size: 36, pulse: true },
};

const POPUP_LABELS: Record<string, string> = {
  customer: "Vi tri giao hang",
  store: "Cua hang",
  driver: "Tai xe",
};

let abortGuardRefCount = 0;
let abortGuardCleanup: (() => void) | null = null;

function isIgnorableAbortError(input: unknown): boolean {
  if (!input) {
    return false;
  }

  if (typeof input === "string") {
    return input.includes("signal is aborted without reason");
  }

  const row = input as { name?: unknown; message?: unknown; reason?: unknown };
  const name = typeof row.name === "string" ? row.name : "";
  const message = typeof row.message === "string" ? row.message : "";
  const reason = typeof row.reason === "string" ? row.reason : "";

  return (
    name.includes("AbortError") &&
    (message.includes("signal is aborted without reason") || reason.includes("signal is aborted without reason"))
  );
}

function installAbortErrorGuard() {
  if (typeof window === "undefined") {
    return () => {};
  }

  abortGuardRefCount += 1;
  if (!abortGuardCleanup) {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isIgnorableAbortError(event.reason)) {
        event.preventDefault();
      }
    };

    const onWindowError = (event: ErrorEvent) => {
      if (
        isIgnorableAbortError(event.error) ||
        isIgnorableAbortError(event.message)
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onWindowError);

    abortGuardCleanup = () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onWindowError);
      abortGuardCleanup = null;
    };
  }

  return () => {
    abortGuardRefCount = Math.max(0, abortGuardRefCount - 1);
    if (abortGuardRefCount === 0 && abortGuardCleanup) {
      abortGuardCleanup();
    }
  };
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371000 * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

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

function buildRouteInstructions(path: unknown): RouteInstruction[] {
  if (!path || typeof path !== "object") {
    return [];
  }

  const row = path as Record<string, unknown>;
  if (!Array.isArray(row.instructions)) {
    return [];
  }

  return row.instructions
    .map((instruction): RouteInstruction | null => {
      if (!instruction || typeof instruction !== "object") {
        return null;
      }
      const value = instruction as Record<string, unknown>;
      const text = typeof value.text === "string" ? value.text.trim() : "";
      if (!text) {
        return null;
      }

      return {
        sign: toFiniteNumber(value.sign) ?? 0,
        text,
        distanceMeters: toFiniteNumber(value.distance) ?? 0,
        timeMs: toFiniteNumber(value.time) ?? 0,
        streetName: typeof value.street_name === "string" && value.street_name.trim() ? value.street_name.trim() : undefined,
      };
    })
    .filter((item): item is RouteInstruction => item !== null);
}

function buildRouteSummary(path: unknown): RouteSummary | null {
  const coordinates = buildRouteCoordinates(path);
  if (!coordinates) {
    return null;
  }

  const row = (path && typeof path === "object" ? path : {}) as Record<string, unknown>;
  const distanceMeters = toFiniteNumber(row.distance) ?? 0;
  const timeMs = toFiniteNumber(row.time) ?? 0;
  const instructions = buildRouteInstructions(path);

  return {
    coordinates,
    distanceMeters,
    timeMs,
    instructions,
  };
}

async function fetchRoadRoute(
  apiKey: string,
  from: MapMarker,
  to: MapMarker,
  vehicle: "car" | "bike" | "foot" | "motorcycle",
): Promise<RouteSummary | null> {
  const url = new URL("https://maps.vietmap.vn/api/route");
  url.searchParams.set("api-version", "1.1");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.append("point", `${from.lat},${from.lng}`);
  url.searchParams.append("point", `${to.lat},${to.lng}`);
  url.searchParams.set("vehicle", vehicle);
  url.searchParams.set("points_encoded", "false");
  url.searchParams.set("instructions", "true");
  url.searchParams.set("calc_points", "true");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();

    if (Array.isArray(payload?.paths) && payload.paths.length > 0) {
      const route = buildRouteSummary(payload.paths[0]);
      if (route) {
        return route;
      }
    }

    if (Array.isArray(payload?.routes) && payload.routes.length > 0) {
      const route = buildRouteSummary(payload.routes[0]);
      if (route) {
        return route;
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
  if (config.pulse) {
    icon.style.animation = "tm-marker-pulse 2s ease-in-out infinite";
  }
  if (marker.icon) {
    icon.textContent = marker.icon;
  } else {
    icon.innerHTML = markerGlyphSvg(config.glyph, Math.round(size * 0.56));
  }
  if (marker.type === "driver" && Number.isFinite(marker.heading)) {
    icon.style.transform = `rotate(${marker.heading}deg)`;
    icon.style.transition = "transform 220ms linear";
  }

  wrapper.appendChild(icon);

  if (marker.label) {
    const label = document.createElement("div");
    label.className = "tm-vietmap-marker-label";
    label.textContent = marker.label;
    wrapper.appendChild(label);
  }

  return wrapper;
}

function markerGlyphSvg(glyph: "pin" | "store" | "driver", iconSize: number) {
  const common = `stroke="white" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  if (glyph === "store") {
    return `
      <svg class="tm-vietmap-marker-svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" aria-hidden="true">
        <path ${common} d="M4 10h16v9H4z" />
        <path ${common} d="M3 10l2-4h14l2 4" />
        <path ${common} d="M9 19v-4h6v4" />
      </svg>
    `;
  }
  if (glyph === "driver") {
    return `
      <svg class="tm-vietmap-marker-svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l6 15-6.2-4.1L6 18 12 3z" fill="white" />
      </svg>
    `;
  }
  return `
    <svg class="tm-vietmap-marker-svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" aria-hidden="true">
      <path ${common} d="M12 21s-6-5.1-6-10a6 6 0 1 1 12 0c0 4.9-6 10-6 10z" />
      <circle ${common} cx="12" cy="11" r="2.5" />
    </svg>
  `;
}

function removeRouteLayer(map: vietmapgl.Map) {
  if (map.getLayer(ROUTE_LAYER_ID)) {
    map.removeLayer(ROUTE_LAYER_ID);
  }
  if (map.getSource(ROUTE_SOURCE_ID)) {
    map.removeSource(ROUTE_SOURCE_ID);
  }
}

function resolveMapStyle(
  apiKey: string,
  mapStylePreset: NonNullable<VietMapProps["mapStylePreset"]>,
): string | typeof OSM_DETAIL_STYLE {
  if (mapStylePreset === "osm-detail") {
    return OSM_DETAIL_STYLE;
  }
  if (mapStylePreset === "vietmap-light") {
    return `https://maps.vietmap.vn/maps/styles/lm/style.json?apikey=${apiKey}`;
  }
  if (mapStylePreset === "vietmap-dark") {
    return `https://maps.vietmap.vn/maps/styles/dm/style.json?apikey=${apiKey}`;
  }
  if (mapStylePreset === "vietmap-hybrid") {
    return `https://maps.vietmap.vn/maps/styles/hm/style.json?apikey=${apiKey}`;
  }
  return `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${apiKey}`;
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
  routeVehicle = "motorcycle",
  onRouteResolved,
  followCenter = false,
  followCenterDurationMs = 800,
  mapStylePreset = "osm-detail",
  onUserMapMoveStart,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<vietmapgl.Map | null>(null);
  const markerInstancesRef = useRef<vietmapgl.Marker[]>([]);
  const initialFitDoneRef = useRef(false);
  const mapLoadedRef = useRef(false);
  const routeRequestIdRef = useRef(0);
  const lastRouteQueryRef = useRef<{ from: [number, number]; to: [number, number] } | null>(null);
  const lastFollowCenterRef = useRef<[number, number] | null>(null);
  const prevFollowCenterModeRef = useRef<boolean>(false);
  const onUserMapMoveStartRef = useRef<(() => void) | undefined>(onUserMapMoveStart);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiKey = (import.meta.env.VITE_VIETMAP_API_KEY || "").trim();

  useEffect(() => {
    onUserMapMoveStartRef.current = onUserMapMoveStart;
  }, [onUserMapMoveStart]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    injectCSS();
    const uninstallAbortGuard = installAbortErrorGuard();

    if (!apiKey) {
      setErrorMessage("Thieu VITE_VIETMAP_API_KEY");
      uninstallAbortGuard();
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const map = new vietmapgl.Map({
      container: containerRef.current,
      style: resolveMapStyle(apiKey, mapStylePreset),
      center,
      zoom,
      maxZoom: 20,
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
    map.on("movestart", (event: { originalEvent?: unknown }) => {
      if (event?.originalEvent && onUserMapMoveStartRef.current) {
        onUserMapMoveStartRef.current();
      }
    });
    map.on("styleimagemissing", (event: { id?: string }) => {
      const imageId = event?.id;
      if (!imageId || map.hasImage(imageId)) {
        return;
      }
      try {
        map.addImage(imageId, TRANSPARENT_STYLE_IMAGE);
      } catch {
        // Ignore if style cannot accept placeholder image
      }
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
      routeRequestIdRef.current += 1;
      try {
        map.stop();
      } catch {
        // ignore
      }
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
      setLoaded(false);
      uninstallAbortGuard();
    };
  }, [apiKey, mapStylePreset]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    map.resize();
  }, [loaded, height]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !followCenter) {
      prevFollowCenterModeRef.current = followCenter;
      return;
    }

    const [nextLng, nextLat] = center;
    const previousCenter = lastFollowCenterRef.current;
    const followJustEnabled = !prevFollowCenterModeRef.current && followCenter;
    prevFollowCenterModeRef.current = followCenter;
    lastFollowCenterRef.current = center;

    if (!previousCenter || followJustEnabled) {
      map.jumpTo({ center, zoom });
      return;
    }

    const movedMeters = haversineMeters(previousCenter[1], previousCenter[0], nextLat, nextLng);
    if (movedMeters < 3) {
      return;
    }

    map.easeTo({
      center,
      zoom,
      duration: followCenterDurationMs,
      essential: true,
      easing: (t) => 1 - Math.pow(1 - t, 2),
    });
  }, [center, zoom, loaded, followCenter, followCenterDurationMs]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    markerInstancesRef.current.forEach((marker) => marker.remove());
    markerInstancesRef.current = [];

    if (markers.length === 0) {
      return;
    }

    markers.forEach((markerData) => {
      const element = createMarkerElement(markerData);

      element.addEventListener("click", () => {
        onMarkerClick?.(markerData);
      });

      const popup = new vietmapgl.Popup({ offset: 18, className: "tm-vietmap-popup" }).setHTML(`
        <div class="tm-vietmap-popup-title">${markerData.label || POPUP_LABELS[markerData.type || "store"]}</div>
        <div class="tm-vietmap-popup-detail">
          ${markerData.type === "customer" ? "Điểm giao đến" : ""}
          ${markerData.type === "store" ? "Điểm lấy hàng" : ""}
          ${markerData.type === "driver" ? "Vị trí hiện tại" : ""}
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
      if (followCenter) {
        map.jumpTo({ center, zoom });
      } else if (markers.length > 1) {
        const bounds = new vietmapgl.LngLatBounds();
        markers.forEach((marker) => {
          bounds.extend([marker.lng, marker.lat]);
        });
        map.fitBounds(bounds, { padding: 36, maxZoom: 16, duration: 0 });
      } else {
        map.flyTo({ center: [markers[0].lng, markers[0].lat], zoom: 15, duration: 0 });
      }
    }
  }, [markers, loaded, onMarkerClick, followCenter, center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    if (!showRoute || markers.length < 2) {
      routeRequestIdRef.current += 1;
      lastRouteQueryRef.current = null;
      removeRouteLayer(map);
      onRouteResolved?.(null);
      return;
    }

    const driver = markers.find((marker) => marker.type === "driver") || markers[0];
    const destination = markers.find((marker) => marker.type !== "driver") || markers[markers.length - 1];

    const lastQuery = lastRouteQueryRef.current;
    if (lastQuery) {
      const movedFromMeters = haversineMeters(lastQuery.from[1], lastQuery.from[0], driver.lat, driver.lng);
      const movedToMeters = haversineMeters(lastQuery.to[1], lastQuery.to[0], destination.lat, destination.lng);
      if (movedFromMeters < 20 && movedToMeters < 3) {
        return;
      }
    }

    const currentRequestId = routeRequestIdRef.current + 1;
    routeRequestIdRef.current = currentRequestId;
    lastRouteQueryRef.current = {
      from: [driver.lng, driver.lat],
      to: [destination.lng, destination.lat],
    };

    fetchRoadRoute(apiKey, driver, destination, routeVehicle).then((route) => {
      if (routeRequestIdRef.current !== currentRequestId) {
        return;
      }

      if (!route || !mapRef.current) {
        onRouteResolved?.(null);
        return;
      }

      addRouteLayer(mapRef.current, route.coordinates);
      onRouteResolved?.(route);
    });
  }, [markers, loaded, showRoute, apiKey, routeVehicle, onRouteResolved]);

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
            <div style={{ fontSize: 22, marginBottom: 6 }}></div>
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
