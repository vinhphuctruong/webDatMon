import { FinalPrice } from "components/display/final-price";
import { DisplayPrice } from "components/display/price";
import React, { FC } from "react";
import { Product } from "types/product";
import { Box, Text } from "zmp-ui";
import { ProductPicker } from "./picker";

export const ProductItem: FC<{ product: Product }> = ({ product }) => {
  return (
    <ProductPicker product={product}>
      {({ open }) => (
        <div className="tm-card animate-fade-in" onClick={open} style={{ cursor: 'pointer' }}>
          {/* Image */}
          <div style={{ position: 'relative' }}>
            <img
              loading="lazy"
              src={product.image}
              style={{
                width: '100%',
                aspectRatio: '1',
                objectFit: 'cover',
                display: 'block',
                borderRadius: '16px 16px 0 0',
              }}
              className="bg-skeleton"
            />
            {/* Sale badge */}
            {product.sale && (
              <span
                className="tm-badge tm-badge-sale"
                style={{ position: 'absolute', top: 6, left: 6 }}
              >
                Sale
              </span>
            )}
            {/* Rating */}
            <div style={{
              position: 'absolute', bottom: 6, left: 6,
              background: 'rgba(0,0,0,0.55)',
              borderRadius: 12, padding: '2px 6px',
              display: 'flex', alignItems: 'center', gap: 2,
              backdropFilter: 'blur(4px)',
            }}>
              <span style={{ color: '#ffb800', fontSize: 10 }}>★</span>
              <span style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>
                {product.rating ?? 4.7}
              </span>
            </div>
            {/* Quick add button */}
            <button
              className="tm-add-btn"
              style={{
                position: 'absolute', bottom: 6, right: 6,
                width: 26, height: 26, fontSize: 16,
              }}
              onClick={(e) => { e.stopPropagation(); open(); }}
            >
              +
            </button>
          </div>
          {/* Info */}
          <Box style={{ padding: '8px 10px 10px' }}>
            <Text
              style={{
                fontWeight: 600,
                color: 'var(--tm-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: 2,
                fontSize: 13,
              }}
            >
              {product.name}
            </Text>
            <Text size="xxxSmall" style={{ color: 'var(--tm-text-secondary)', fontSize: 11, marginBottom: 4 }}>
              {product.storeName ?? "Quán đối tác"}
            </Text>
            <Text style={{ color: 'var(--tm-primary)', fontWeight: 700, fontSize: 14 }}>
              <FinalPrice>{product}</FinalPrice>
            </Text>
            <div className="tm-stats-row" style={{ marginTop: 4 }}>
              <span style={{ fontSize: 10 }}>
                <DisplayPrice>{product.deliveryFee ?? 15000}</DisplayPrice>
              </span>
              <span className="tm-dot" />
              <span style={{ fontSize: 10 }}>{product.eta ?? "20-30'"}</span>
            </div>
          </Box>
        </div>
      )}
    </ProductPicker>
  );
};
