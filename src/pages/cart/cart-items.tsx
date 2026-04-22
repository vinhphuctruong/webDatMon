import { FinalPrice } from "components/display/final-price";
import { DisplaySelectedOptions } from "components/display/selected-options";
import { ProductPicker } from "components/product/picker";
import React, { FC, useState } from "react";
import { useRecoilValue } from "recoil";
import { cartState } from "state";
import { CartItem } from "types/cart";
import { Box, Text } from "zmp-ui";

export const CartItems: FC = () => {
  const cart = useRecoilValue(cartState);
  const [editingItem, setEditingItem] = useState<CartItem | undefined>();

  return (
    <Box style={{ padding: 16 }}>
      {cart.length > 0 ? (
        <ProductPicker product={editingItem?.product} selected={editingItem}>
          {({ open }) => (
            <div className="tm-card" style={{ padding: 0 }}>
              {cart.map((item, i) => (
                <div
                  key={JSON.stringify({ product: item.product.id, options: item.options, quantity: item.quantity })}
                  onClick={() => {
                    setEditingItem(item);
                    open();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderBottom: i < cart.length - 1 ? '1px solid var(--tm-border)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {/* Product image */}
                  <img
                    src={item.product.image}
                    style={{
                      width: 56, height: 56,
                      borderRadius: 12,
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      size="small"
                      style={{
                        fontWeight: 600,
                        color: 'var(--tm-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.product.name}
                    </Text>
                    <Text size="xxxSmall" style={{ color: 'var(--tm-text-secondary)', marginTop: 2 }}>
                      <DisplaySelectedOptions options={item.options}>
                        {item.product}
                      </DisplaySelectedOptions>
                    </Text>
                    <Text size="xSmall" style={{ color: 'var(--tm-primary)', fontWeight: 600, marginTop: 4 }}>
                      <FinalPrice options={item.options}>
                        {item.product}
                      </FinalPrice>
                    </Text>
                  </div>
                  {/* Quantity badge */}
                  <div style={{
                    background: 'var(--tm-primary-light)',
                    color: 'var(--tm-primary)',
                    borderRadius: 8,
                    padding: '4px 12px',
                    fontWeight: 700,
                    fontSize: 14,
                    flexShrink: 0,
                  }}>
                    x{item.quantity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ProductPicker>
      ) : (
        <div className="tm-empty-state" style={{ background: '#fff', borderRadius: 16 }}>
          <span className="tm-empty-icon">🛒</span>
          <Text style={{ fontWeight: 600, color: 'var(--tm-text-primary)', marginBottom: 4 }}>
            Giỏ hàng trống
          </Text>
          <Text size="xSmall" style={{ color: 'var(--tm-text-secondary)' }}>
            Thêm món ngon để đặt giao nhé!
          </Text>
        </div>
      )}
    </Box>
  );
};
