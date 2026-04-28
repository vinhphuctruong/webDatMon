import React, { useState, useEffect } from "react";
import { Page, Box, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { createManagedStoreProduct, fetchCategories } from "services/api";

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

  const [categories, setCategories] = useState<any[]>([]);
  
  useEffect(() => {
    fetchCategories().then(res => {
      if (res.data) setCategories(res.data);
    }).catch(err => {
      console.error(err);
    });
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        openSnackbar({ text: "Ảnh quá lớn, vui lòng chọn ảnh < 1MB", type: "error" });
        e.target.value = '';
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

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
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Danh mục <span style={{color: "red"}}>*</span></Text>
              {categories.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {categories.map((cat) => {
                    const isSelected = formData.categoryKeys.includes(cat.key);
                    return (
                      <div 
                        key={cat.key}
                        onClick={() => {
                          const keys = formData.categoryKeys;
                          if (isSelected) {
                            setFormData({...formData, categoryKeys: keys.filter(k => k !== cat.key)});
                          } else {
                            setFormData({...formData, categoryKeys: [...keys, cat.key]});
                          }
                        }}
                        style={{ 
                          padding: "8px 12px", 
                          borderRadius: 20, 
                          border: isSelected ? "1px solid var(--tm-primary)" : "1px solid var(--tm-border)",
                          background: isSelected ? "#f1fdf7" : "#fff",
                          color: isSelected ? "var(--tm-primary)" : "var(--tm-text-secondary)",
                          fontSize: 14,
                          cursor: "pointer",
                          fontWeight: isSelected ? 600 : 400
                        }}
                      >
                        {cat.name}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Text size="small" style={{ color: "var(--tm-text-secondary)" }}>Đang tải danh mục...</Text>
              )}
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
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Hình ảnh món ăn</Text>
              {formData.imageUrl && (
                <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', width: '100%', height: 160, border: "1px solid var(--tm-border)", background: "#f9f9f9" }}>
                  <img src={formData.imageUrl} alt="Ảnh món" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              
              <div style={{ position: "relative", width: "100%", padding: 12, borderRadius: 8, border: "1px dashed var(--tm-primary)", textAlign: "center", background: "#f1fdf7" }}>
                <Text style={{ color: "var(--tm-primary)", fontWeight: 600 }}>
                  {formData.imageUrl ? "Chọn ảnh khác" : "📸 Tải ảnh từ máy"}
                </Text>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
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
              {saving ? "Đang lưu..." : "Lưu món"}
            </button>
          </div>
        </form>
      </Box>
    </Page>
  );
};

export default ProductFormPage;
