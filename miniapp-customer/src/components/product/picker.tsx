import { FinalPrice } from "components/display/final-price";
import { Sheet } from "components/fullscreen-sheet";
import React, { FC, ReactNode, startTransition, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSetRecoilState } from "recoil";
import { addItemToCart, removeCartItem, updateCartItem } from "services/backend";
import { cartState } from "state";
import { SelectedOptions } from "types/cart";
import { Product } from "types/product";
import { Box, Button, Text, useSnackbar } from "zmp-ui";
import { MultipleOptionPicker } from "./multiple-option-picker";
import { QuantityPicker } from "./quantity-picker";
import { SingleOptionPicker } from "./single-option-picker";
import { useNavigate } from "react-router";

export interface ProductPickerProps {
  product?: Product;
  selected?: {
    id?: string;
    options: SelectedOptions;
    quantity: number;
  };
  children: (methods: { open: () => void; close: () => void }) => ReactNode;
}

function getDefaultOptions(product?: Product) {
  if (product && product.variants) {
    return product.variants.reduce(
      (options, variant) =>
        Object.assign(options, {
          [variant.id]: variant.default,
        }),
      {},
    );
  }
  return {};
}

export const ProductPicker: FC<ProductPickerProps> = ({
  children,
  product,
  selected,
}) => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<SelectedOptions>(
    selected ? selected.options : getDefaultOptions(product),
  );
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const setCart = useSetRecoilState(cartState);
  const snackbar = useSnackbar();
  const navigate = useNavigate();

  useEffect(() => {
    if (selected) {
      setOptions(selected.options);
      setQuantity(selected.quantity);
    }
  }, [selected]);

  const addToCart = async () => {
    if (!product) {
      return;
    }

    const session = localStorage.getItem("zaui_food_session");
    if (!session) {
      setVisible(false);
      navigate("/login");
      return;
    }

    setSubmitting(true);
    try {
      const normalizedOptions = Object.entries(options).reduce(
        (acc, [key, value]) => {
          if (typeof value === "string") {
            acc[key] = value;
          } else if (Array.isArray(value)) {
            acc[key] = value;
          }
          return acc;
        },
        {} as SelectedOptions,
      );

      let nextCart;
      try {
        // Try backend first
        if (selected?.id) {
          if (quantity === 0) {
            nextCart = await removeCartItem(selected.id);
          } else {
            nextCart = await updateCartItem(selected.id, {
              quantity,
              selectedOptions: normalizedOptions,
            });
          }
        } else {
          nextCart = await addItemToCart({
            productBackendId: product.backendId,
            productExternalId:
              typeof product.id === "number" ? product.id : product.externalId,
            quantity,
            selectedOptions: normalizedOptions,
          });
        }
        startTransition(() => {
          setCart(nextCart);
        });
      } catch (backendError) {
        // Backend unavailable — manage cart locally
        console.warn("Backend unavailable, using local cart", backendError);
        startTransition(() => {
          setCart((prevCart) => {
            const existingIndex = prevCart.findIndex(
              (item) =>
                item.product.id === product.id &&
                JSON.stringify(item.options) === JSON.stringify(normalizedOptions),
            );

            if (selected) {
              // Editing existing item
              if (quantity === 0) {
                return prevCart.filter(
                  (item) => !(item.product.id === product.id && JSON.stringify(item.options) === JSON.stringify(selected.options))
                );
              }
              return prevCart.map((item, i) => {
                if (
                  item.product.id === product.id &&
                  JSON.stringify(item.options) === JSON.stringify(selected.options)
                ) {
                  return { ...item, quantity, options: normalizedOptions };
                }
                return item;
              });
            }

            if (existingIndex >= 0) {
              // Same product + same options → increase quantity
              return prevCart.map((item, i) =>
                i === existingIndex
                  ? { ...item, quantity: item.quantity + quantity }
                  : item,
              );
            }

            // New item
            return [
              ...prevCart,
              {
                product,
                options: normalizedOptions,
                quantity,
              },
            ];
          });
        });
      }

      setVisible(false);
      snackbar.openSnackbar({
        text: `Đã thêm ${product.name} vào giỏ hàng! 🛒`,
        type: "success",
      });
    } catch (error) {
      console.warn("Cart sync failed", error);
      snackbar.openSnackbar({
        text: "Không thể cập nhật giỏ hàng. Vui lòng thử lại.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {children({
        open: () => setVisible(true),
        close: () => setVisible(false),
      })}
      {createPortal(
        <Sheet visible={visible} onClose={() => setVisible(false)} autoHeight>
          {product && (
            <Box style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
              {/* Scrollable content */}
              <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {/* Product image header */}
                <div style={{ position: 'relative' }}>
                  <img
                    src={product.image}
                    style={{
                      width: '100%',
                      height: 160,
                      objectFit: 'cover',
                    }}
                  />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
                    padding: '24px 16px 10px',
                  }}>
                    <Text.Title style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
                      {product.name}
                    </Text.Title>
                  </div>
                  {product.sale && (
                    <span
                      className="tm-badge tm-badge-sale"
                      style={{ position: 'absolute', top: 10, left: 10 }}
                    >
                      {product.sale.type === "percent"
                        ? `Giảm ${product.sale.percent * 100}%`
                        : "Giảm giá"}
                    </span>
                  )}
                </div>

                {/* Product info */}
                <Box style={{ padding: '12px 16px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 18, fontWeight: 700, color: 'var(--tm-primary)' }}>
                      <FinalPrice options={options}>{product}</FinalPrice>
                    </Text>
                    <div className="tm-stats-row">
                      {product.rating ? (
                        <>
                          <span style={{ color: '#ffb800' }}>★</span>
                          <span style={{ fontWeight: 600 }}>{product.rating}</span>
                        </>
                      ) : (
                        <span style={{ fontWeight: 500, color: 'var(--tm-text-secondary)' }}>Chưa có đánh giá</span>
                      )}
                      <span className="tm-dot" />
                      <span>{product.sold ? `${product.sold} đã bán` : "Mới"}</span>
                    </div>
                  </div>
                  {product.description && (
                    <Text
                      size="xxSmall"
                      style={{
                        color: 'var(--tm-text-secondary)',
                        lineHeight: '18px',
                      }}
                    >
                      <div dangerouslySetInnerHTML={{ __html: product.description }} />
                    </Text>
                  )}
                </Box>

                {/* Variants */}
                <Box style={{ padding: '0 16px 12px' }} className="space-y-4">
                  {product.variants &&
                    product.variants.map((variant) =>
                      variant.type === "single" ? (
                        <SingleOptionPicker
                          key={variant.id}
                          variant={variant}
                          value={options[variant.id] as string}
                          onChange={(selectedOption) =>
                            setOptions((prevOptions) => ({
                              ...prevOptions,
                              [variant.id]: selectedOption,
                            }))
                          }
                        />
                      ) : (
                        <MultipleOptionPicker
                          key={variant.id}
                          product={product}
                          variant={variant}
                          value={options[variant.id] as string[]}
                          onChange={(selectedOption) =>
                            setOptions((prevOptions) => ({
                              ...prevOptions,
                              [variant.id]: selectedOption,
                            }))
                          }
                        />
                      ),
                    )}
                  <QuantityPicker value={quantity} onChange={setQuantity} />
                </Box>
              </div>

              {/* Sticky CTA button — always visible */}
              <div style={{
                padding: '12px 16px',
                paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
                borderTop: '1px solid var(--tm-border)',
                background: '#fff',
                flexShrink: 0,
              }}>
                <button
                  disabled={selected ? submitting : (!quantity || submitting)}
                  onClick={addToCart}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    borderRadius: 12,
                    border: selected && quantity === 0 ? '2px solid var(--tm-danger)' : 'none',
                    background: selected && quantity === 0
                      ? 'transparent'
                      : !quantity ? '#e5e7eb'
                      : 'linear-gradient(135deg, var(--tm-primary), #00c97d)',
                    color: selected && quantity === 0
                      ? 'var(--tm-danger)'
                      : !quantity ? 'var(--tm-text-tertiary)' : '#fff',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    boxShadow: quantity ? '0 4px 16px rgba(0,169,109,0.3)' : 'none',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Đang xử lý..." :
                    quantity > 0
                      ? selected ? "Cập nhật giỏ hàng" : "Thêm vào giỏ hàng"
                      : "Xoá khỏi giỏ"}
                </button>
              </div>
            </Box>
          )}
        </Sheet>,
        document.body,
      )}
    </>
  );
};
