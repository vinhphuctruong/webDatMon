import React, { FC, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useRecoilState } from "recoil";
import { Box, Text, useNavigate, useSnackbar } from "zmp-ui";
import { DisplayPrice } from "components/display/price";
import { fetchStoreDetail, StoreDetail } from "services/backend";
import { Product } from "types/product";
import { cartState } from "state";
import { calcFinalPrice } from "utils/product";

const StoreDetailPage: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const storeId = searchParams.get("id") || "";

  const [store, setStore] = useState<StoreDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useRecoilState(cartState);

  const cartQty = cart.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => {
    if (!storeId) { setError("Thiếu thông tin cửa hàng"); setLoading(false); return; }
    setLoading(true);
    fetchStoreDetail(storeId)
      .then(({ store, products }) => { setStore(store); setProducts(products); })
      .catch(() => setError("Không tải được thông tin cửa hàng"))
      .finally(() => setLoading(false));
  }, [storeId]);

  const addToCart = useCallback((product: Product) => {
    const session = localStorage.getItem("zaui_food_session");
    if (!session) {
      navigate("/login");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1, options: {} }];
    });
    snackbar.openSnackbar({ type: "success", text: `Đã thêm ${product.name}` });
  }, [setCart, snackbar, navigate]);

  if (loading) {
    return (
      <Box className="flex-1 flex items-center justify-center" style={{ background: "var(--tm-bg)", minHeight: "100vh" }}>
        <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
      </Box>
    );
  }

  if (error || !store) {
    return (
      <Box className="flex-1 flex items-center justify-center" style={{ background: "var(--tm-bg)", minHeight: "100vh", flexDirection: "column", gap: 12 }}>
        <Text style={{ color: "var(--tm-text-secondary)", fontSize: 14 }}>{error || "Không tìm thấy cửa hàng"}</Text>
        <button onClick={() => window.history.back()} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--tm-primary)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Quay lại</button>
      </Box>
    );
  }

  return (
    <Box style={{ background: "var(--tm-bg)", minHeight: "100vh", paddingBottom: cartQty > 0 ? 70 : 16 }}>
      {/* Header / Store Info */}
      <div style={{
        background: "linear-gradient(135deg, #00a96d 0%, #00c97d 100%)",
        padding: "16px 16px 20px", color: "#fff",
      }}>
        <button onClick={() => window.history.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12, marginTop: "calc(env(safe-area-inset-top, 0px) + 32px)", position: "relative", zIndex: 100 }}>
          ← Quay lại
        </button>
        <Text style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{store.name}</Text>
        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>📍 {store.address}</Text>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: 20 }}>
            {store.rating > 0 ? `⭐ ${store.rating.toFixed(1)}` : "🆕 Mới"}
          </span>
          <span style={{ fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: 20 }}>
            🕐 {store.etaMinutesMin}-{store.etaMinutesMax} phút
          </span>
          <span style={{ fontSize: 12, background: store.isOpen ? "rgba(255,255,255,0.2)" : "rgba(239,68,68,0.8)", padding: "4px 10px", borderRadius: 20 }}>
            {store.isOpen ? "🟢 Đang mở" : "🔴 Đã đóng"}
          </span>
        </div>
      </div>

      {/* Menu title */}
      <div style={{ padding: "16px 16px 8px" }}>
        <Text style={{ fontSize: 17, fontWeight: 700, color: "var(--tm-text-primary)" }}>
          Thực đơn ({products.length} món)
        </Text>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--tm-text-secondary)" }}>
          Cửa hàng chưa có sản phẩm nào
        </div>
      ) : (
        <div style={{ padding: "0 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {products.map((product) => {
            const finalPrice = calcFinalPrice(product, {});
            const cartItem = cart.find(i => i.product.id === product.id);
            return (
              <div key={String(product.id)} style={{
                background: "#fff", borderRadius: 12, overflow: "hidden",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column",
              }}>
                <div onClick={() => navigate(`/product?id=${product.backendId || product.id}`)} style={{ cursor: "pointer" }}>
                {product.image ? (
                  <img src={product.image} alt={product.name} style={{ width: "100%", height: 120, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: 120, background: "linear-gradient(135deg, #f0fdf4, #ecfeff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🍽️</div>
                )}
                </div>
                {product.sale && (
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", top: -120, right: 6, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                      {product.sale.type === "percent" ? `-${Math.round(product.sale.percent * 100)}%` : `-${(product.sale.amount / 1000).toFixed(0)}K`}
                    </span>
                  </div>
                )}
                <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <Text style={{ fontSize: 13, fontWeight: 600, color: "var(--tm-text-primary)", marginBottom: 4, lineHeight: 1.3 }}>
                    {product.name}
                  </Text>
                  {product.description && (
                    <Text style={{ fontSize: 11, color: "var(--tm-text-secondary)", marginBottom: 6, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {product.description}
                    </Text>
                  )}
                  <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                    {product.sale ? (
                      <>
                        <Text style={{ fontSize: 14, fontWeight: 700, color: "var(--tm-primary)" }}><DisplayPrice>{finalPrice}</DisplayPrice></Text>
                        <Text style={{ fontSize: 11, color: "var(--tm-text-muted)", textDecoration: "line-through" }}><DisplayPrice>{product.price}</DisplayPrice></Text>
                      </>
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: 700, color: "var(--tm-primary)" }}><DisplayPrice>{product.price}</DisplayPrice></Text>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--tm-text-secondary)" }}>
                      {(product.rating ?? 0) > 0 ? `⭐ ${(product.rating ?? 0).toFixed(1)}` : "🆕 Mới"} · Đã bán {product.sold ?? 0}
                    </span>
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!store.isOpen}
                      style={{
                        width: 28, height: 28, borderRadius: "50%", border: "none",
                        background: store.isOpen ? "var(--tm-primary)" : "#ccc",
                        color: "#fff", fontSize: 16, fontWeight: 700, cursor: store.isOpen ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                        position: "relative",
                      }}
                    >
                      +
                      {cartItem && cartItem.quantity > 0 && (
                        <span style={{
                          position: "absolute", top: -6, right: -6,
                          background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700,
                          width: 16, height: 16, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>{cartItem.quantity}</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Cart Bar */}
      {cartQty > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#fff", borderTop: "1px solid var(--tm-border)",
          padding: "10px 16px", paddingBottom: "max(10px, env(safe-area-inset-bottom))",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          zIndex: 100,
        }}>
          <Text style={{ fontSize: 14, fontWeight: 600, color: "var(--tm-text-primary)" }}>
            🛒 {cartQty} món trong giỏ
          </Text>
          <button
            onClick={() => navigate("/cart")}
            style={{
              padding: "9px 20px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, var(--tm-primary), #00c97d)",
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,169,109,0.3)",
            }}
          >
            Xem giỏ hàng
          </button>
        </div>
      )}
    </Box>
  );
};

export default StoreDetailPage;
