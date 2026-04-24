import React, { useState } from "react";
import { Page, Box, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { createManagedStoreProduct } from "services/api";

const ProductFormPage = () => {
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    categoryKeys: [] as string[],
    imageUrl: "",
    isAvailable: true
  });

  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || formData.price <= 0 || formData.categoryKeys.length === 0) {
      openSnackbar({ text: "Vui lòng nhập tên món, giá và chọn danh mục", type: "error" });
      return;
    }

    setSaving(true);
    try {
      await createManagedStoreProduct(formData);
      openSnackbar({ text: "Đã thêm món mới", type: "success" });
      navigate("/menu");
    } catch (error: any) {
      openSnackbar({ text: error.message || "Lỗi lưu thông tin", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page className="page-with-bg pb-20">
      <Box className="tm-page-topbar tm-page-safe-top" style={{ justifyContent: "flex-start", gap: 12 }}>
        <div className="tm-link-back" onClick={() => navigate(-1)}>
          ← Quay lại
        </div>
        <div className="tm-page-topbar-title">
          <Text.Title style={{ marginBottom: 0 }}>Thêm món mới</Text.Title>
        </div>
      </Box>

      <Box p={4} className="tm-content-pad">
        <form className="tm-card" style={{ padding: 16 }} onSubmit={handleSave}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Tên món <span style={{color: "red"}}>*</span></Text>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                placeholder="VD: Cà phê sữa đá"
              />
            </div>

            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Giá (VND) <span style={{color: "red"}}>*</span></Text>
              <input
                type="number"
                value={formData.price || ""}
                onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                placeholder="VD: 25000"
              />
            </div>

            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Mã Danh mục <span style={{color: "red"}}>*</span></Text>
              <input
                type="text"
                value={formData.categoryKeys.join(", ")}
                onChange={(e) => setFormData({ ...formData, categoryKeys: e.target.value.split(",").map(k => k.trim()).filter(Boolean) })}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                placeholder="VD: drinks, coffee"
              />
              <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 4 }}>Nhập các mã danh mục, cách nhau bởi dấu phẩy</Text>
            </div>

            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Mô tả</Text>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
              />
            </div>
            
            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Link Ảnh</Text>
              <input
                type="text"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
              />
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
              {saving ? "Đang lưu..." : "Lưu món"}
            </button>
          </div>
        </form>
      </Box>
    </Page>
  );
};

export default ProductFormPage;
