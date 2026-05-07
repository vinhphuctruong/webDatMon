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
  calculateETA,
} from "utils/location";
import { useSnackbar, Sheet, Box, Text, Icon, Button } from "zmp-ui";

const MANUAL_STORE_ID = 999999;

const formatCoordinate = (value: number) =>
  Number.isFinite(value) ? value.toFixed(5) : "--";

import { AddressSearchSheet, AddressSearchResult } from "components/address-search-sheet";

type AddressType = "home" | "office";

export const CustomerLocationPicker: FC = () => {
  const [visible, setVisible] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const snackbar = useSnackbar();
  const location = useRecoilValueLoadable(locationState);
  const manualLocation = useRecoilValue(manualCustomerLocationState);
  const customerAddressText = useRecoilValue(customerAddressTextState);
  
  const setManualLocation = useSetRecoilState(manualCustomerLocationState);
  const setCustomerAddressText = useSetRecoilState(customerAddressTextState);
  const setSelectedStoreIndex = useSetRecoilState(selectedStoreIndexState);
  const setManualContact = useSetRecoilState(manualCustomerContactState);
  
  const [savedAddresses, setSavedAddresses] = useRecoilState(savedAddressesState);

  // Form states
  const [selectedAddress, setSelectedAddress] = useState<AddressSearchResult | null>(null);
  const [formLabel, setFormLabel] = useState<AddressType>("home");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formDefault, setFormDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(true);

  const resetForm = () => {
    setSelectedAddress(null);
    setFormLabel("home");
    setFormName("");
    setFormPhone("");
    setFormNote("");
    setFormDefault(false);
    setIsSaving(true);
  };

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

  const openFormDelayed = () => {
    setVisible(false);
    resetForm();
    setTimeout(() => setShowForm(true), 350);
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

  const handleSearchConfirm = (result: AddressSearchResult) => {
    setSelectedAddress(result);
    setShowSearch(false);
    setShowForm(true);
  };

  const handleConfirmNewAddress = () => {
    if (!selectedAddress) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng chọn địa chỉ" });
      return;
    }
    if (!formName.trim()) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập họ và tên" });
      return;
    }
    if (!formPhone.trim()) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập số điện thoại" });
      return;
    }

    // Close form FIRST to prevent render cascade while portal is mounted
    setShowForm(false);
    setVisible(false);

    try {
      const fullAddress = formNote ? `${selectedAddress.fullName} (${formNote})` : selectedAddress.fullName;

      setCustomerAddressText(fullAddress);
      setManualLocation({ latitude: String(selectedAddress.lat), longitude: String(selectedAddress.lng) });
      setManualContact({ name: formName.trim(), phone: formPhone.trim() });
      setSelectedStoreIndex(0);

      if (isSaving) {
        const labelText = formLabel === "office" ? "Văn Phòng" : "Nhà Riêng";
        const newEntry: SavedAddress = {
          id: Math.random().toString(36).substring(7),
          label: labelText,
          address: selectedAddress.fullName,
          lat: selectedAddress.lat,
          long: selectedAddress.lng,
          contactName: formName.trim(),
          contactPhone: formPhone.trim(),
          note: formNote.trim() || undefined,
        };
        if (formDefault) {
          setSavedAddresses([newEntry, ...savedAddresses]);
        } else {
          setSavedAddresses([...savedAddresses, newEntry]);
        }
      }

      snackbar.openSnackbar({ type: "success", text: "Đã áp dụng địa chỉ giao hàng" });
    } catch (err) {
      console.error("handleConfirmNewAddress error:", err);
      snackbar.openSnackbar({ type: "error", text: "Có lỗi khi lưu địa chỉ" });
    }

    resetForm();
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%", border: "none", borderBottom: "1px solid #e8e8e8",
    padding: "16px 0", fontSize: 15, outline: "none", background: "transparent",
    fontFamily: "Inter, sans-serif", color: "#1a1a2e",
  };

  return (
    <>
      <ListItem onClick={() => setVisible(true)} title="Vị trí giao đến" subtitle={subtitle} />

      {createPortal(
        <Sheet visible={visible} onClose={() => setVisible(false)} autoHeight>
          <Box style={{ padding: "16px", paddingBottom: "24px" }}>
            <Text style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Chọn địa chỉ giao hàng</Text>


            {/* Saved */}
            {savedAddresses.length > 0 && (
              <>
                <Text style={{ fontSize: 14, fontWeight: 600, color: "var(--tm-text-secondary)", margin: "16px 0 8px" }}>Địa chỉ đã lưu</Text>
                {savedAddresses.map((addr) => (
                  <div key={addr.id} className="tm-card" style={{ padding: 12, marginBottom: 12, cursor: "pointer", border: customerAddressText === addr.address ? "2px solid var(--tm-primary)" : "none" }} onClick={() => handleSelectSavedAddress(addr)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Icon icon={addr.label.toLowerCase().includes("nhà") ? "zi-home" : "zi-location"} style={{ color: "var(--tm-primary)" }} />
                      <Text style={{ fontWeight: 600 }}>{addr.label}</Text>
                    </div>
                    <Text size="small" style={{ color: "var(--tm-text-secondary)" }}>{addr.address}</Text>
                    {(addr.contactName || addr.contactPhone) && (
                      <Text size="xSmall" style={{ color: "var(--tm-text-tertiary)", marginTop: 4 }}>{addr.contactName} - {addr.contactPhone}</Text>
                    )}
                  </div>
                ))}
              </>
            )}

            <Button onClick={openFormDelayed} style={{ width: "100%", marginTop: 8, background: "var(--tm-primary-light)", color: "var(--tm-primary)", fontWeight: 600 }}>
              + Thêm địa chỉ mới
            </Button>
          </Box>
        </Sheet>,
        document.body,
      )}

      {/* Search Sheet */}
      <AddressSearchSheet visible={showSearch} onClose={() => { setShowSearch(false); setShowForm(true); }} onConfirm={handleSearchConfirm} />

      {/* Full-page form */}
      {showForm && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#fff", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 50px)", borderBottom: "1px solid #f0f0f0", background: "#fff" }}>
            <div onClick={() => { setShowForm(false); resetForm(); }} style={{ padding: 8, cursor: "pointer" }}>
              <Icon icon="zi-arrow-left" style={{ fontSize: 24 }} />
            </div>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600, marginRight: 32 }}>Địa chỉ mới</Text>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ padding: "4px 20px 20px" }}>
              <input type="text" placeholder="Họ và tên" value={formName} onChange={(e) => setFormName(e.target.value)} style={fieldStyle} />
              <input type="tel" placeholder="Số điện thoại" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} style={fieldStyle} />
              <div onClick={() => { setShowForm(false); setTimeout(() => setShowSearch(true), 100); }} style={{ ...fieldStyle, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: selectedAddress ? "#1a1a2e" : "#999" }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                  {selectedAddress?.fullName || "Tỉnh/Thành phố, Quận/Huyện, Tên đường, Số nhà"}
                </span>
                <Icon icon="zi-chevron-right" style={{ fontSize: 20, color: "#ccc", flexShrink: 0 }} />
              </div>
              <input type="text" placeholder="Ghi chú (Hẻm, tầng, cổng phụ, mốc dễ tìm...)" value={formNote} onChange={(e) => setFormNote(e.target.value)} style={fieldStyle} />
            </div>

            {/* Save toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "8px solid #f4f5f6" }}>
              <Text style={{ fontSize: 15, fontWeight: 500 }}>Lưu địa chỉ cho lần sau</Text>
              <div onClick={() => setIsSaving(!isSaving)} style={{ width: 48, height: 28, borderRadius: 14, background: isSaving ? "var(--tm-primary)" : "#ddd", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: isSaving ? 22 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
            </div>

            {isSaving && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #f0f0f0" }}>
                  <Text style={{ fontSize: 15, fontWeight: 500 }}>Đặt làm mặc định</Text>
                  <div onClick={() => setFormDefault(!formDefault)} style={{ width: 48, height: 28, borderRadius: 14, background: formDefault ? "var(--tm-primary)" : "#ddd", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: formDefault ? 22 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", gap: 12, borderTop: "1px solid #f0f0f0" }}>
                  <Text style={{ fontSize: 15, fontWeight: 500, marginRight: 8 }}>Loại:</Text>
                  {([{ key: "office" as AddressType, text: "Văn Phòng" }, { key: "home" as AddressType, text: "Nhà Riêng" }]).map((item) => (
                    <div key={item.key} onClick={() => setFormLabel(item.key)} style={{ padding: "6px 16px", borderRadius: 6, border: `1.5px solid ${formLabel === item.key ? "var(--tm-primary)" : "#ddd"}`, background: formLabel === item.key ? "var(--tm-primary-light)" : "#fff", color: formLabel === item.key ? "var(--tm-primary)" : "#666", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      {item.text}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ padding: "12px 20px 20px", borderTop: "1px solid #f0f0f0" }}>
            <button onClick={handleConfirmNewAddress} style={{ width: "100%", padding: 14, borderRadius: 8, border: "none", background: "var(--tm-primary)", color: "#fff", fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer" }}>
              Hoàn thành
            </button>
          </div>
        </div>,
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
