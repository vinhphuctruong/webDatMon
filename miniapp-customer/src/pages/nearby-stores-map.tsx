import React, { FC, useMemo, useState } from "react";
import { Page, Header, Text } from "zmp-ui";
import { useRecoilValueLoadable } from "recoil";
import { useNavigate } from "react-router";
import { nearbyStoresState, locationState } from "state";
import { Store } from "types/delivery";
import { THU_DAU_MOT_CENTER, displayDistance, calculateETA } from "utils/location";
import { LocationGate } from "components/location-gate";
import { VietMapView, MapMarker } from "components/vietmap";

const NearbyStoresMapPage: FC = () => {
  const navigate = useNavigate();
  const nearbyStores = useRecoilValueLoadable(nearbyStoresState);
  const userLocation = useRecoilValueLoadable(locationState);
  const [selectedStore, setSelectedStore] = useState<(Store & { distance?: number }) | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  const stores = useMemo(
    () =>
      nearbyStores.state === "hasValue"
        ? (nearbyStores.contents as (Store & { distance?: number })[])
        : [],
    [nearbyStores.state, nearbyStores.contents],
  );

  const userLat =
    userLocation.state === "hasValue" && userLocation.contents
      ? parseFloat(String(userLocation.contents.latitude))
      : THU_DAU_MOT_CENTER.lat;
  const userLng =
    userLocation.state === "hasValue" && userLocation.contents
      ? parseFloat(String(userLocation.contents.longitude))
      : THU_DAU_MOT_CENTER.lng;

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [
      {
        id: "user-location",
        lat: userLat,
        lng: userLng,
        label: "Vi tri cua ban",
        type: "customer",
      },
    ];

    stores.forEach((store) => {
      markers.push({
        id: store.id,
        lat: store.lat,
        lng: store.long,
        label: store.name,
        type: "store",
        color: selectedStore?.id === store.id ? "#0ea5e9" : undefined,
      });
    });

    return markers;
  }, [stores, userLat, userLng, selectedStore?.id]);

  return (
    <Page style={{ background: "#fff", display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header title="Quan gan ban" showBackIcon />
      <LocationGate message="Cho phep truy cap vi tri de tim quan gan ban va tinh khoang cach chinh xac">
        <div
          style={{
            display: "flex",
            gap: 0,
            margin: "0 16px 8px",
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid var(--tm-border)",
          }}
        >
          {(["map", "list"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                flex: 1,
                padding: "8px 0",
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
                background: viewMode === mode ? "var(--tm-primary)" : "#fff",
                color: viewMode === mode ? "#fff" : "var(--tm-text-secondary)",
              }}
            >
              {mode === "map" ? " Ban do" : " Danh sach"}
            </button>
          ))}
        </div>

        {viewMode === "map" ? (
          <div style={{ flex: 1, position: "relative" }}>
            <VietMapView
              center={[userLng, userLat]}
              zoom={14}
              markers={mapMarkers}
              height="100%"
              onMarkerClick={(marker) => {
                if (marker.type !== "store") {
                  return;
                }
                const matched = stores.find((store) => String(store.id) === String(marker.id));
                if (matched) {
                  setSelectedStore(matched);
                }
              }}
            />

            {selectedStore && (
              <div
                style={{
                  position: "absolute",
                  bottom: 16,
                  left: 16,
                  right: 16,
                  zIndex: 1000,
                  background: "#fff",
                  borderRadius: 16,
                  padding: 14,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "#e8f5e9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    flexShrink: 0,
                  }}
                >
                  
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "Inter, sans-serif" }}>
                    {selectedStore.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
                    {selectedStore.distance
                      ? `${displayDistance(selectedStore.distance)} · ${calculateETA(selectedStore.distance)}`
                      : selectedStore.address || "Quan doi tac"}
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/store/${selectedStore.id}`)}
                  style={{
                    background: "var(--tm-primary)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  Xem quan
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
            {stores.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}></div>
                <Text>Chua co quan nao gan ban</Text>
              </div>
            ) : (
              stores.map((store) => (
                <div
                  key={store.id}
                  onClick={() => navigate(`/store/${store.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    marginBottom: 8,
                    borderRadius: 14,
                    border: "1px solid #f0f0f0",
                    cursor: "pointer",
                    background: "#fff",
                    transition: "box-shadow 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "#e8f5e9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      flexShrink: 0,
                    }}
                  >
                    
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, fontFamily: "Inter, sans-serif" }}>{store.name}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
                      {store.address || "Quan doi tac"}
                    </div>
                  </div>
                  {store.distance && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--tm-primary)",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {displayDistance(store.distance)}
                      </div>
                      <div style={{ fontSize: 10, color: "#999", fontFamily: "Inter, sans-serif" }}>
                        {calculateETA(store.distance)}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </LocationGate>
    </Page>
  );
};

export default NearbyStoresMapPage;
