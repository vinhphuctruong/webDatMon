import React, { FC, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Box, Modal, Text, useSnackbar } from "zmp-ui";
import { getLocation } from "zmp-sdk";
import { claimOrder, fetchAvailableOrders, syncDriverLocation, acceptDispatchOrder, rejectDispatchOrder } from "services/driver-api";
import { hasSession } from "services/api";
import { initSocket } from "services/socket";
import { DisplayPrice } from "./display/price";
import { requestNotificationPermission, showNativeNotification } from "utils/notification";

const POLL_INTERVAL_MS = 5000;
const LOCATION_TIMEOUT_MS = 4000;

const DISABLED_PATHS = new Set(["/available"]);

const parseLocation = (raw: unknown) => {
  const numeric = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

async function readDriverLocation() {
  try {
    const result = (await Promise.race([
      getLocation({}),
      new Promise((_, reject) => setTimeout(() => reject(new Error("GPS timeout")), LOCATION_TIMEOUT_MS)),
    ])) as { latitude?: number | string; longitude?: number | string };

    const latitude = parseLocation(result?.latitude);
    const longitude = parseLocation(result?.longitude);
    if (latitude == null || longitude == null) {
      return null;
    }

    return { latitude, longitude };
  } catch (_error) {
    return null;
  }
}

/* ── Countdown Timer Hook ─────────────────────────────── */

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(0);
      return;
    }

    const update = () => {
      const diff = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };

    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return secondsLeft;
}

/* ── Main Component ───────────────────────────────────── */

export const IncomingOrderAlert: FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const snackbar = useSnackbar();

  // Exclusive dispatch offer
  const [dispatchOffer, setDispatchOffer] = useState<any | null>(null);
  const [claiming, setClaiming] = useState(false);

  // Broadcast fallback (legacy)
  const [broadcastOrder, setBroadcastOrder] = useState<any | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  const secondsLeft = useCountdown(dispatchOffer?.expiresAt || null);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Auto-close dispatch offer when timer expires
  useEffect(() => {
    if (dispatchOffer && secondsLeft <= 0 && dispatchOffer.expiresAt) {
      // Timer expired, server will move to next driver
      setDispatchOffer(null);
    }
  }, [secondsLeft, dispatchOffer]);

  /* ── Broadcast polling (fallback orders) ─────────── */

  const loadBroadcastOrders = useCallback(async () => {
    if (!hasSession() || DISABLED_PATHS.has(pathname)) return;

    try {
      const liveLocation = await readDriverLocation();
      if (liveLocation) {
        try {
          await syncDriverLocation(liveLocation.latitude, liveLocation.longitude);
        } catch (_) {}
      }

      const response = await fetchAvailableOrders(liveLocation ?? undefined);
      const nextOrders = response.data || [];

      if (!broadcastOrder && nextOrders.length > 0) {
        const nearest = nextOrders
          .slice()
          .sort(
            (a: any, b: any) =>
              (a.distanceToStoreKm ?? Infinity) - (b.distanceToStoreKm ?? Infinity),
          )[0];
        setBroadcastOrder(nearest);
      }

      knownOrderIdsRef.current = new Set(nextOrders.map((o: any) => o.id));
    } catch (_) {}
  }, [broadcastOrder, pathname]);

  /* ── Socket listeners ────────────────────────────── */

  useEffect(() => {
    if (DISABLED_PATHS.has(pathname)) return;

    let isMounted = true;
    let syncLocationInterval: NodeJS.Timeout | undefined;
    let pollOrdersInterval: NodeJS.Timeout | undefined;
    let localSocket: any = null;

    const handlers: { event: string; fn: (...args: any[]) => void }[] = [];

    (async () => {
      const socket = await initSocket();
      if (!socket || !isMounted) return;

      localSocket = socket;

      // ── Exclusive Dispatch Offer ──
      const handleDispatchOffer = (offer: any) => {
        setDispatchOffer(offer);
        showNativeNotification("📦 Đơn mới dành riêng cho bạn!", {
          body: `${offer.store?.name || "Đơn hàng"}\nThu nhập: ${(offer.driverPayout || offer.deliveryFee || 0).toLocaleString("vi-VN")}đ`,
        });
      };
      socket.on("dispatch_offer", handleDispatchOffer);
      handlers.push({ event: "dispatch_offer", fn: handleDispatchOffer });

      // ── Offer expired (server moved to next driver) ──
      const handleOfferExpired = (data: { orderId: string }) => {
        setDispatchOffer((prev: any) => {
          if (prev?.orderId === data.orderId) return null;
          return prev;
        });
      };
      socket.on("dispatch_offer_expired", handleOfferExpired);
      handlers.push({ event: "dispatch_offer_expired", fn: handleOfferExpired });

      // ── Broadcast fallback (old flow for orphan orders) ──
      const handleBroadcast = (order: any) => {
        if (!knownOrderIdsRef.current.has(order.id)) {
          setBroadcastOrder(order);
          knownOrderIdsRef.current.add(order.id);
          showNativeNotification("Có đơn tự do gần bạn!", {
            body: `Thu nhập: ${(order.driverPayout || order.deliveryFee || 0).toLocaleString("vi-VN")}đ`,
          });
        }
      };
      socket.on("new_order_to_driver", handleBroadcast);
      handlers.push({ event: "new_order_to_driver", fn: handleBroadcast });

      // ── Dispatch error ──
      const handleDispatchError = (data: { orderId: string; message: string }) => {
        snackbar.openSnackbar({ type: "error", text: data.message || "Lỗi nhận đơn" });
        setDispatchOffer(null);
        setClaiming(false);
      };
      socket.on("dispatch_error", handleDispatchError);
      handlers.push({ event: "dispatch_error", fn: handleDispatchError });

      // Initial load
      loadBroadcastOrders();

      // Fallback polling every 20s
      pollOrdersInterval = setInterval(loadBroadcastOrders, 20000);

      // Sync location every 5s
      syncLocationInterval = setInterval(async () => {
        const loc = await readDriverLocation();
        if (loc) {
          socket.emit("driver_location_update", { latitude: loc.latitude, longitude: loc.longitude });
          try {
            await syncDriverLocation(loc.latitude, loc.longitude);
          } catch (_) {}
        }
      }, POLL_INTERVAL_MS);
    })();

    return () => {
      isMounted = false;
      if (syncLocationInterval) clearInterval(syncLocationInterval);
      if (pollOrdersInterval) clearInterval(pollOrdersInterval);
      if (localSocket) {
        for (const h of handlers) {
          localSocket.off(h.event, h.fn);
        }
      }
    };
  }, [loadBroadcastOrders, pathname]);

  /* ── Accept exclusive dispatch ───────────────────── */

  const handleAcceptDispatch = useCallback(async () => {
    if (!dispatchOffer?.orderId || claiming) return;

    setClaiming(true);
    try {
      await acceptDispatchOrder(dispatchOffer.orderId);
      snackbar.openSnackbar({ type: "success", text: "Nhận đơn thành công!" });
      setDispatchOffer(null);
      navigate("/delivering");
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error?.message || "Nhận đơn thất bại" });
    } finally {
      setClaiming(false);
    }
  }, [dispatchOffer, claiming, navigate, snackbar]);

  /* ── Reject exclusive dispatch ───────────────────── */

  const handleRejectDispatch = useCallback(() => {
    if (!dispatchOffer?.orderId) return;
    rejectDispatchOrder(dispatchOffer.orderId).catch(() => {});
    setDispatchOffer(null);
  }, [dispatchOffer]);

  /* ── Claim broadcast order (old flow) ────────────── */

  const handleClaimBroadcast = useCallback(async () => {
    if (!broadcastOrder?.id || claiming) return;

    setClaiming(true);
    try {
      await claimOrder(broadcastOrder.id);
      snackbar.openSnackbar({ type: "success", text: "Nhận đơn thành công!" });
      setBroadcastOrder(null);
      navigate("/delivering");
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error?.message || "Nhận đơn thất bại" });
    } finally {
      setClaiming(false);
    }
  }, [broadcastOrder, claiming, navigate, snackbar]);

  /* ── Render ──────────────────────────────────────── */

  // Priority: Exclusive dispatch > Broadcast
  const showDispatch = !!dispatchOffer;
  const showBroadcast = !showDispatch && !!broadcastOrder;

  return (
    <>
      {/* ── Exclusive Dispatch Offer Modal ── */}
      <Modal
        visible={showDispatch}
        title=""
        onClose={handleRejectDispatch}
      >
        <Box p={4}>
          {/* Countdown bar */}
          <div style={{
            height: 4,
            borderRadius: 2,
            background: "#eee",
            marginBottom: 16,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              borderRadius: 2,
              background: secondsLeft > 5 ? "var(--tm-primary)" : "#e53935",
              width: `${Math.min(100, (secondsLeft / (dispatchOffer?.timeoutSeconds || 15)) * 100)}%`,
              transition: "width 0.5s linear",
            }} />
          </div>

          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: "var(--tm-text-secondary)" }}>
              Đơn dành riêng cho bạn
            </Text>
            <Text style={{ fontSize: 28, fontWeight: 800, color: secondsLeft > 5 ? "var(--tm-primary)" : "#e53935" }}>
              {secondsLeft}s
            </Text>
          </div>

          <Text style={{ fontWeight: 700, marginBottom: 6, fontSize: 16 }}>
            {dispatchOffer?.store?.name || "Đơn giao hàng mới"}
          </Text>

          {dispatchOffer?.distanceKm != null && (
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
              📍 Quán cách bạn {dispatchOffer.distanceKm} km
              {dispatchOffer.timeMinutes ? ` · ~${Math.round(dispatchOffer.timeMinutes)} phút` : ""}
            </Text>
          )}

          <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
            🛒 {dispatchOffer?.itemCount || 0} món · {dispatchOffer?.paymentMethod === "COD" ? "COD" : "Đã TT online"}
          </Text>

          <Text style={{ color: "var(--tm-primary)", fontWeight: 700, marginBottom: 16, fontSize: 18 }}>
            💰 Thu nhập: <DisplayPrice>{dispatchOffer?.driverPayout || dispatchOffer?.deliveryFee || 0}</DisplayPrice>
          </Text>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleRejectDispatch}
              style={{
                flex: 1,
                border: "2px solid #fecdd3",
                borderRadius: 12,
                background: "#fff1f2",
                color: "#e53935",
                padding: "12px",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              Từ chối
            </button>
            <button
              onClick={handleAcceptDispatch}
              disabled={claiming}
              style={{
                flex: 2,
                border: "none",
                borderRadius: 12,
                background: "var(--tm-primary)",
                color: "#fff",
                padding: "12px",
                fontWeight: 700,
                fontSize: 15,
                opacity: claiming ? 0.7 : 1,
              }}
            >
              {claiming ? "Đang nhận..." : "Nhận đơn"}
            </button>
          </div>
        </Box>
      </Modal>

      {/* ── Broadcast Fallback Modal (old flow) ── */}
      <Modal
        visible={showBroadcast}
        title="Đơn tự do gần bạn"
        onClose={() => setBroadcastOrder(null)}
      >
        <Box p={4}>
          <Text style={{ fontWeight: 700, marginBottom: 6 }}>
            {broadcastOrder?.store?.name || "Đơn giao hàng mới"}
          </Text>
          <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 6 }}>
            #{broadcastOrder?.id?.slice(0, 8)} · {broadcastOrder?.paymentMethod === "COD" ? "COD" : "Online"}
          </Text>
          {broadcastOrder?.distanceToStoreKm != null && (
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 6 }}>
              Quán cách bạn khoảng {broadcastOrder.distanceToStoreKm} km
            </Text>
          )}
          <Text size="xSmall" style={{ color: "var(--tm-primary)", fontWeight: 700, marginBottom: 12 }}>
            Thu nhập: <DisplayPrice>{broadcastOrder?.driverPayout || broadcastOrder?.deliveryFee || 0}</DisplayPrice>
          </Text>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setBroadcastOrder(null)}
              style={{
                flex: 1,
                border: "2px solid #fecdd3",
                borderRadius: 10,
                background: "#fff1f2",
                color: "#e53935",
                padding: "10px 12px",
                fontWeight: 700,
              }}
            >
              Từ chối
            </button>
            <button
              onClick={handleClaimBroadcast}
              disabled={claiming}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 10,
                background: "var(--tm-primary)",
                color: "#fff",
                padding: "10px 12px",
                fontWeight: 700,
              }}
            >
              {claiming ? "Đang nhận..." : "Nhận đơn"}
            </button>
          </div>
        </Box>
      </Modal>
    </>
  );
};
