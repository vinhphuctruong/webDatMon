import React, { useEffect, useState } from "react";
import { Page, Box, Text, Icon, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { fetchManagedStoreProducts, updateManagedStoreProduct } from "services/api";
import { formatCurrency } from "utils/formatter";

const MenuPage = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const loadProducts = async () => {
    try {
      const response = await fetchManagedStoreProducts();
      setProducts(response.data);
    } catch (error: any) {
      openSnackbar({ text: error.message || "Lỗi tải danh sách món", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const toggleAvailability = async (id: string, current: boolean) => {
    try {
      await updateManagedStoreProduct(id, { isAvailable: !current });
      setProducts(products.map(p => p.id === id ? { ...p, isAvailable: !current } : p));
      openSnackbar({ text: !current ? "Đã bật bán món" : "Đã báo hết món", type: "success" });
    } catch (error: any) {
      openSnackbar({ text: error.message || "Lỗi cập nhật", type: "error" });
    }
  };

  return (
    <Page className="page-with-bg pb-20">
      <Box className="tm-page-topbar tm-page-topbar-wrap tm-page-safe-top">
        <div className="tm-page-topbar-title">
          <Text.Title style={{ marginBottom: 0 }}>Thực đơn</Text.Title>
        </div>
        <div className="tm-page-topbar-actions">
          <button
            className="tm-btn-primary-inline"
            onClick={() => navigate("/product-form")}
          >
            <Icon icon="zi-plus" size={16} />
            Thêm món
          </button>
        </div>
      </Box>

      <Box p={4} className="tm-content-pad">
        {loading ? (
          <Text style={{ textAlign: "center", color: "var(--tm-text-secondary)", marginTop: 20 }}>Đang tải...</Text>
        ) : products.length === 0 ? (
          <Text style={{ textAlign: "center", color: "var(--tm-text-secondary)", marginTop: 20 }}>Chưa có sản phẩm nào.</Text>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {products.map(product => (
              <div key={product.id} className="tm-card" style={{ padding: 12, display: "flex", gap: 12, opacity: product.isAvailable ? 1 : 0.6 }}>
                <img 
                  src={product.imageUrl || "https://placehold.co/100"} 
                  alt={product.name} 
                  style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, background: "#f1f5f3", flexShrink: 0 }} 
                />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <Text style={{ fontWeight: 600 }}>{product.name}</Text>
                    <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>{product.categories?.[0]?.category?.name || "Khác"}</Text>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text.Title style={{ fontSize: 15, color: "var(--tm-primary)" }}>{formatCurrency(product.price)}</Text.Title>
                    <div 
                      onClick={() => toggleAvailability(product.id, product.isAvailable)}
                      style={{ 
                        background: product.isAvailable ? "#ecfdf5" : "#fef2f2", 
                        color: product.isAvailable ? "var(--tm-primary)" : "#ef4444",
                        padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      {product.isAvailable ? "Sẵn sàng" : "Hết món"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Box>
    </Page>
  );
};

export default MenuPage;
