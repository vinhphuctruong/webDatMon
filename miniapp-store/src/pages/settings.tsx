import React, { useEffect, useState } from "react";
import { Page, Box, Text, useSnackbar } from "zmp-ui";
import { fetchManagedStore, updateManagedStore } from "services/api";

const SettingsPage = () => {
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
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
    setSaving(true);
    try {
      await updateManagedStore(formData);
      openSnackbar({ text: "Đã lưu thay đổi", type: "success" });
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
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                />
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
    </Page>
  );
};

export default SettingsPage;
