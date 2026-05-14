import React, { useState, useEffect } from "react";
import { Page, Box, Text, useSnackbar } from "zmp-ui";
import { useNavigate, useParams } from "react-router";
import { createManagedStoreProduct, updateManagedStoreProduct, fetchCategories, apiFetch } from "services/api";

const ProductFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [saving, setSaving] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    deliveryFee: 15000,
    categoryKeys: [] as string[],
    imageUrl: "",
    isAvailable: true,
  });

  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchCategories()
      .then((res) => {
        if (res.data) setCategories(res.data);
      })
      .catch(console.error);
  }, []);

  // Load existing product when editing
  useEffect(() => {
    if (!id) return;
    setLoadingProduct(true);
    apiFetch<any>(`/products/${id}`, {}, { auth: true })
      .then((res) => {
        const p = res.data;
        if (p) {
          setFormData({
            name: p.name || "",
            description: p.description || "",
            price: p.price || 0,
            deliveryFee: p.deliveryFee ?? 15000,
            categoryKeys: (p.categories || []).map((c: any) => c.key || c.category?.key).filter(Boolean),
            imageUrl: p.imageUrl || "",
            isAvailable: p.isAvailable !== false,
          });
        }
      })
      .catch((err: any) => {
        openSnackbar({ text: err.message || "Không tải được thông tin món", type: "error" });
      })
      .finally(() => setLoadingProduct(false));
  }, [id]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        openSnackbar({ text: "Ảnh quá lớn, vui lòng chọn ảnh < 5MB", type: "error" });
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || formData.price <= 0 || formData.categoryKeys.length === 0) {
      openSnackbar({ text: "Vui lòng nhập tên món, giá và chọn danh mục", type: "error" });
      return;
    }

    setSaving(true);
    try {
      if (isEdit && id) {
        await updateManagedStoreProduct(id, formData);
        openSnackbar({ text: "Đã cập nhật thông tin món", type: "success" });
      } else {
        await createManagedStoreProduct(formData);
        openSnackbar({ text: "Đã thêm món mới", type: "success" });
      }
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
          <Text.Title style={{ marginBottom: 0 }}>{isEdit ? "Sửa thông tin món" : "Thêm món mới"}</Text.Title>
        </div>
      </Box>

      <Box p={4} className="tm-content-pad">
        {loadingProduct ? (
          <Text style={{ textAlign: "center", color: "var(--tm-text-secondary)", marginTop: 20 }}>Đang tải thông tin món...</Text>
        ) : (
          <form className="tm-card" style={{ padding: 16 }} onSubmit={handleSave}>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <Text style={{ fontWeight: 600, marginBottom: 8 }}>
                  Tên món <span style={{ color: "red" }}>*</span>
                </Text>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                  placeholder="VD: Cà phê sữa đá"
                />
              </div>

              <div>
                <Text style={{ fontWeight: 600, marginBottom: 8 }}>
                  Giá (VND) <span style={{ color: "red" }}>*</span>
                </Text>
                <input
                  type="number"
                  value={formData.price || ""}
                  onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                  style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                  placeholder="VD: 25000"
                />
              </div>

              <div>
                <Text style={{ fontWeight: 600, marginBottom: 8 }}>Phí giao hàng (VND)</Text>
                <input
                  type="number"
                  value={formData.deliveryFee || ""}
                  onChange={(e) => setFormData({ ...formData, deliveryFee: parseInt(e.target.value) || 0 })}
                  style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                  placeholder="VD: 15000"
                />
              </div>

              <div>
                <Text style={{ fontWeight: 600, marginBottom: 8 }}>
                  Danh mục <span style={{ color: "red" }}>*</span>
                </Text>
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
                              setFormData({ ...formData, categoryKeys: keys.filter((k) => k !== cat.key) });
                            } else {
                              setFormData({ ...formData, categoryKeys: [...keys, cat.key] });
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
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          {cat.name}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Text size="small" style={{ color: "var(--tm-text-secondary)" }}>
                    Đang tải danh mục...
                  </Text>
                )}
              </div>

              <div>
                <Text style={{ fontWeight: 600, marginBottom: 8 }}>Mô tả</Text>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                  placeholder="Mô tả ngắn gọn về món ăn"
                />
              </div>

              <div>
                <Text style={{ fontWeight: 600, marginBottom: 8 }}>Hình ảnh món ăn</Text>
                {formData.imageUrl && (
                  <div style={{ marginBottom: 8, position: "relative" }}>
                    <div
                      style={{
                        borderRadius: 8,
                        overflow: "hidden",
                        width: "100%",
                        height: 160,
                        border: "1px solid var(--tm-border)",
                        background: "#f9f9f9",
                      }}
                    >
                      <img src={formData.imageUrl} alt="Ảnh món" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        border: "none",
                        fontSize: 16,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px dashed var(--tm-primary)",
                    textAlign: "center",
                    background: "#f1fdf7",
                  }}
                >
                  <Text style={{ color: "var(--tm-primary)", fontWeight: 600 }}>
                    {formData.imageUrl ? "Chọn ảnh khác" : "📷 Tải ảnh từ máy"}
                  </Text>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                  />
                </div>
              </div>

              {/* Availability toggle for edit mode */}
              {isEdit && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderTop: "1px solid var(--tm-border)",
                  }}
                >
                  <Text style={{ fontWeight: 600 }}>Trạng thái bán</Text>
                  <div
                    onClick={() => setFormData({ ...formData, isAvailable: !formData.isAvailable })}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      background: formData.isAvailable ? "#ecfdf5" : "#fef2f2",
                      color: formData.isAvailable ? "var(--tm-primary)" : "#ef4444",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      border: `1px solid ${formData.isAvailable ? "var(--tm-primary)" : "#fca5a5"}`,
                    }}
                  >
                    {formData.isAvailable ? "✅ Đang bán" : "⛔ Hết món"}
                  </div>
                </div>
              )}

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
                  marginTop: 8,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Thêm món"}
              </button>
            </div>
          </form>
        )}
      </Box>
    </Page>
  );
};

export default ProductFormPage;
