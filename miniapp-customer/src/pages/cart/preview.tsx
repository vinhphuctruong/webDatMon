import { DisplayPrice } from "components/display/price";
import React, { FC, useState } from "react";
import {
  useRecoilValue,
  useRecoilState,
  useResetRecoilState,
  useSetRecoilState,
  useRecoilValueLoadable,
} from "recoil";
import { addItemToCart, createOrder } from "services/backend";
import {
  cartState,
  customerAddressDisplayState,
  deliveryFeeState,
  effectiveCustomerPhoneState,
  hasConfirmedLocationState,
  locationState,
  manualCustomerContactState,
  orderNoteState,
  selectedStoreState,
  totalPriceState,
  totalQuantityState,
  userState,
  refreshActiveOrdersAtom,
} from "state";
import { Text, useNavigate, useSnackbar } from "zmp-ui";
import {
  addOrderToHistory,
  orderHistoryState,
} from "services/features";
import { readSession, validateVoucherApi } from "services/api";
import { THU_DAU_MOT_CENTER } from "utils/location";

export const CartPreview: FC = () => {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const quantity = useRecoilValue(totalQuantityState);
  const itemsTotal = useRecoilValue(totalPriceState);
  const deliveryFeeLoadable = useRecoilValueLoadable(deliveryFeeState);
  const deliveryFee =
    deliveryFeeLoadable.state === "hasValue" ? deliveryFeeLoadable.contents : 18000;

  // Voucher state — backend validated
  const [appliedVoucherCode, setAppliedVoucherCode] = useState<string | null>(null);
  const [appliedVoucherDesc, setAppliedVoucherDesc] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [validatingVoucher, setValidatingVoucher] = useState(false);

  const payableTotal = Math.max(0, itemsTotal + deliveryFee - voucherDiscount);
  const note = useRecoilValue(orderNoteState);
  const user = useRecoilValueLoadable(userState);
  const manualCustomerContactLoadable = useRecoilValueLoadable(manualCustomerContactState);
  const manualCustomerContact =
    manualCustomerContactLoadable.state === "hasValue"
      ? manualCustomerContactLoadable.contents
      : { name: "", phone: "" };
  const customerName =
    user.state === "hasValue" && user.contents?.name
      ? String(user.contents.name)
      : manualCustomerContact.name;
  const customerPhoneLoadable = useRecoilValueLoadable(effectiveCustomerPhoneState);
  const customerPhone =
    customerPhoneLoadable.state === "hasValue" && customerPhoneLoadable.contents
      ? customerPhoneLoadable.contents
      : manualCustomerContact.phone;
  const customerAddressLoadable = useRecoilValueLoadable(customerAddressDisplayState);
  const customerAddress =
    customerAddressLoadable.state === "hasValue" && customerAddressLoadable.contents
      ? customerAddressLoadable.contents
      : "Vị trí GPS, Bình Dương";
  const cart = useRecoilValue(cartState);
  const resetCart = useResetRecoilState(cartState);
  const setOrders = useSetRecoilState(orderHistoryState);
  const setRefreshActiveOrders = useSetRecoilState(refreshActiveOrdersAtom);
  const selectedStore = useRecoilValueLoadable(selectedStoreState);
  const userLocation = useRecoilValueLoadable(locationState);
  const hasLocationLoadable = useRecoilValueLoadable(hasConfirmedLocationState);
  const hasLocation = hasLocationLoadable.state === "hasValue" ? hasLocationLoadable.contents : false;
  const [submitting, setSubmitting] = useState(false);
  const [voucherInput, setVoucherInput] = useState("");
  const [showVoucher, setShowVoucher] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "SEPAY_QR">("COD");

  const applyVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;

    setValidatingVoucher(true);
    try {
      const result = await validateVoucherApi(code, itemsTotal);
      setAppliedVoucherCode(code);
      setAppliedVoucherDesc(result.description);
      setVoucherDiscount(result.discount);
      setShowVoucher(false);
      snackbar.openSnackbar({
        type: "success",
        text: `Áp dụng mã ${code} — Giảm ${(result.discount / 1000).toFixed(0)}K `,
      });
    } catch (err: any) {
      const msg = err?.message || "Mã voucher không hợp lệ";
      snackbar.openSnackbar({ type: "error", text: msg });
    } finally {
      setValidatingVoucher(false);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucherCode(null);
    setAppliedVoucherDesc("");
    setVoucherDiscount(0);
  };

  const placeOrder = async () => {
    if (!hasLocation) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng chọn địa chỉ giao hàng trước khi đặt đơn" });
      navigate("/addresses");
      return;
    }

    const session = await readSession();
    if (!session) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng đăng nhập để đặt hàng" });
      navigate("/login?required=1");
      return;
    }

    setSubmitting(true);
    try {
      const trackingSnapshot = {
        customerLat:
          userLocation.state === "hasValue" && userLocation.contents
            ? parseFloat(String(userLocation.contents.latitude))
            : THU_DAU_MOT_CENTER.lat,
        customerLng:
          userLocation.state === "hasValue" && userLocation.contents
            ? parseFloat(String(userLocation.contents.longitude))
            : THU_DAU_MOT_CENTER.lng,
        storeLat:
          selectedStore.state === "hasValue" && selectedStore.contents
            ? selectedStore.contents.lat
            : THU_DAU_MOT_CENTER.lat,
        storeLng:
          selectedStore.state === "hasValue" && selectedStore.contents
            ? selectedStore.contents.long
            : THU_DAU_MOT_CENTER.lng,
        storeName:
          selectedStore.state === "hasValue" && selectedStore.contents
            ? selectedStore.contents.name
            : "TM Food - Thủ Dầu Một",
      };

      const orderPayload = {
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(appliedVoucherCode ? { voucherCode: appliedVoucherCode } : {}),
        paymentMethod,
        autoConfirmPayment: paymentMethod === "SEPAY_QR",
        deliveryAddress: {
          receiverName: customerName,
          phone: customerPhone,
          street: customerAddress,
          ward: "Phường mặc định",
          district: "Thủ Dầu Một",
          city: "Bình Dương",
          latitude: trackingSnapshot.customerLat,
          longitude: trackingSnapshot.customerLng,
        },
      };

      const createOrderWithCartRecovery = async () => {
        try {
          return await createOrder(orderPayload);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          const canRecover =
            message.includes("Giỏ hàng đang trống") && cart.length > 0;

          if (!canRecover) {
            throw error;
          }

          for (const item of cart) {
            const normalizedOptions = Object.entries(item.options ?? {}).reduce(
              (acc, [key, value]) => {
                if (typeof value === "string" || Array.isArray(value)) {
                  acc[key] = value;
                }
                return acc;
              },
              {} as Record<string, string | string[]>,
            );

            await addItemToCart({
              productBackendId: item.product.backendId,
              productExternalId:
                typeof item.product.id === "number"
                  ? item.product.id
                  : item.product.externalId,
              quantity: item.quantity,
              selectedOptions: normalizedOptions,
            });
          }

          return createOrder(orderPayload);
        }
      };

      const order = await createOrderWithCartRecovery();

      const orderBackendId = order.id;
      const orderId = order.id.slice(0, 8);

      // Save to order history
      addOrderToHistory(setOrders, {
        id: orderId,
        date: new Date().toISOString(),
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
        })),
        total: payableTotal,
        status: "success",
        storeName: cart[0]?.product.storeName ?? "Quán đối tác",
      });

      // Trigger a refresh of the active orders banner
      setRefreshActiveOrders((v) => v + 1);

      resetCart();
      setAppliedVoucherCode(null);
      navigate("/result", {
        replace: true,
        state: {
          localOrderStatus: "success",
          localOrderMessage: `Đơn #${orderId} đã tạo thành công. Hệ thống đang tìm tài xế gần nhất cho bạn.`,
          localOrderId: orderId,
          localOrderBackendId: orderBackendId,
          trackingSnapshot,
        },
      });
    } catch (error) {
      console.warn("Create order failed", error);

      // Save failed order too
      addOrderToHistory(setOrders, {
        id: Math.random().toString(36).slice(2, 10),
        date: new Date().toISOString(),
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
        })),
        total: payableTotal,
        status: "failed",
        storeName: cart[0]?.product.storeName ?? "Quán đối tác",
      });

      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Không thể tạo đơn.";

      snackbar.openSnackbar({
        type: "error",
        text: `${errorMessage} Đơn chưa được gửi tới quán.`,
      });
      navigate("/result", {
        replace: true,
        state: {
          localOrderStatus: "failed",
          localOrderMessage: `${errorMessage} Đơn chưa được gửi tới quán.`,
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tm-glass tm-safe-bottom animate-slide-up" style={{
      position: 'sticky',
      bottom: 0, left: 0, right: 0,
      padding: '16px', zIndex: 100, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      flexShrink: 0,
    }}>
      {/* Voucher section — backend validated */}
      <div style={{ marginBottom: 8 }}>
        {appliedVoucherCode ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px', borderRadius: 8,
            background: 'var(--tm-primary-light)',
            border: '1px dashed var(--tm-primary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12 }}></span>
              <Text size="xxxSmall" style={{ color: 'var(--tm-primary)', fontWeight: 600 }}>
                {appliedVoucherCode} · Giảm <DisplayPrice>{voucherDiscount}</DisplayPrice>
              </Text>
            </div>
            <button
              onClick={removeVoucher}
              style={{
                background: 'none', border: 'none', color: 'var(--tm-danger)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '2px 4px',
              }}
            >
              Bỏ
            </button>
          </div>
        ) : (
          <div>
            {showVoucher ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  placeholder="Nhập mã voucher..."
                  disabled={validatingVoucher}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 8,
                    border: '1px solid var(--tm-border)', fontSize: 12,
                    fontFamily: 'Inter, sans-serif', outline: 'none',
                  }}
                  onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
                />
                <button
                  onClick={applyVoucher}
                  disabled={validatingVoucher}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none',
                    background: validatingVoucher ? '#ccc' : 'var(--tm-primary)', color: '#fff',
                    fontSize: 12, fontWeight: 600, cursor: validatingVoucher ? 'wait' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {validatingVoucher ? "..." : "Áp dụng"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowVoucher(true)}
                style={{
                  width: '100%', padding: '7px', borderRadius: 8,
                  border: '1px dashed var(--tm-border)', background: 'transparent',
                  color: 'var(--tm-primary)', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                 Nhập mã voucher giảm giá
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fee breakdown — compact */}
      <div style={{ marginBottom: 10 }}>
        <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 6 }}>
          Phương thức thanh toán
        </Text>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            onClick={() => setPaymentMethod("COD")}
            style={{
              padding: "9px 10px",
              borderRadius: 10,
              border: paymentMethod === "COD" ? "1.5px solid var(--tm-primary)" : "1px solid var(--tm-border)",
              background: paymentMethod === "COD" ? "var(--tm-primary-light)" : "#fff",
              color: "var(--tm-text-primary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
             COD
          </button>
          <button
            onClick={() => setPaymentMethod("SEPAY_QR")}
            style={{
              padding: "9px 10px",
              borderRadius: 10,
              border:
                paymentMethod === "SEPAY_QR"
                  ? "1.5px solid var(--tm-primary)"
                  : "1px solid var(--tm-border)",
              background: paymentMethod === "SEPAY_QR" ? "var(--tm-primary-light)" : "#fff",
              color: "var(--tm-text-primary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
             Thanh toán online
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text size="xxxSmall" style={{ color: 'var(--tm-text-secondary)' }}>Tạm tính ({quantity} món)</Text>
          <Text size="xxxSmall" style={{ color: 'var(--tm-text-primary)', fontWeight: 500 }}>
            <DisplayPrice>{itemsTotal}</DisplayPrice>
          </Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text size="xxxSmall" style={{ color: 'var(--tm-text-secondary)' }}>Phí giao hàng</Text>
          <Text size="xxxSmall" style={{ color: deliveryFee === 0 && !hasLocation ? '#f59e0b' : 'var(--tm-text-primary)', fontWeight: 500 }}>
            {deliveryFee === 0 && !hasLocation ? 'Chưa xác định' : <DisplayPrice>{deliveryFee}</DisplayPrice>}
          </Text>
        </div>
        {voucherDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text size="xxxSmall" style={{ color: 'var(--tm-primary)', fontWeight: 600 }}>Voucher giảm</Text>
            <Text size="xxxSmall" style={{ color: 'var(--tm-primary)', fontWeight: 600 }}>
              -<DisplayPrice>{voucherDiscount}</DisplayPrice>
            </Text>
          </div>
        )}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          paddingTop: 6, borderTop: '1px dashed var(--tm-border)',
        }}>
          <Text style={{ fontWeight: 700, color: 'var(--tm-text-primary)', fontSize: 15 }}>Tổng cộng</Text>
          <Text style={{ fontWeight: 700, color: 'var(--tm-primary)', fontSize: 16 }}>
            <DisplayPrice>{payableTotal}</DisplayPrice>
          </Text>
        </div>
      </div>

      {/* Location warning */}
      {!hasLocation && quantity > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', marginBottom: 8, borderRadius: 10,
          background: '#fff7ed', border: '1px solid #fed7aa',
        }}>
          <span style={{ fontSize: 16 }}></span>
          <Text size="xxxSmall" style={{ color: '#92400e', flex: 1, lineHeight: 1.3 }}>
            Vui lòng chọn địa chỉ giao hàng để tính phí ship chính xác
          </Text>
          <button
            onClick={() => navigate('/addresses')}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none',
              background: '#f59e0b', color: '#fff', fontSize: 11,
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'Inter, sans-serif',
            }}
          >Chọn</button>
        </div>
      )}

      {/* CTA Button — always visible */}
      <button
        className="tm-interactive"
        disabled={!quantity || submitting || !hasLocation}
        onClick={hasLocation ? placeOrder : () => navigate('/addresses')}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
          background: (!quantity || !hasLocation) ? '#e5e7eb' : 'linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)',
          color: (!quantity || !hasLocation) ? 'var(--tm-text-tertiary)' : '#fff',
          fontSize: 16, fontWeight: 700,
          cursor: (quantity && hasLocation) ? 'pointer' : 'not-allowed',
          fontFamily: 'Inter, sans-serif',
          boxShadow: (quantity && hasLocation) ? 'var(--tm-shadow-floating)' : 'none',
        }}
      >
        {submitting ? "Đang tạo đơn..." : !hasLocation ? " Chọn địa chỉ giao hàng" : "Đặt giao ngay"}
      </button>
    </div>
  );
};
