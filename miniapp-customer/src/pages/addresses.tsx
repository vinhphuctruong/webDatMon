import React, { FC, useState } from "react";
import { Box, Header, Page, Text, Input, Button, Icon, Modal, useSnackbar } from "zmp-ui";
import { useRecoilState } from "recoil";
import { savedAddressesState, SavedAddress } from "state";
import { THU_DAU_MOT_CENTER, reverseGeocode } from "utils/location";
import { getLocation } from "zmp-sdk";

const AddressesPage: FC = () => {
  const [addresses, setAddresses] = useRecoilState(savedAddressesState);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const snackbar = useSnackbar();

  const handleAddAddress = () => {
    if (!newLabel || !newAddress || !newName || !newPhone) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập đầy đủ thông tin" });
      return;
    }
    const newEntry: SavedAddress = {
      id: Math.random().toString(36).substring(7),
      label: newLabel,
      address: newAddress,
      lat: newLat || THU_DAU_MOT_CENTER.lat,
      long: newLng || THU_DAU_MOT_CENTER.lng,
      contactName: newName,
      contactPhone: newPhone,
    };
    setAddresses([...addresses, newEntry]);
    setIsAddModalOpen(false);
    setNewLabel("");
    setNewAddress("");
    setNewName("");
    setNewPhone("");
    setNewLat(null);
    setNewLng(null);
    snackbar.openSnackbar({ type: "success", text: "Thêm địa chỉ thành công" });
  };

  const handleGetLocation = async () => {
    snackbar.openSnackbar({ type: "info", text: "Đang lấy vị trí...", duration: 2000 });

    const fetchAddressFromCoords = async (lat: number, lng: number) => {
      const shortAddress = await reverseGeocode(lat, lng);
      if (shortAddress) {
        setNewAddress(shortAddress);
      }
    };

    const getHtml5Location = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setNewLat(lat);
            setNewLng(lng);
            fetchAddressFromCoords(lat, lng);
            snackbar.openSnackbar({ type: "success", text: "Đã điền địa chỉ (HTML5)" });
          },
          (err) => {
            console.error("HTML5 Geo Error", err);
            snackbar.openSnackbar({ type: "error", text: "Không thể lấy vị trí. Vui lòng bật GPS." });
          },
          { timeout: 5000, maximumAge: 0, enableHighAccuracy: true }
        );
      } else {
        snackbar.openSnackbar({ type: "error", text: "Thiết bị không hỗ trợ định vị." });
      }
    };

    try {
      // Try Zalo SDK first
      let isResolved = false;
      const { latitude, longitude } = await Promise.race([
        getLocation({
          fail: (error) => {
            console.error("Zalo Geo Error:", error);
            if (!isResolved) getHtml5Location();
          }
        }),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 3000))
      ]);
      
      isResolved = true;
      if (latitude && longitude) {
        const lat = Number(latitude);
        const lng = Number(longitude);
        setNewLat(lat);
        setNewLng(lng);
        fetchAddressFromCoords(lat, lng);
        snackbar.openSnackbar({ type: "success", text: "Đã tự động điền địa chỉ" });
      } else {
        getHtml5Location();
      }
    } catch (err) {
      console.warn("Zalo getLocation failed or timed out, falling back to HTML5", err);
      getHtml5Location();
    }
  };

  const handleDelete = (id: string) => {
    setAddresses(addresses.filter(a => a.id !== id));
    snackbar.openSnackbar({ type: "success", text: "Đã xóa địa chỉ" });
  };

  return (
    <Page style={{ background: "var(--tm-bg)" }}>
      <Header title="Địa chỉ đã lưu" showBackIcon />
      <Box style={{ padding: "16px" }}>
        {addresses.length === 0 ? (
          <Box className="flex flex-col items-center justify-center py-10">
            <Text style={{ color: "var(--tm-text-secondary)" }}>Bạn chưa có địa chỉ nào được lưu</Text>
          </Box>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <div key={addr.id} className="tm-card" style={{ padding: "14px 16px", marginBottom: 12, position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: "50%", background: "var(--tm-primary-light)", 
                      color: "var(--tm-primary)", display: "flex", alignItems: "center", justifyContent: "center" 
                    }}>
                      <Icon icon={addr.label.toLowerCase() === "nhà" ? "zi-home" : "zi-location"} />
                    </div>
                    <Text style={{ fontWeight: 600, fontSize: 16, color: "var(--tm-text-primary)" }}>
                      {addr.label}
                    </Text>
                  </div>
                  <div 
                    style={{ color: "var(--tm-danger)", padding: 4, cursor: "pointer" }}
                    onClick={() => handleDelete(addr.id)}
                  >
                    <Icon icon="zi-delete" />
                  </div>
                </div>
                <Text size="small" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
                  {addr.address}
                </Text>
                <Text size="xSmall" style={{ color: "var(--tm-text-tertiary)" }}>
                  {addr.contactName} - {addr.contactPhone}
                </Text>
              </div>
            ))}
          </div>
        )}
      </Box>

      <Box style={{ padding: "16px", position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid var(--tm-border)" }}>
        <Button
          fullWidth
          onClick={() => setIsAddModalOpen(true)}
          style={{ background: "var(--tm-primary)", color: "#fff", fontWeight: 600 }}
        >
          Thêm địa chỉ mới
        </Button>
      </Box>

      <Modal
        visible={isAddModalOpen}
        title="Thêm địa chỉ mới"
        onClose={() => setIsAddModalOpen(false)}
        actions={[
          {
            text: "Hủy",
            onClick: () => setIsAddModalOpen(false),
          },
          {
            text: "Lưu",
            highLight: true,
            onClick: handleAddAddress,
          },
        ]}
      >
        <Box style={{ padding: "8px 0" }} className="space-y-4">
          <Input 
            label="Tên gợi nhớ (VD: Nhà, Công ty)" 
            value={newLabel} 
            onChange={(e) => setNewLabel(e.target.value)} 
          />
          <Input 
            label="Địa chỉ chi tiết" 
            value={newAddress} 
            onChange={(e) => setNewAddress(e.target.value)} 
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
            <Button
              size="small"
              variant="secondary"
              onClick={handleGetLocation}
              style={{ background: newLat ? "var(--tm-primary-light)" : "#f4f5f6", color: newLat ? "var(--tm-primary)" : "var(--tm-text-secondary)", width: "auto", flex: "none" }}
            >
              <Icon icon="zi-location" style={{ fontSize: 16, marginRight: 4 }} />
              {newLat ? "Đã đính kèm GPS" : "Lấy toạ độ GPS"}
            </Button>
            {newLat && (
              <Text size="xxxSmall" style={{ color: "var(--tm-primary)", fontWeight: 500 }}>
                ✓ Đã lưu {newLat.toFixed(4)}, {newLng?.toFixed(4)}
              </Text>
            )}
          </div>
          {newLat && (
            <Text size="xxxSmall" style={{ color: "var(--tm-danger)", marginTop: -4, fontStyle: "italic" }}>
              * Vui lòng nhấp vào ô "Địa chỉ chi tiết" để bổ sung số nhà, ngõ/hẻm (nếu có) giúp tài xế dễ tìm hơn nhé!
            </Text>
          )}
          <Input 
            label="Tên người nhận" 
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
      </Modal>
    </Page>
  );
};

export default AddressesPage;
