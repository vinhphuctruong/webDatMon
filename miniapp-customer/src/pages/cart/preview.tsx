import { DisplayPrice } from "components/display/price";
import React, { FC, useState } from "react";
import {
  useRecoilValue,
  useRecoilState,
  useResetRecoilState,
  useSetRecoilState,
  useRecoilValueLoadable,
} from "recoil";
import { createOrder } from "services/backend";
import { notifyNearestActiveDriver } from "services/dispatch";
import {
  cartState,
  customerAddressDisplayState,
  deliveryFeeState,
  effectiveCustomerPhoneState,
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
import { validateVoucherApi } from "services/api";
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
  const [submitting, setSubmitting] = useState(false);
  const [voucherInput, setVoucherInput] = useState("");
  const [showVoucher, setShowVoucher] = useState(false);

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
        text: `Áp dụng mã ${code} — Giảm ${(result.discount / 1000).toFixed(0)}K 🎉`,
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
    const session = localStorage.getItem("zaui_food_session");
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

      let orderId: string;
      try {
        const order = await createOrder({
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(appliedVoucherCode ? { voucherCode: appliedVoucherCode } : {}),
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
        });
        orderId = order.id.slice(0, 8);
      } catch (backendError) {
        // Backend unavailable — create local order
        console.warn("Backend unavailable, creating local order", backendError);
        orderId = "TM" + Math.random().toString(36).slice(2, 8).toUpperCase();
      }

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

      let dispatchInfo;
      try {
        dispatchInfo = await notifyNearestActiveDriver({
          order: {
            id: orderId,
            code: `#${orderId}`,
            total: payableTotal,
            itemCount: quantity,
            items: cart.map((item) => `${item.product.name} x${item.quantity}`),
            ...(note.trim() ? { note: note.trim() } : {}),
          },
          store: {
            name: trackingSnapshot.storeName,
            address:
              selectedStore.state === "hasValue" && selectedStore.contents
                ? selectedStore.contents.address
                : "Thủ Dầu Một, Bình Dương",
            phone:
              selectedStore.state === "hasValue" && selectedStore.contents?.phone
                ? selectedStore.contents.phone
                : "0274 3622 899",
            lat: trackingSnapshot.storeLat,
            lng: trackingSnapshot.storeLng,
          },
          customer: {
            name: customerName,
            address: customerAddress,
            phone: customerPhone,
            lat: trackingSnapshot.customerLat,
            lng: trackingSnapshot.customerLng,
          },
        });
      } catch (dispatchError) {
        console.warn("Notify nearest driver failed", dispatchError);
      }

      resetCart();
      setAppliedCode(null);
      navigate("/result", {
        replace: true,
        state: {
          localOrderStatus: "success",
          localOrderMessage: dispatchInfo
            ? `Đơn #${orderId} đã tạo thành công. ${dispatchInfo.customerNotice}`
            : `Đơn #${orderId} đã tạo thành công.`,
          localOrderId: orderId,
          trackingSnapshot,
          dispatchInfo,
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

      snackbar.openSnackbar({ type: "error", text: "Không thể tạo đơn. Vui lòng thử lại." });
      navigate("/result", {
        replace: true,
        state: {
          localOrderStatus: "failed",
          localOrderMessage: "Tạo đơn thất bại. Bạn có thể thử lại sau.",
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#fff',
      borderTop: '1px solid var(--tm-border)',
      padding: '12px 16px',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      zIndex: 100,
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
              <span style={{ fontSize: 12 }}>🎫</span>
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
                🎫 Nhập mã voucher giảm giá
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fee breakdown — compact */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text size="xxxSmall" style={{ color: 'var(--tm-text-secondary)' }}>Tạm tính ({quantity} món)</Text>
          <Text size="xxxSmall" style={{ color: 'var(--tm-text-primary)', fontWeight: 500 }}>
            <DisplayPrice>{itemsTotal}</DisplayPrice>
          </Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text size="xxxSmall" style={{ color: 'var(--tm-text-secondary)' }}>Phí giao hàng</Text>
          <Text size="xxxSmall" style={{ color: 'var(--tm-text-primary)', fontWeight: 500 }}>
            <DisplayPrice>{deliveryFee}</DisplayPrice>
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

      {/* CTA Button — always visible */}
      <button
        disabled={!quantity || submitting}
        onClick={placeOrder}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
          background: !quantity ? '#e5e7eb' : 'linear-gradient(135deg, var(--tm-primary) 0%, #00c97d 100%)',
          color: !quantity ? 'var(--tm-text-tertiary)' : '#fff',
          fontSize: 15, fontWeight: 700, cursor: quantity ? 'pointer' : 'not-allowed',
          fontFamily: 'Inter, sans-serif',
          boxShadow: quantity ? '0 4px 16px rgba(0, 169, 109, 0.3)' : 'none',
        }}
      >
        {submitting ? "Đang tạo đơn..." : "Đặt giao ngay"}
      </button>
    </div>
  );
};
