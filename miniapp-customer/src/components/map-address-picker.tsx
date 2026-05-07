import React, { FC, useCallback, useEffect, useRef, useState } from "react";
import vietmapgl from "@vietmap/vietmap-gl-js/dist/vietmap-gl";
import "@vietmap/vietmap-gl-js/dist/vietmap-gl.css";
import { getLocation } from "zmp-sdk";
import { reverseGeocode, isWithinServiceArea, THU_DAU_MOT_CENTER } from "utils/location";

export interface MapPickerResult {
  lat: number;
  lng: number;
  address: string;
}

interface MapAddressPickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (result: MapPickerResult) => void;
  initialLat?: number;
  initialLng?: number;
}

const FALLBACK_ADDRESS = "Vị trí đã chọn trên bản đồ";

export const MapAddressPicker: FC<MapAddressPickerProps> = ({
  visible,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<vietmapgl.Map | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [address, setAddress] = useState("Đang tìm địa chỉ...");
  const [coords, setCoords] = useState({
    lat: initialLat || THU_DAU_MOT_CENTER.lat,
    lng: initialLng || THU_DAU_MOT_CENTER.lng,
  });
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [outOfArea, setOutOfArea] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const apiKey = (import.meta.env.VITE_VIETMAP_API_KEY || "").trim();

  const geocodeCenter = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    setOutOfArea(!isWithinServiceArea(lat, lng));
    setLoadingAddress(true);

    // Fetch immediately instead of debouncing since it's manual or first load
    reverseGeocode(lat, lng).then(result => {
      setAddress(result || FALLBACK_ADDRESS);
      setLoadingAddress(false);
    });
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=vn`,
          {
            headers: {
              "User-Agent": "TMFoodApp/1.0",
            },
          }
        );
        const data = await response.json();
        setSearchResults(data || []);
      } catch (err) {
        console.error("Nominatim search error", err);
      } finally {
        setIsSearching(false);
      }
    }, 600);
  }, []);

  const selectSearchResult = useCallback((result: any) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (mapRef.current && Number.isFinite(lat) && Number.isFinite(lng)) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 19.5, duration: 800 });
      setSearchQuery("");
      setSearchResults([]);
      // The moveend event will trigger geocodeCenter automatically
    }
  }, []);

  const handleGPS = useCallback(() => {
    setGpsLoading(true);
    setGpsError(false);

    const fallbackToBrowser = () => {
      if (!navigator.geolocation) {
        setGpsLoading(false);
        setGpsError(true);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          mapRef.current?.flyTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 19.5,
            duration: 700,
          });
          setGpsLoading(false);
        },
        () => {
          setGpsLoading(false);
          setGpsError(true);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 },
      );
    };

    try {
      const timeoutId = setTimeout(() => {
        fallbackToBrowser();
      }, 3200);

      getLocation({})
        .then((result: any) => {
          clearTimeout(timeoutId);
          const lat = Number(result?.latitude);
          const lng = Number(result?.longitude);

          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            mapRef.current?.flyTo({ center: [lng, lat], zoom: 19.5, duration: 700 });
          } else {
            fallbackToBrowser();
          }

          setGpsLoading(false);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          fallbackToBrowser();
        });
    } catch {
      fallbackToBrowser();
    }
  }, []);

  useEffect(() => {
    if (!visible || !containerRef.current || mapRef.current) {
      return;
    }

    if (!apiKey) {
      setMapError("Thieu VITE_VIETMAP_API_KEY");
      return;
    }

    const lat = initialLat || THU_DAU_MOT_CENTER.lat;
    const lng = initialLng || THU_DAU_MOT_CENTER.lng;

    const GOOGLE_MAPS_STYLE = {
      version: 8,
      sources: {
        "google-maps": {
          type: "raster",
          tiles: [
            "https://mt0.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}",
            "https://mt1.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}",
            "https://mt2.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}",
            "https://mt3.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}"
          ],
          tileSize: 256,
        },
      },
      layers: [
        {
          id: "google-maps-layer",
          type: "raster",
          source: "google-maps",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };

    const map = new vietmapgl.Map({
      container: containerRef.current,
      style: GOOGLE_MAPS_STYLE as any,
      center: [lng, lat],
      zoom: 18.5,
    });

    map.addControl(new vietmapgl.NavigationControl(), "top-right");

    map.on("load", () => {
      geocodeCenter(lat, lng);
      if (!initialLat || !initialLng) {
        handleGPS();
      }
    });

    map.on("moveend", () => {
      const center = map.getCenter();
      setCoords({ lat: center.lat, lng: center.lng });
      setOutOfArea(!isWithinServiceArea(center.lat, center.lng));
    });

    map.on("error", (event) => {
      console.warn("Mapbox GL Error:", event?.error?.message);
    });

    mapRef.current = map;

    setTimeout(() => {
      map.resize();
    }, 120);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      map.remove();
      mapRef.current = null;
      setMapError(null);
      setLoadingAddress(false);
    };
  }, [visible, apiKey, initialLat, initialLng, geocodeCenter, handleGPS]);

  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          paddingTop: "calc(12px + var(--zaui-safe-area-inset-top, env(safe-area-inset-top, 32px)))",
          borderBottom: "1px solid #eee",
          background: "#fff",
          zIndex: 10,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            padding: 4,
            color: "#333",
          }}
        >
          ←
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, fontFamily: "Inter, sans-serif" }}>
          Chọn vị trí giao hàng
        </span>
      </div>

      <div
        style={{
          flex: 1,
          position: "relative",
          background: "#e8ecf1",
        }}
      >
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

        {/* Address Search Bar Overlay */}
        <div style={{ position: "absolute", top: 12, left: 16, right: 16, zIndex: 1100 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", background: "#fff", borderRadius: 8, padding: "0 12px", boxShadow: "0 2px 10px rgba(0,0,0,0.15)" }}>
            <span style={{ fontSize: 18, color: "#666" }}>🔍</span>
            <input
              type="text"
              placeholder="Tìm kiếm địa chỉ, đường..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ flex: 1, border: "none", padding: "12px", outline: "none", fontSize: 14, fontFamily: "Inter, sans-serif" }}
            />
            {isSearching && <span style={{ fontSize: 12, color: "#999" }}>Đang tìm...</span>}
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                style={{ background: "none", border: "none", fontSize: 18, color: "#999", cursor: "pointer", padding: "0 4px" }}
              >
                ×
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 && (
            <div style={{ marginTop: 8, background: "#fff", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: 250, overflowY: "auto" }}>
              {searchResults.map((res, i) => (
                <div
                  key={i}
                  onClick={() => selectSearchResult(res)}
                  style={{ padding: "12px 16px", borderBottom: i === searchResults.length - 1 ? "none" : "1px solid #eee", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  <span style={{ fontSize: 16, color: "#00a96d", marginTop: 2 }}>📍</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", marginBottom: 4 }}>
                      {res.name || res.display_name.split(',')[0]}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", lineHeight: 1.4 }}>
                      {res.display_name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {gpsError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1200,
              background: "rgba(255, 255, 255, 0.95)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a2e", marginBottom: 8 }}>
              Yêu cầu bật định vị
            </div>
            <div style={{ fontSize: 14, color: "#666", marginBottom: 20, lineHeight: 1.5 }}>
              Vui lòng bật GPS và cấp quyền truy cập vị trí để chọn địa chỉ giao hàng chính xác.
            </div>
            <button
              onClick={handleGPS}
              style={{
                background: "#00a96d",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Thử lại
            </button>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -100%)",
            zIndex: 1000,
            pointerEvents: "none",
            fontSize: 36,
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.3))",
          }}
        >
          📍
        </div>

        <button
          onClick={handleGPS}
          disabled={gpsLoading}
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            zIndex: 1000,
            width: "auto",
            padding: "0 16px",
            height: 44,
            borderRadius: 22,
            background: "#fff",
            border: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: "pointer",
            opacity: gpsLoading ? 0.6 : 1,
          }}
        >
          <span style={{ fontSize: 20 }}>{gpsLoading ? "⏳" : "📡"}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>Vị trí hiện tại</span>
        </button>

        {mapError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1100,
              background: "rgba(255,247,237,0.95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: "#9a3412",
              padding: 16,
              fontSize: 13,
            }}
          >
            Không thể tải bản đồ. Vui lòng kiểm tra kết nối.
          </div>
        )}
      </div>

      <div
        style={{
          padding: "16px",
          background: "#fff",
          borderTop: "1px solid #eee",
          boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
        }}
      >
        {outOfArea && (
          <div
            style={{
              background: "#fef3c7",
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: 10,
              fontSize: 12,
              color: "#92400e",
              fontWeight: 500,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Vị trí này nằm ngoài vùng phục vụ
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#1a1a2e",
                fontFamily: "Inter, sans-serif",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as any,
              }}
            >
              {loadingAddress ? "Đang cập nhật địa chỉ..." : address}
            </div>
          </div>
        </div>

        <button
          onClick={() =>
            onConfirm({
              lat: coords.lat,
              lng: coords.lng,
              address: address || FALLBACK_ADDRESS,
            })
          }
          disabled={loadingAddress || outOfArea || !!mapError || gpsError}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: "none",
            fontWeight: 700,
            fontSize: 15,
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
            color: "#fff",
            background: outOfArea || mapError || gpsError ? "#ccc" : "linear-gradient(135deg, #00a96d, #00c97d)",
            boxShadow: outOfArea || mapError || gpsError ? "none" : "0 4px 16px rgba(0,169,109,0.3)",
            opacity: loadingAddress ? 0.7 : 1,
          }}
        >
          {outOfArea ? "Ngoài vùng phục vụ" : "Xác nhận vị trí này"}
        </button>
      </div>
    </div>
  );
};
