import React, { useEffect, useState } from "react";
import { Page, Box, Text, useSnackbar, Icon } from "zmp-ui";
import { fetchManagedStore, updateManagedStore } from "services/api";
import { normalizeStoredCoordinates } from "utils/location";
import { AddressSearchSheet } from "components/address-search-sheet";

const SettingsPage = () => {
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    lat: null as number | null,
    lng: null as number | null,
    etaMinutesMin: 15,
    etaMinutesMax: 30
  });

  const { openSnackbar } = useSnackbar();

  const loadStore = async () => {
    try {
      const response = await fetchManagedStore();
      setStore(response.data);
      setFormData({
        name: response.data.name || "",
        address: response.data.address || "",
        lat: response.data.latitude ? Number(response.data.latitude) : null,
        lng: response.data.longitude ? Number(response.data.longitude) : null,
        etaMinutesMin: response.data.etaMinutesMin || 15,
        etaMinutesMax: response.data.etaMinutesMax || 30,
      });
    } catch (error: any) {
      openSnackbar({ text: error.message || "Lỗi tải thông tin", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStore();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) {
      openSnackbar({ text: "Vui lòng nhập Tên cửa hàng và Địa chỉ", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const existingCoordinates = normalizeStoredCoordinates(store?.latitude, store?.longitude);
      const resolvedCoordinates = (formData.lat && formData.lng) 
        ? { lat: formData.lat, lng: formData.lng } 
        : existingCoordinates;

      await updateManagedStore({
        name: formData.name.trim(),
        address: formData.address.trim(),
        etaMinutesMin: formData.etaMinutesMin,
        etaMinutesMax: formData.etaMinutesMax,
        ...(resolvedCoordinates
          ? {
              latitude: resolvedCoordinates.lat,
              longitude: resolvedCoordinates.lng,
            }
          : {}),
      });
      await loadStore();

      if (!resolvedCoordinates) {
        openSnackbar({
          text: "Đã lưu thay đổi. Vui lòng chọn địa chỉ từ danh sách tìm kiếm.",
          type: "success",
        });
      } else if (existingCoordinates?.wasSwapped && resolvedCoordinates === existingCoordinates) {
        openSnackbar({
          text: "Đã lưu thay đổi và tự sửa tọa độ cũ bị đảo.",
          type: "success",
        });
      } else {
        openSnackbar({ text: "Đã lưu thay đổi", type: "success" });
      }
    } catch (error: any) {
      openSnackbar({ text: error.message || "Lỗi lưu thông tin", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page className="page-with-bg pb-20">
      <Box className="tm-page-topbar tm-page-safe-top">
        <div className="tm-page-topbar-title">
          <Text.Title style={{ marginBottom: 0 }}>Cài đặt Cửa hàng</Text.Title>
        </div>
      </Box>

      <Box p={4} className="tm-content-pad">
        {loading ? (
          <Text style={{ textAlign: "center", color: "var(--tm-text-secondary)", marginTop: 20 }}>Đang tải...</Text>
        ) : (
          <form className="tm-card" style={{ padding: 16 }} onSubmit={handleSave}>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <Text style={{ fontWeight: 600, marginBottom: 8 }}>Tên cửa hàng</Text>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                />
              </div>

              <div>
                <Text style={{ fontWeight: 600, marginBottom: 8 }}>Địa chỉ</Text>
                <div 
                  onClick={() => setIsSearchSheetOpen(true)}
                  style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ color: formData.address ? "#000" : "#999", flex: 1, whiteSpace: "normal" }}>
                    {formData.address || "Nhấn để tìm địa chỉ..."}
                  </span>
                  <Icon icon="zi-location" style={{ color: "var(--tm-primary)", flexShrink: 0, marginLeft: 8 }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                <div>
                  <Text style={{ fontWeight: 600, marginBottom: 8 }}>TG Chuẩn bị (phút)</Text>
                  <input
                    type="number"
                    value={formData.etaMinutesMin}
                    onChange={(e) => setFormData({ ...formData, etaMinutesMin: parseInt(e.target.value) || 0 })}
                    style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                  />
                </div>
                <div>
                  <Text style={{ fontWeight: 600, marginBottom: 8 }}>TG Giao tối đa (phút)</Text>
                  <input
                    type="number"
                    value={formData.etaMinutesMax}
                    onChange={(e) => setFormData({ ...formData, etaMinutesMax: parseInt(e.target.value) || 0 })}
                    style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "var(--tm-primary)",
                  color: "#fff",
                  fontWeight: 600,
                  border: "none",
                  marginTop: 16,
                  opacity: saving ? 0.7 : 1
                }}
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        )}
      </Box>
      <AddressSearchSheet
        visible={isSearchSheetOpen}
        onClose={() => setIsSearchSheetOpen(false)}
        onConfirm={(res) => {
          setFormData({ ...formData, address: res.fullName, lat: res.lat, lng: res.lng });
          setIsSearchSheetOpen(false);
        }}
      />
    </Page>
  );
};

export default SettingsPage;
