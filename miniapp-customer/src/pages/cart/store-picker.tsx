import { ActionSheet } from "components/fullscreen-sheet";
import { ListItem } from "components/list-item";
import React, { FC, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  useRecoilValue,
  useRecoilValueLoadable,
  useSetRecoilState,
  useRecoilState,
} from "recoil";
import {
  customerAddressTextState,
  locationState,
  manualCustomerLocationState,
  manualCustomerContactState,
  manualStoreOverrideState,
  nearbyStoresState,
  requestLocationTriesState,
  selectedStoreIndexState,
  selectedStoreState,
  savedAddressesState,
  cartState,
  SavedAddress,
} from "state";
import { Store } from "types/delivery";
import {
  displayDistance,
  isWithinThuDauMotServiceArea,
  parseCoordinatePair,
  THU_DAU_MOT_CENTER,
  reverseGeocode,
  calculateETA,
} from "utils/location";
import { useSnackbar, Sheet, Box, Text, Icon, Button, Input, Switch } from "zmp-ui";
import { getLocation } from "zmp-sdk";

const MANUAL_STORE_ID = 999999;

const formatCoordinate = (value: number) =>
  Number.isFinite(value) ? value.toFixed(5) : "--";

export const CustomerLocationPicker: FC = () => {
  const [visible, setVisible] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const snackbar = useSnackbar();
  const location = useRecoilValueLoadable(locationState);
  const manualLocation = useRecoilValue(manualCustomerLocationState);
  const customerAddressText = useRecoilValue(customerAddressTextState);
  
  const retry = useSetRecoilState(requestLocationTriesState);
  const setManualLocation = useSetRecoilState(manualCustomerLocationState);
  const setCustomerAddressText = useSetRecoilState(customerAddressTextState);
  const setSelectedStoreIndex = useSetRecoilState(selectedStoreIndexState);
  const setManualContact = useSetRecoilState(manualCustomerContactState);
  
  const [savedAddresses, setSavedAddresses] = useRecoilState(savedAddressesState);

  // Form states
  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const subtitle = useMemo(() => {
    if (location.state !== "hasValue" || !location.contents) {
      return "Đang lấy vị trí tại Thủ Dầu Một...";
    }

    const lat = Number(location.contents.latitude);
    const lng = Number(location.contents.longitude);
    const sourceLabel = manualLocation ? "Nhập tay" : "GPS / Mặc định";
    const coordinateLabel = `${formatCoordinate(lat)}, ${formatCoordinate(lng)} · ${sourceLabel}`;

    if (customerAddressText.trim()) {
      return `${customerAddressText.trim()} (${coordinateLabel})`;
    }

    return coordinateLabel;
  }, [location.state, location.contents, manualLocation, customerAddressText]);

  const applyGpsLocation = () => {
    setManualLocation(null);
    retry((value) => value + 1);
    setSelectedStoreIndex(0);
    setVisible(false);
    snackbar.openSnackbar({
      type: "success",
      text: "Đang lấy vị trí GPS trong khu vực Thủ Dầu Một...",
    });
  };

  const handleSelectSavedAddress = (addr: SavedAddress) => {
    setCustomerAddressText(addr.address);
    setManualLocation({ latitude: String(addr.lat), longitude: String(addr.long) });
    if (addr.contactName || addr.contactPhone) {
       setManualContact({ name: addr.contactName || "Khách hàng", phone: addr.contactPhone || "" });
    }
    setSelectedStoreIndex(0);
    setVisible(false);
    snackbar.openSnackbar({ type: "success", text: "Đã chọn địa chỉ: " + addr.label });
  };

  const handleGetLocation = async () => {
    snackbar.openSnackbar({ type: "info", text: "Đang lấy vị trí...", duration: 2000 });
    
    // Using HTML5 Geolocation as fallback
    const fallbackHTML5 = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            setNewLat(pos.coords.latitude);
            setNewLng(pos.coords.longitude);
            const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
            if (address) setNewAddress(address);
          },
          () => {
            snackbar.openSnackbar({ type: "error", text: "Không thể lấy vị trí. Vui lòng kiểm tra quyền truy cập." });
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      } else {
        snackbar.openSnackbar({ type: "error", text: "Thiết bị không hỗ trợ định vị." });
      }
    };

    let resolved = false;
    try {
      // 1. Zalo SDK getLocation with short timeout
      const zaloLocationPromise = getLocation({});
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Zalo SDK Timeout")), 3000));
      
      const res = await Promise.race([zaloLocationPromise, timeoutPromise]) as any;
      resolved = true;
      
      if (res && res.latitude) {
        const parsedLat = parseFloat(res.latitude);
        const parsedLng = parseFloat(res.longitude);
        setNewLat(parsedLat);
        setNewLng(parsedLng);
        const address = await reverseGeocode(parsedLat, parsedLng);
        if (address) setNewAddress(address);
      } else {
        fallbackHTML5();
      }
    } catch (error) {
      if (!resolved) fallbackHTML5();
    }
  };

  const handleConfirmNewAddress = () => {
    if (!newAddress || !newLat || !newLng) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng đính kèm GPS và nhập địa chỉ" });
      return;
    }
    if (isSaving && !newLabel) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập tên gợi nhớ để lưu" });
      return;
    }
    
    setCustomerAddressText(newAddress);
    setManualLocation({ latitude: String(newLat), longitude: String(newLng) });
    if (newName || newPhone) {
      setManualContact({ name: newName || "Khách hàng", phone: newPhone || "" });
    }
    setSelectedStoreIndex(0);
    
    if (isSaving) {
      const newEntry: SavedAddress = {
        id: Math.random().toString(36).substring(7),
        label: newLabel,
        address: newAddress,
        lat: newLat,
        long: newLng,
        contactName: newName,
        contactPhone: newPhone,
      };
      setSavedAddresses([...savedAddresses, newEntry]);
    }
    
    setVisible(false);
    setShowNewAddressForm(false);
    snackbar.openSnackbar({ type: "success", text: "Đã áp dụng địa chỉ giao hàng mới" });
  };

  return (
    <>
      <ListItem
        onClick={() => setVisible(true)}
        title="Vị trí giao đến"
        subtitle={subtitle}
      />
      {createPortal(
        <Sheet
          visible={visible}
          onClose={() => {
            setVisible(false);
            setShowNewAddressForm(false);
          }}
          autoHeight
        >
          <Box style={{ padding: "16px", paddingBottom: "24px" }}>
            <Text style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              {showNewAddressForm ? "Giao đến địa chỉ mới" : "Chọn địa chỉ giao hàng"}
            </Text>

            {showNewAddressForm ? (
              <Box className="space-y-4">
                <Box>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={handleGetLocation}
                    style={{ background: newLat ? "var(--tm-primary-light)" : "#f4f5f6", color: newLat ? "var(--tm-primary)" : "var(--tm-text-secondary)", width: "100%", marginBottom: 8 }}
                  >
                    <Icon icon="zi-location" style={{ fontSize: 16, marginRight: 4 }} />
                    {newLat ? "Đã đính kèm GPS" : "Lấy toạ độ GPS hiện tại"}
                  </Button>
                  {newLat && (
                    <Text size="xxxSmall" style={{ color: "var(--tm-primary)", fontWeight: 500, marginBottom: 4 }}>
                      ✓ Đã lưu {newLat.toFixed(4)}, {newLng?.toFixed(4)}
                    </Text>
                  )}
                  {newLat && (
                    <Text size="xxxSmall" style={{ color: "var(--tm-danger)", fontStyle: "italic", marginBottom: 8 }}>
                      * Vui lòng bổ sung số nhà, ngõ/hẻm (nếu có) giúp tài xế dễ tìm hơn nhé!
                    </Text>
                  )}
                  <Input 
                    label="Địa chỉ chi tiết" 
                    value={newAddress} 
                    onChange={(e) => setNewAddress(e.target.value)} 
                  />
                </Box>
                
                <Box style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f4f5f6", padding: 12, borderRadius: 8 }}>
                  <Text style={{ fontWeight: 500 }}>Lưu địa chỉ này cho lần sau</Text>
                  <Switch checked={isSaving} onChange={(e) => setIsSaving(e.target.checked)} />
                </Box>

                {isSaving && (
                  <Input 
                    label="Tên gợi nhớ (VD: Nhà, Công ty)" 
                    value={newLabel} 
                    onChange={(e) => setNewLabel(e.target.value)} 
                  />
                )}

                <Box style={{ display: "flex", gap: 12 }}>
                  <Input 
                    label="Người nhận" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                  />
                  <Input 
                    label="Số điện thoại" 
                    type="text"
                    value={newPhone} 
                    onChange={(e) => setNewPhone(e.target.value)} 
                  />
                </Box>

                <Box style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <Button variant="secondary" onClick={() => setShowNewAddressForm(false)} style={{ flex: 1 }}>Hủy</Button>
                  <Button onClick={handleConfirmNewAddress} style={{ flex: 1, background: "var(--tm-primary)", color: "#fff" }}>Xác nhận</Button>
                </Box>
              </Box>
            ) : (
              <Box>
                <div 
                  className="tm-card" 
                  style={{ padding: "12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                  onClick={applyGpsLocation}
                >
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f4f5f6", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tm-text-secondary)" }}>
                    <Icon icon="zi-location" />
                  </div>
                  <div>
                    <Text style={{ fontWeight: 600 }}>Dùng vị trí GPS hiện tại</Text>
                    <Text size="small" style={{ color: "var(--tm-text-secondary)" }}>Định vị chính xác vị trí đang đứng</Text>
                  </div>
                </div>

                {savedAddresses.length > 0 && (
                  <>
                    <Text style={{ fontSize: 14, fontWeight: 600, color: "var(--tm-text-secondary)", margin: "16px 0 8px 0" }}>
                      Địa chỉ đã lưu
                    </Text>
                    {savedAddresses.map((addr) => (
                      <div 
                        key={addr.id}
                        className="tm-card" 
                        style={{ padding: "12px", marginBottom: 12, cursor: "pointer", border: customerAddressText === addr.address ? "2px solid var(--tm-primary)" : "none" }}
                        onClick={() => handleSelectSavedAddress(addr)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <Icon icon={addr.label.toLowerCase() === "nhà" ? "zi-home" : "zi-location"} style={{ color: "var(--tm-primary)" }} />
                          <Text style={{ fontWeight: 600 }}>{addr.label}</Text>
                        </div>
                        <Text size="small" style={{ color: "var(--tm-text-secondary)" }}>{addr.address}</Text>
                        {(addr.contactName || addr.contactPhone) && (
                          <Text size="xSmall" style={{ color: "var(--tm-text-tertiary)", marginTop: 4 }}>
                            {addr.contactName} - {addr.contactPhone}
                          </Text>
                        )}
                      </div>
                    ))}
                  </>
                )}

                <Button 
                  onClick={() => setShowNewAddressForm(true)}
                  style={{ width: "100%", marginTop: 8, background: "var(--tm-primary-light)", color: "var(--tm-primary)", fontWeight: 600 }}
                >
                  + Thêm địa chỉ mới
                </Button>
              </Box>
            )}
          </Box>
        </Sheet>,
        document.body,
      )}
    </>
  );
};


export const StorePicker: FC = () => {
  const [visible, setVisible] = useState(false);
  const snackbar = useSnackbar();
  const nearbyStores = useRecoilValueLoadable(nearbyStoresState);
  const setSelectedStoreIndex = useSetRecoilState(selectedStoreIndexState);
  const selectedStoreLoadable = useRecoilValueLoadable(selectedStoreState);
  const selectedStore =
    selectedStoreLoadable.state === "hasValue" ? selectedStoreLoadable.contents : undefined;
  const manualStore = useRecoilValue(manualStoreOverrideState);
  const setManualStore = useSetRecoilState(manualStoreOverrideState);

  const stores =
    nearbyStores.state === "hasValue"
      ? (nearbyStores.contents as (Store & { distance?: number })[])
      : [];

  const cart = useRecoilValue(cartState);

  if (cart.length > 0) {
    const productStoreName = cart[0].product.storeName;
    const cartStore = stores.find(s => s.name === productStoreName) || selectedStore;
    
    return (
      <ListItem
        title={cartStore?.name || productStoreName || "Quán đối tác"}
        subtitle={cartStore?.address ? `${cartStore.address}${cartStore.phone ? ` · ${cartStore.phone}` : ""}` : "Chi nhánh mặc định"}
      />
    );
  }

  const availableStores = manualStore
    ? stores.filter((store) => store.id !== manualStore.id)
    : stores;

  const applyManualStore = () => {
    const coordinateInput = window.prompt(
      "Nhập tọa độ quán (lat,lng) trong phạm vi Thủ Dầu Một/lân cận",
      `${THU_DAU_MOT_CENTER.lat},${THU_DAU_MOT_CENTER.lng}`,
    );

    if (!coordinateInput) {
      return;
    }

    const parsed = parseCoordinatePair(coordinateInput);
    if (!parsed) {
      snackbar.openSnackbar({
        type: "error",
        text: "Tọa độ quán không hợp lệ. Ví dụ: 10.9804,106.6519",
      });
      return;
    }

    if (!isWithinThuDauMotServiceArea(parsed.lat, parsed.lng)) {
      snackbar.openSnackbar({
        type: "error",
        text: "Quán phải nằm trong Thủ Dầu Một hoặc khu vực lân cận Bình Dương",
      });
      return;
    }

    const name =
      window.prompt("Nhập tên quán", "Quán nhập tay Bình Dương")?.trim() ||
      "Quán nhập tay Bình Dương";
    const address =
      window.prompt("Nhập địa chỉ quán", "Thủ Dầu Một, Bình Dương")?.trim() ||
      "Thủ Dầu Một, Bình Dương";
    const phone =
      window.prompt("Nhập SĐT quán", "0274 3622 899")?.trim() ||
      "0274 3622 899";

    setManualStore({
      id: MANUAL_STORE_ID,
      name,
      address,
      phone,
      lat: parsed.lat,
      long: parsed.lng,
      eta: "15-25 phút",
      rating: 4.7,
    });
    setSelectedStoreIndex(0);
    snackbar.openSnackbar({
      type: "success",
      text: "Đã cập nhật vị trí quán nhập tay",
    });
  };

  if (!selectedStore || selectedStoreLoadable.state === "loading") {
    return <RequestStorePickerLocation />;
  }

  return (
    <>
      <ListItem
        onClick={() => setVisible(true)}
        title={selectedStore.name}
        subtitle={`${selectedStore.address}${selectedStore.phone ? ` · ${selectedStore.phone}` : ""}`}
      />
      {nearbyStores.state === "hasValue" &&
        createPortal(
          <ActionSheet
            title="Chọn quán phục vụ gần bạn"
            visible={visible}
            onClose={() => setVisible(false)}
            actions={[
              [
                {
                  text: "Nhập tọa độ quán thủ công",
                  onClick: () => {
                    setVisible(false);
                    applyManualStore();
                  },
                },
                ...(manualStore
                  ? [
                      {
                        text: "Bỏ quán nhập tay",
                        onClick: () => {
                          setManualStore(null);
                          setSelectedStoreIndex(0);
                          setVisible(false);
                          snackbar.openSnackbar({
                            type: "success",
                            text: "Đã quay về danh sách quán gần bạn",
                          });
                        },
                      },
                    ]
                  : []),
              ],
              availableStores.map((store: Store & { distance?: number }, i) => ({
                text: store.distance
                  ? `${store.name} · ${store.phone ?? "Chưa có SĐT"} · ${calculateETA(store.distance)} · ${displayDistance(store.distance)}`
                  : `${store.name} · ${store.phone ?? "Chưa có SĐT"}`,
                highLight: store.id === selectedStore?.id,
                onClick: () => {
                  setManualStore(null);
                  setSelectedStoreIndex(i);
                },
              })),
              [{ text: "Đóng", close: true, danger: true }],
            ]}
          ></ActionSheet>,
          document.body,
        )}
    </>
  );
};

export const RequestStorePickerLocation: FC = () => {
  const retry = useSetRecoilState(requestLocationTriesState);
  return (
    <ListItem
      onClick={() => retry((r) => r + 1)}
      title="Chọn quán giao hàng"
      subtitle="Bật GPS hoặc nhập tay để đề xuất quán trong khu vực Thủ Dầu Một"
    />
  );
};
