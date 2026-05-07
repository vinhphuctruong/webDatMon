import React, { FC, Suspense } from "react";
import { useRecoilValue } from "recoil";
import { productsState } from "state";
import { Box, Text, useNavigate } from "zmp-ui";
import { ProductSlideSkeleton } from "components/skeletons";
import { ProductPicker } from "components/product/picker";
import { FinalPrice } from "components/display/final-price";
import { DisplayPrice } from "components/display/price";
import { activeFilterState, FilterType } from "./inquiry";
import { Product } from "types/product";
import { useSetRecoilState } from "recoil";
import { favoriteIdsState, toggleFavorite } from "services/features";

function filterProducts(products: Product[], filter: FilterType): Product[] {
  if (!filter) return products;

  switch (filter) {
    case "sale":
      return products.filter((p) => p.sale);
    case "freeship":
      return products.filter((p) => (p.deliveryFee ?? 15000) <= 12000);
    case "best":
      return [...products].sort((a, b) => {
        const soldA = parseInt(String(a.sold ?? "0").replace(/[^\d]/g, "")) || 0;
        const soldB = parseInt(String(b.sold ?? "0").replace(/[^\d]/g, "")) || 0;
        return soldB - soldA;
      });
    case "new":
      return products.filter((p) => !p.sold || p.sold === "Mới");
    case "near":
      return [...products].sort((a, b) => {
        const distA = parseFloat(String(a.distance ?? "99").replace(/[^\d.]/g, ""));
        const distB = parseFloat(String(b.distance ?? "99").replace(/[^\d.]/g, ""));
        return distA - distB;
      });
    default:
      return products;
  }
}

const FavoriteButton: FC<{ productId: number }> = ({ productId }) => {
  const favorites = useRecoilValue(favoriteIdsState);
  const setFavorites = useSetRecoilState(favoriteIdsState);
  const isFav = favorites.includes(productId);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(setFavorites, productId);
      }}
      style={{
        position: 'absolute', top: 6, right: 6,
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(255,255,255,0.85)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14,
        backdropFilter: 'blur(4px)',
        transition: 'transform 0.2s',
      }}
    >
      {isFav ? "❤️" : "🤍"}
    </button>
  );
};

export const ProductListContent: FC = () => {
  const products = useRecoilValue(productsState);
  const activeFilter = useRecoilValue(activeFilterState);
  const navigate = useNavigate();
  const filtered = filterProducts(products, activeFilter);

  const filterLabel = activeFilter
    ? { near: "Gần bạn", freeship: "Freeship", sale: "Giảm giá", new: "Mới", best: "Bán chạy" }[activeFilter]
    : null;

  return (
    <Box className="bg-white" style={{ padding: '16px 0' }}>
      <div className="tm-section-header" style={{ paddingTop: 0, paddingBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>🏪</span>
          <span className="tm-section-title">
            {filterLabel ? `Quán ${filterLabel.toLowerCase()}` : "Quán gần bạn"}
          </span>
        </div>
        <span className="tm-section-link" style={{ fontSize: 12, color: 'var(--tm-text-secondary)' }}>
          {filtered.length} quán
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        padding: '8px 16px 16px',
      }}>
        {filtered.map((product) => (
          <ProductPicker key={product.id} product={product}>
            {({ open }) => (
              <div className="tm-card tm-interactive animate-slide-up" onClick={open} style={{ cursor: 'pointer', borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ position: 'relative' }}>
                  <img
                    loading="lazy"
                    src={product.image}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                    className="bg-skeleton"
                  />
                  {product.sale && (
                    <span className="tm-badge tm-badge-sale tm-glass" style={{ position: 'absolute', top: 6, left: 6, border: 'none', color: '#ff4757', fontWeight: 700 }}>
                      Giảm {product.sale.type === "percent" ? `${product.sale.percent * 100}%` : `${(product.sale.amount / 1000).toFixed(0)}K`}
                    </span>
                  )}
                  {(product.rating ?? 0) > 0 ? (
                    <div className="tm-glass" style={{
                      position: 'absolute', bottom: 6, left: 6,
                      borderRadius: 12, padding: '2px 6px',
                      display: 'flex', alignItems: 'center', gap: 2,
                    }}>
                      <span style={{ color: '#ffb800', fontSize: 10 }}>★</span>
                      <span style={{ color: 'var(--tm-text-primary)', fontSize: 10, fontWeight: 700 }}>
                        {product.rating}
                      </span>
                    </div>
                  ) : (
                    <div className="tm-glass" style={{
                      position: 'absolute', bottom: 6, left: 6,
                      borderRadius: 12, padding: '2px 8px',
                      display: 'flex', alignItems: 'center', gap: 2,
                    }}>
                      <span style={{ color: 'var(--tm-primary)', fontSize: 10, fontWeight: 700 }}>Mới</span>
                    </div>
                  )}
                  <FavoriteButton productId={typeof product.id === "number" ? product.id : 0} />
                  <button
                    className="tm-add-btn tm-interactive"
                    style={{ position: 'absolute', bottom: 6, right: 6, width: 28, height: 28, fontSize: 18, background: 'var(--tm-primary)', color: 'white', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--tm-shadow-floating)' }}
                    onClick={(e) => { e.stopPropagation(); open(); }}
                  >+</button>
                </div>
                <Box style={{ padding: '10px 12px 12px' }}>
                  <Text
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/product?id=${product.backendId || product.id}`); }}
                    style={{
                      fontWeight: 600, color: 'var(--tm-text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: 2, fontSize: 13, cursor: 'pointer',
                    }}>
                    {product.name}
                  </Text>
                  <div
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (product.storeId) navigate(`/store?id=${product.storeId}`); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, cursor: product.storeId ? 'pointer' : 'default' }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--tm-primary), #00c97d)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 9, fontWeight: 700,
                    }}>
                      {(product.storeName ?? 'Q').charAt(0).toUpperCase()}
                    </div>
                    <Text
                      size="xxxSmall"
                      style={{ color: 'var(--tm-primary)', fontSize: 11, textDecoration: product.storeId ? 'underline' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {product.storeName ?? "Quán đối tác"}
                    </Text>
                  </div>
                  <Text style={{ color: 'var(--tm-primary)', fontWeight: 700, fontSize: 14 }}>
                    <FinalPrice>{product}</FinalPrice>
                  </Text>
                  <div className="tm-stats-row" style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 10 }}>{product.eta ?? "20-30'"}</span>
                    <span className="tm-dot" />
                    <span style={{ fontSize: 10 }}>
                      {product.sold ? `${product.sold} đã bán` : "Mới"}
                    </span>
                  </div>
                </Box>
              </div>
            )}
          </ProductPicker>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="tm-empty-state">
          <span className="tm-empty-icon">🔍</span>
          <Text style={{ fontWeight: 600, marginBottom: 4 }}>Không có quán phù hợp</Text>
          <Text size="xSmall" style={{ color: 'var(--tm-text-secondary)' }}>Thử bộ lọc khác nhé!</Text>
        </div>
      )}
    </Box>
  );
};

export const ProductListFallback: FC = () => (
  <Box className="bg-white" style={{ padding: '16px' }}>
    <div className="tm-section-header" style={{ paddingTop: 0 }}>
      <span className="tm-section-title">🏪 Quán gần bạn</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {[...new Array(4)].map((_, i) => (<ProductSlideSkeleton key={i} />))}
    </div>
  </Box>
);

export const ProductList: FC = () => (
  <Suspense fallback={<ProductListFallback />}>
    <ProductListContent />
  </Suspense>
);
