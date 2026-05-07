import React, { FC, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useRecoilState } from "recoil";
import { Box, Text, useNavigate, useSnackbar } from "zmp-ui";
import { DisplayPrice } from "components/display/price";
import {
  fetchProductDetail,
  ProductReviewItem,
  ProductReviewStats,
} from "services/backend";
import { Product } from "types/product";
import { cartState, locationState, remoteStoresState } from "state";
import { calcFinalPrice } from "utils/product";
import { useRecoilValueLoadable } from "recoil";
import { calculateDistance } from "utils/location";

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("vi-VN");
};

const ProductDetailPage: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const productId = searchParams.get("id") || "";

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReviewItem[]>([]);
  const [stats, setStats] = useState<ProductReviewStats>({
    totalReviews: 0,
    averageRating: 0,
    distribution: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useRecoilState(cartState);
  const [activeTab, setActiveTab] = useState<"info" | "reviews">("info");

  const locationLoadable = useRecoilValueLoadable(locationState);
  const location = locationLoadable.state === "hasValue" ? locationLoadable.contents : null;
  const storesLoadable = useRecoilValueLoadable(remoteStoresState);
  const stores = storesLoadable.state === "hasValue" ? storesLoadable.contents : [];

  const cartQty = cart.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => {
    if (!productId) {
      setError("Thiếu thông tin sản phẩm");
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchProductDetail(productId)
      .then(({ product, reviews, reviewStats }) => {
        setProduct(product);
        setReviews(reviews);
        setStats(reviewStats);
        setLoading(false);
      })
      .catch(() => {
        setError("Không tải được thông tin sản phẩm");
        setLoading(false);
      });
  }, [productId]);

  const addToCart = useCallback(() => {
    if (!product) return;
    const session = localStorage.getItem("zaui_food_session");
    if (!session) {
      navigate("/login");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1, options: {} }];
    });
    snackbar.openSnackbar({
      type: "success",
      text: `Đã thêm ${product.name}`,
    });
  }, [product, setCart, snackbar, navigate]);

  if (loading) {
    return (
      <Box className="flex-1 flex items-center justify-center" style={{ background: "var(--tm-bg)", minHeight: "100vh" }}>
        <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
      </Box>
    );
  }

  if (error || !product) {
    return (
      <Box className="flex-1 flex items-center justify-center" style={{ background: "var(--tm-bg)", minHeight: "100vh", flexDirection: "column", gap: 12 }}>
        <Text style={{ color: "var(--tm-text-secondary)", fontSize: 14 }}>{error || "Không tìm thấy sản phẩm"}</Text>
        <button onClick={() => window.history.back()} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--tm-primary)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Quay lại</button>
      </Box>
    );
  }

  const finalPrice = calcFinalPrice(product, {});
  const hasSale = !!product.sale;

  return (
    <Box style={{ background: "var(--tm-bg)", minHeight: "100vh", paddingBottom: 72 }}>
      {/* Hero Image */}
      <div style={{ position: "relative" }}>
        {product.image ? (
          <img src={product.image} alt={product.name} style={{ width: "100%", height: 220, objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: 220, background: "linear-gradient(135deg, #f0fdf4, #ecfeff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56 }}>🍽️</div>
        )}
        <button className="tm-interactive tm-glass" onClick={() => window.history.back()} style={{
          position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 44px)", left: 12,
          border: "none", color: "var(--tm-text-primary)",
          borderRadius: "50%", width: 36, height: 36, fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100,
        }}>←</button>
        {hasSale && (
          <span style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>
            {product.sale!.type === "percent" ? `-${Math.round(product.sale!.percent * 100)}%` : `-${((product.sale as any).amount / 1000).toFixed(0)}K`}
          </span>
        )}
      </div>

      {/* Product Info Card */}
      <div style={{ background: "#fff", margin: "0", padding: "16px", borderBottom: "1px solid var(--tm-border)" }}>
        <Text style={{ fontSize: 20, fontWeight: 800, color: "var(--tm-text-primary)", lineHeight: 1.3, marginBottom: 6 }}>
          {product.name}
        </Text>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {hasSale ? (
            <>
              <Text style={{ fontSize: 20, fontWeight: 800, color: "var(--tm-primary)" }}><DisplayPrice>{finalPrice}</DisplayPrice></Text>
              <Text style={{ fontSize: 14, color: "var(--tm-text-muted)", textDecoration: "line-through" }}><DisplayPrice>{product.price}</DisplayPrice></Text>
            </>
          ) : (
            <Text style={{ fontSize: 20, fontWeight: 800, color: "var(--tm-primary)" }}><DisplayPrice>{product.price}</DisplayPrice></Text>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--tm-text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
            {stats.totalReviews > 0 ? (
              <><span style={{ color: "#ffb800" }}>★</span> {(product.rating ?? 0).toFixed(1)} ({stats.totalReviews} đánh giá)</>
            ) : (
              <span style={{ color: "var(--tm-primary)", fontWeight: 600 }}>🆕 Mới</span>
            )}
          </span>
          <span style={{ fontSize: 12, color: "var(--tm-text-secondary)" }}>🛒 Đã bán {product.sold ?? 0}</span>
          <span style={{ fontSize: 12, color: "var(--tm-text-secondary)" }}>🕐 {product.eta ?? "20-30 phút"}</span>
        </div>
        {/* Store link */}
        {product.storeId && (
          <div onClick={() => navigate(`/store?id=${product.storeId}`)} style={{
            marginTop: 10, padding: "8px 12px", background: "var(--tm-bg)", borderRadius: 8, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>🏪</span>
            <div>
              <Text style={{ fontSize: 13, fontWeight: 600, color: "var(--tm-primary)" }}>{product.storeName ?? "Quán đối tác"}</Text>
              <Text style={{ fontSize: 11, color: "var(--tm-text-secondary)" }}>Xem cửa hàng →</Text>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid var(--tm-border)" }}>
        {(["info", "reviews"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: "10px 0", border: "none", background: "none", cursor: "pointer",
            fontSize: 13, fontWeight: activeTab === tab ? 700 : 500,
            color: activeTab === tab ? "var(--tm-primary)" : "var(--tm-text-secondary)",
            borderBottom: activeTab === tab ? "2px solid var(--tm-primary)" : "2px solid transparent",
            transition: "all 0.2s",
          }}>
            {tab === "info" ? "Thông tin" : `Đánh giá (${stats.totalReviews})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "info" ? (
        <div style={{ padding: "16px", background: "#fff", margin: "8px 0" }}>
          <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--tm-text-primary)" }}>Mô tả</Text>
          <Text style={{ fontSize: 13, color: "var(--tm-text-secondary)", lineHeight: 1.6 }}>
            {product.description || "Chưa có mô tả cho sản phẩm này."}
          </Text>
          {(() => {
            let fee = product.deliveryFee ?? 15000;
            // Attempt to calculate dynamic fee if we can find the store
            const store = stores.find(s => String(s.id) === String(product.storeId));
            if (store && location) {
              const distanceKm = calculateDistance(
                Number(location.latitude), Number(location.longitude), store.lat, store.long
              );
              if (distanceKm > 3) {
                fee = 15000 + (Math.ceil(distanceKm - 3) * 5000);
              } else {
                fee = 15000;
              }
            }
            
            return (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>🚚</span>
                <Text style={{ fontSize: 13, color: "var(--tm-text-secondary)" }}>Phí giao: <Text style={{ fontWeight: 600, color: "var(--tm-primary)" }}>Từ <DisplayPrice>{fee}</DisplayPrice></Text></Text>
              </div>
            );
          })()}
        </div>
      ) : (
        <div style={{ padding: "0", margin: "8px 0" }}>
          {/* Review Stats Summary */}
          <div style={{ background: "#fff", padding: "16px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "center", minWidth: 70 }}>
                <Text style={{ fontSize: 36, fontWeight: 800, color: "var(--tm-primary)" }}>{stats.averageRating.toFixed(1)}</Text>
                <div style={{ color: "#ffb800", fontSize: 14, letterSpacing: 1 }}>{stars(Math.round(stats.averageRating))}</div>
                <Text style={{ fontSize: 11, color: "var(--tm-text-muted)", marginTop: 2 }}>{stats.totalReviews} đánh giá</Text>
              </div>
              <div style={{ flex: 1 }}>
                {stats.distribution.map((d) => (
                  <div key={d.star} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <Text style={{ fontSize: 11, color: "var(--tm-text-secondary)", minWidth: 14 }}>{d.star}★</Text>
                    <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        background: d.star >= 4 ? "#22c55e" : d.star >= 3 ? "#f59e0b" : "#ef4444",
                        width: stats.totalReviews > 0 ? `${(d.count / stats.totalReviews) * 100}%` : "0%",
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                    <Text style={{ fontSize: 11, color: "var(--tm-text-muted)", minWidth: 16, textAlign: "right" }}>{d.count}</Text>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", background: "#fff" }}>
              <span style={{ fontSize: 32 }}>📝</span>
              <Text style={{ fontSize: 14, color: "var(--tm-text-secondary)", marginTop: 8 }}>Chưa có đánh giá nào</Text>
              <Text style={{ fontSize: 12, color: "var(--tm-text-muted)" }}>Hãy là người đầu tiên đánh giá!</Text>
            </div>
          ) : (
            <div style={{ background: "#fff" }}>
              {reviews.map((review, idx) => (
                <div key={review.id} style={{
                  padding: "12px 16px",
                  borderBottom: idx < reviews.length - 1 ? "1px solid var(--tm-border)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--tm-primary), #00c97d)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 12, fontWeight: 700,
                      }}>{(review.userName || "K").charAt(0).toUpperCase()}</div>
                      <Text style={{ fontSize: 13, fontWeight: 600, color: "var(--tm-text-primary)" }}>{review.userName || "Khách hàng"}</Text>
                    </div>
                    <Text style={{ fontSize: 11, color: "var(--tm-text-muted)" }}>{fmtDate(review.createdAt)}</Text>
                  </div>
                  <div style={{ color: "#ffb800", fontSize: 12, letterSpacing: 1 }}>
                    {stars(review.rating)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fixed Bottom Add to Cart */}
      <div className="tm-glass tm-safe-bottom animate-slide-up" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 12,
        zIndex: 100, borderTopLeftRadius: 16, borderTopRightRadius: 16,
      }}>
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: "var(--tm-text-secondary)" }}>Tạm tính</Text>
          <Text style={{ fontSize: 18, fontWeight: 800, color: "var(--tm-primary)", lineHeight: 1 }}><DisplayPrice>{finalPrice}</DisplayPrice></Text>
        </div>
        <button className="tm-interactive" onClick={addToCart} style={{
          padding: "12px 24px", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))",
          color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
          boxShadow: "var(--tm-shadow-floating)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          + Thêm
        </button>
        {cartQty > 0 && (
          <button className="tm-interactive" onClick={() => navigate("/cart")} style={{
            padding: "12px 16px", borderRadius: 12, border: "none",
            background: "var(--tm-primary-light)", color: "var(--tm-primary)", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>
            Giỏ ({cartQty})
          </button>
        )}
      </div>
    </Box>
  );
};

export default ProductDetailPage;
