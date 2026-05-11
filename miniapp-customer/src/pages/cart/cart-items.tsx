import { FinalPrice } from "components/display/final-price";
import { DisplaySelectedOptions } from "components/display/selected-options";
import { ProductPicker } from "components/product/picker";
import React, { FC, useState } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { cartState } from "state";
import { CartItem } from "types/cart";
import { Box, Text } from "zmp-ui";
import { removeCartItem } from "services/backend";

export const CartItems: FC = () => {
  const cart = useRecoilValue(cartState);
  const setCart = useSetRecoilState(cartState);
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{
                      background: 'var(--tm-primary-light)',
                      color: 'var(--tm-primary)',
                      borderRadius: 8,
                      padding: '4px 12px',
                      fontWeight: 700,
                      fontSize: 14,
                    }}>
                      x{item.quantity}
                    </div>
                    <div
                      onClick={async (e) => {
                        e.stopPropagation(); // prevent opening the editor
                        
                        // Optimistic update locally
                        setCart((prev) => prev.filter((_, index) => index !== i));
                        
                        // Sync with backend if the item has an ID
                        if (item.id) {
                          try {
                            const updatedCart = await removeCartItem(item.id);
                            setCart(updatedCart);
                          } catch (error) {
                            console.warn("Failed to delete cart item on backend", error);
                          }
                        }
                      }}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "#fff1f1",
                        color: "var(--tm-danger)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ProductPicker>
      ) : (
        <div className="tm-empty-state" style={{ background: '#fff', borderRadius: 16 }}>
          <span className="tm-empty-icon"></span>
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
