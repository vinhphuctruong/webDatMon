import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Text, useSnackbar } from "zmp-ui";
import { getLocation } from "zmp-sdk";
import { syncDriverLocation, acceptDispatchOrder } from "services/driver-api";
import { initSocket } from "services/socket";
import { DisplayPrice } from "./display/price";
import { requestNotificationPermission, showNativeNotification } from "utils/notification";

const POLL_INTERVAL_MS = 5000;
const LOCATION_TIMEOUT_MS = 4000;
const SLIDE_ACCEPT_THRESHOLD = 0.86;
const SLIDE_KNOB_SIZE = 42;
const SLIDE_TRACK_PADDING = 4;
const BRAND_GREEN = "#16a34a";
const BRAND_GREEN_DARK = "#15803d";
const BRAND_GREEN_SOFT = "#eaf8ef";
const BRAND_GREEN_BORDER = "#bfe8cc";
type DispatchOffer = Record<string, any>;
const HIGH_VALUE_THRESHOLD = 150_000;

function sameOffer(a: DispatchOffer, b: DispatchOffer) {
  const dispatchIdA = a?.dispatchId;
  const dispatchIdB = b?.dispatchId;
  if (dispatchIdA && dispatchIdB) {
    return dispatchIdA === dispatchIdB;
  }
  return a?.orderId === b?.orderId;
}

function toNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function formatShortAddress(input?: string) {
  if (!input) return "";
  const compact = input.replace(/\s+/g, " ").trim();
  if (compact.length <= 54) return compact;
  return `${compact.slice(0, 54)}...`;
}

function extractAreaName(address: any) {
  const district = String(address?.district || "").trim();
  const ward = String(address?.ward || "").trim();
  const city = String(address?.city || "").trim();

  if (district) return district;
  if (ward) return ward;
  if (city) return city;
  return "Khu vực giao hàng";
}

const parseLocation = (raw: unknown) => {
  const numeric = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

function readHtml5Location() {
  return new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: LOCATION_TIMEOUT_MS,
        maximumAge: 0,
      },
    );
  });
}

async function readDriverLocation() {
  try {
    const result = (await Promise.race([
      getLocation({}),
      new Promise((_, reject) => setTimeout(() => reject(new Error("GPS timeout")), LOCATION_TIMEOUT_MS)),
    ])) as { latitude?: number | string; longitude?: number | string };

    const latitude = parseLocation(result?.latitude);
    const longitude = parseLocation(result?.longitude);
    if (latitude == null || longitude == null) {
      return await readHtml5Location();
    }

    return { latitude, longitude };
  } catch (_error) {
    return await readHtml5Location();
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
  const navigate = useNavigate();
  const snackbar = useSnackbar();

  const [offerState, setOfferState] = useState<{ active: DispatchOffer | null; queue: DispatchOffer[] }>({
    active: null,
    queue: [],
  });
  const [claiming, setClaiming] = useState(false);
  const [slideOffset, setSlideOffset] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const pointerStateRef = useRef<{ pointerId: number | null; startX: number; startOffset: number }>({
    pointerId: null,
    startX: 0,
    startOffset: 0,
  });
  const dispatchOffer = offerState.active;

  const shiftNextOffer = useCallback(() => {
    setOfferState((prev) => {
      if (prev.queue.length === 0) {
        return { active: null, queue: [] };
      }
      const [next, ...rest] = prev.queue;
      return { active: next, queue: rest };
    });
  }, []);

  const enqueueOffer = useCallback((offer: DispatchOffer) => {
    setOfferState((prev) => {
      if (!prev.active) {
        return { active: offer, queue: prev.queue };
      }

      if (sameOffer(prev.active, offer)) {
        return { active: offer, queue: prev.queue };
      }

      const queuedIndex = prev.queue.findIndex((item) => sameOffer(item, offer));
      if (queuedIndex >= 0) {
        const nextQueue = [...prev.queue];
        nextQueue[queuedIndex] = offer;
        return { active: prev.active, queue: nextQueue };
      }

      return { active: prev.active, queue: [...prev.queue, offer] };
    });
  }, []);

  const removeOfferByOrderId = useCallback((orderId?: string) => {
    if (!orderId) return;

    setOfferState((prev) => {
      const filteredQueue = prev.queue.filter((item) => item?.orderId !== orderId);
      if (prev.active?.orderId !== orderId) {
        return { active: prev.active, queue: filteredQueue };
      }

      if (filteredQueue.length === 0) {
        return { active: null, queue: [] };
      }

      const [next, ...rest] = filteredQueue;
      return { active: next, queue: rest };
    });
  }, []);

  const secondsLeft = useCountdown(dispatchOffer?.expiresAt || null);

  const routeInfo = useMemo(() => {
    const toStoreKm = toNumber(dispatchOffer?.distanceKm);
    const storeLat = toNumber(dispatchOffer?.store?.latitude);
    const storeLng = toNumber(dispatchOffer?.store?.longitude);
    const customerLat = toNumber(dispatchOffer?.deliveryAddress?.latitude);
    const customerLng = toNumber(dispatchOffer?.deliveryAddress?.longitude);

    let storeToCustomerKm = toNumber(dispatchOffer?.storeToCustomerKm);
    if (
      storeToCustomerKm == null &&
      storeLat != null &&
      storeLng != null &&
      customerLat != null &&
      customerLng != null
    ) {
      storeToCustomerKm = haversineKm(storeLat, storeLng, customerLat, customerLng);
    }

    const totalKm =
      (toStoreKm ?? 0) + (storeToCustomerKm ?? 0) > 0
        ? (toStoreKm ?? 0) + (storeToCustomerKm ?? 0)
        : null;

    return {
      toStoreKm,
      storeToCustomerKm,
      totalKm,
    };
  }, [dispatchOffer]);

  const tagFlags = useMemo(() => {
    const isStacked =
      Boolean(dispatchOffer?.isStacked)
      || (toNumber(dispatchOffer?.bundleCount) ?? 1) > 1;
    const isHighValue = (toNumber(dispatchOffer?.total) ?? 0) >= HIGH_VALUE_THRESHOLD;
    return { isStacked, isHighValue };
  }, [dispatchOffer]);

  const offerKind = String(dispatchOffer?.offerKind || "");
  const offerTitle = useMemo(() => {
    if (offerKind === "AUTO") return "Đơn tự động";
    if (offerKind === "STACKED_PRIORITY") return "Đơn ghép ưu tiên";
    return "Đơn ưu tiên";
  }, [offerKind]);
  const expiryPenaltyLabel = offerKind === "AUTO" ? "Từ chối" : "Bỏ qua";

  const slideMax = useMemo(
    () => Math.max(0, trackWidth - SLIDE_KNOB_SIZE - SLIDE_TRACK_PADDING * 2),
    [trackWidth],
  );

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    setSlideOffset(0);
    setIsSliding(false);
    pointerStateRef.current = { pointerId: null, startX: 0, startOffset: 0 };
  }, [dispatchOffer?.dispatchId, dispatchOffer?.orderId]);

  useEffect(() => {
    const updateTrackWidth = () => {
      if (!sliderTrackRef.current) return;
      setTrackWidth(sliderTrackRef.current.getBoundingClientRect().width);
    };

    updateTrackWidth();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateTrackWidth);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateTrackWidth);
      }
    };
  }, [dispatchOffer?.dispatchId, dispatchOffer?.orderId]);

  useEffect(() => {
    setSlideOffset((prev) => clamp(prev, 0, slideMax));
  }, [slideMax]);

  // Auto-close dispatch offer exactly at expiresAt.
  // Avoid closing immediately on first render when secondsLeft is still 0.
  useEffect(() => {
    if (!dispatchOffer?.expiresAt) return;

    const expiresAtMs = new Date(dispatchOffer.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs)) return;

    const msLeft = expiresAtMs - Date.now();
    if (msLeft <= 0) {
      shiftNextOffer();
      return;
    }

    const timeout = setTimeout(() => {
      setOfferState((prev) => {
        if (!prev.active) return prev;
        if (!sameOffer(prev.active, dispatchOffer)) return prev;

        if (prev.queue.length === 0) {
          return { active: null, queue: [] };
        }

        const [next, ...rest] = prev.queue;
        return { active: next, queue: rest };
      });
    }, msLeft + 50);

    return () => clearTimeout(timeout);
  }, [dispatchOffer, shiftNextOffer]);

  useEffect(() => {
    let isMounted = true;
    let syncLocationInterval: NodeJS.Timeout | undefined;
    let localSocket: any = null;

    const handlers: { event: string; fn: (...args: any[]) => void }[] = [];

    (async () => {
      const socket = await initSocket();
      if (!socket || !isMounted) return;

      localSocket = socket;

      // Push one immediate location update after socket connected
      // so dispatcher can consider this driver quickly.
      const firstLocation = await readDriverLocation();
      if (firstLocation) {
        socket.emit("driver_location_update", {
          latitude: firstLocation.latitude,
          longitude: firstLocation.longitude,
        });
        try {
          await syncDriverLocation(firstLocation.latitude, firstLocation.longitude);
        } catch (_) {}
      }

      // ── Exclusive Dispatch Offer ──
      const handleDispatchOffer = (offer: any) => {
        enqueueOffer(offer);
        showNativeNotification(" Đơn mới dành riêng cho bạn!", {
          body: `${offer.store?.name || "Đơn hàng"}\nThu nhập: ${(offer.driverPayout || offer.deliveryFee || 0).toLocaleString("vi-VN")}đ`,
        });
      };
      socket.on("dispatch_offer", handleDispatchOffer);
      handlers.push({ event: "dispatch_offer", fn: handleDispatchOffer });

      // ── Offer expired (server moved to next driver) ──
      const handleOfferExpired = (data: { orderId: string; penaltyType?: "SKIP" | "REJECT" }) => {
        const penaltyLabel = data?.penaltyType === "REJECT" ? "Từ chối" : "Bỏ qua";
        snackbar.openSnackbar({
          type: "warning",
          text: `Hết thời gian thao tác. Đơn đã thu hồi và tính ${penaltyLabel}.`,
        });
        removeOfferByOrderId(data?.orderId);
      };
      socket.on("dispatch_offer_expired", handleOfferExpired);
      handlers.push({ event: "dispatch_offer_expired", fn: handleOfferExpired });

      // ── Offer revoked because order was cancelled ──
      const handleOfferCancelled = (data: { orderId: string; reason?: string }) => {
        removeOfferByOrderId(data?.orderId);
        snackbar.openSnackbar({
          type: "info",
          text: `Đơn đã thu hồi: ${data?.reason || "Đơn đã bị huỷ"}`,
        });
      };
      socket.on("dispatch_offer_cancelled", handleOfferCancelled);
      handlers.push({ event: "dispatch_offer_cancelled", fn: handleOfferCancelled });

      // Fallback: cancellation notice from generic order channel.
      const handleCancellationNotice = (data: { orderId?: string; cancelReason?: string }) => {
        if (!data?.orderId) return;
        removeOfferByOrderId(data.orderId);
      };
      socket.on("order_cancellation_notice", handleCancellationNotice);
      handlers.push({ event: "order_cancellation_notice", fn: handleCancellationNotice });

      // ── Dispatch error ──
      const handleDispatchError = (data: { orderId: string; message: string }) => {
        snackbar.openSnackbar({ type: "error", text: data.message || "Lỗi nhận đơn" });
        removeOfferByOrderId(data?.orderId);
        setClaiming(false);
      };
      socket.on("dispatch_error", handleDispatchError);
      handlers.push({ event: "dispatch_error", fn: handleDispatchError });

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
      if (localSocket) {
        for (const h of handlers) {
          localSocket.off(h.event, h.fn);
        }
      }
    };
  }, [enqueueOffer, removeOfferByOrderId, snackbar]);

  /* ── Accept exclusive dispatch ───────────────────── */

  const handleAcceptDispatch = useCallback(async () => {
    if (!dispatchOffer?.orderId || claiming) return;

    setClaiming(true);
    try {
      await acceptDispatchOrder(dispatchOffer.orderId);
      snackbar.openSnackbar({ type: "success", text: "Nhận đơn thành công!" });
      shiftNextOffer();
      navigate("/delivering");
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error?.message || "Nhận đơn thất bại" });
      setSlideOffset(0);
    } finally {
      setClaiming(false);
    }
  }, [dispatchOffer, claiming, navigate, shiftNextOffer, snackbar]);

  const completeSlide = useCallback(() => {
    const shouldAccept = slideMax > 0 && slideOffset >= slideMax * SLIDE_ACCEPT_THRESHOLD;
    if (shouldAccept && !claiming) {
      setSlideOffset(slideMax);
      handleAcceptDispatch();
      return;
    }
    setSlideOffset(0);
  }, [claiming, handleAcceptDispatch, slideMax, slideOffset]);

  const handleSliderPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (claiming) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startOffset: slideOffset,
      };
      setIsSliding(true);
    },
    [claiming, slideOffset],
  );

  const handleSliderPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isSliding) return;
      if (pointerStateRef.current.pointerId !== event.pointerId) return;
      const delta = event.clientX - pointerStateRef.current.startX;
      const next = clamp(pointerStateRef.current.startOffset + delta, 0, slideMax);
      setSlideOffset(next);
    },
    [isSliding, slideMax],
  );

  const handleSliderPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (pointerStateRef.current.pointerId === event.pointerId) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch (_) {}
      }
      pointerStateRef.current = { pointerId: null, startX: 0, startOffset: 0 };
      setIsSliding(false);
      completeSlide();
    },
    [completeSlide],
  );

  /* ── Render ──────────────────────────────────────── */
  const showDispatch = !!dispatchOffer;

  return (
    <>
      {showDispatch && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            padding: "0 8px calc(env(safe-area-inset-bottom, 0px) + 8px)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "min(96vw, 390px)",
              maxHeight: "52vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
              boxShadow: "0 12px 30px rgba(8, 15, 30, 0.2)",
              pointerEvents: "auto",
            }}
          >
            <div style={{ padding: 8, borderBottom: "1px solid #eef0f2", background: "#f8fafc" }}>
              <div style={{
                height: 5,
                borderRadius: 4,
                background: "#eef0f2",
                overflow: "hidden",
                marginBottom: 10,
              }}>
                <div style={{
                  height: "100%",
                  borderRadius: 4,
                  background: secondsLeft > 5 ? BRAND_GREEN : "#e53935",
                  width: `${Math.min(100, (secondsLeft / (dispatchOffer?.timeoutSeconds || 15)) * 100)}%`,
                  transition: "width 0.5s linear",
                }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <Text style={{ fontSize: 15, color: "#20242a", fontWeight: 800 }}>{offerTitle}</Text>
                  {offerState.queue.length > 0 && (
                    <Text style={{ fontSize: 11, color: "#7a7f87", marginTop: 2 }}>
                      +{offerState.queue.length} đơn đang chờ
                    </Text>
                  )}
                </div>
                <div style={{
                  borderRadius: 8,
                  padding: "6px 8px",
                  background: secondsLeft > 5 ? BRAND_GREEN_SOFT : "#fee2e2",
                }}>
                  <Text style={{ fontSize: 12, fontWeight: 800, color: secondsLeft > 5 ? BRAND_GREEN_DARK : "#b91c1c" }}>
                    Giao: {secondsLeft}s
                  </Text>
                </div>
              </div>
              <Text style={{ fontSize: 11, color: "#7a7f87", marginTop: 6 }}>
                Hết thời gian thao tác: tính {expiryPenaltyLabel}
              </Text>
            </div>

            <div style={{ padding: 8, display: "grid", gap: 6, overflowY: "auto" }}>
              {(tagFlags.isStacked || tagFlags.isHighValue) && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {tagFlags.isStacked && (
                    <span style={{
                      background: BRAND_GREEN_SOFT,
                      color: BRAND_GREEN_DARK,
                      border: `1px solid ${BRAND_GREEN_BORDER}`,
                      borderRadius: 999,
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      Đơn ghép
                    </span>
                  )}
                  {tagFlags.isHighValue && (
                    <span style={{
                      background: "#fff1f2",
                      color: "#e53935",
                      border: "1px solid #fecdd3",
                      borderRadius: 999,
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      Đơn giá trị cao
                    </span>
                  )}
                </div>
              )}

              <div style={{
                border: "1px solid #eef0f2",
                borderRadius: 10,
                padding: 10,
                display: "grid",
                gap: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <Text style={{ fontSize: 11, color: "#7a7f87", fontWeight: 600 }}>Khoảng cách tới quán</Text>
                    <Text style={{ fontSize: 17, fontWeight: 800, color: "#20242a" }}>
                      {routeInfo.toStoreKm != null ? `${routeInfo.toStoreKm.toFixed(1)} km` : "--"}
                    </Text>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Text style={{ fontSize: 11, color: "#7a7f87", fontWeight: 600 }}>Thu nhập</Text>
                    <Text style={{ color: "#ef4444", fontWeight: 900, fontSize: 24, lineHeight: 1.1 }}>
                      <DisplayPrice>{dispatchOffer?.driverPayout || dispatchOffer?.deliveryFee || 0}</DisplayPrice>
                    </Text>
                  </div>
                </div>
              </div>

              <div style={{
                border: "1px solid #eef0f2",
                borderRadius: 10,
                padding: 10,
                display: "grid",
                gap: 8,
              }}>
                <div style={{ borderLeft: `3px solid ${BRAND_GREEN}`, paddingLeft: 8 }}>
                  <Text style={{ fontSize: 11, color: "#7a7f87", fontWeight: 600 }}>Điểm lấy hàng</Text>
                  <Text style={{ fontSize: 14, fontWeight: 700, color: "#20242a" }}>
                    {dispatchOffer?.store?.name || "Cửa hàng"}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#555b63" }}>
                    {formatShortAddress(dispatchOffer?.store?.address || "")}
                  </Text>
                  <Text style={{ fontSize: 12, color: BRAND_GREEN, fontWeight: 700 }}>
                    Cách bạn: {routeInfo.toStoreKm != null ? `${routeInfo.toStoreKm.toFixed(1)} km` : "--"}
                  </Text>
                </div>

                <div style={{ borderLeft: `3px solid ${BRAND_GREEN}`, paddingLeft: 8 }}>
                  <Text style={{ fontSize: 11, color: "#7a7f87", fontWeight: 600 }}>Điểm giao hàng</Text>
                  <Text style={{ fontSize: 14, fontWeight: 700, color: "#20242a" }}>
                    {extractAreaName(dispatchOffer?.deliveryAddress)}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#555b63" }}>
                    {formatShortAddress(dispatchOffer?.deliveryAddress?.street || "")}
                  </Text>
                  <Text style={{ fontSize: 12, color: BRAND_GREEN, fontWeight: 700 }}>
                    Từ quán tới khách: {routeInfo.storeToCustomerKm != null ? `${routeInfo.storeToCustomerKm.toFixed(1)} km` : "--"}
                  </Text>
                </div>

                <div style={{ borderTop: "1px dashed #e2e5e9", paddingTop: 8 }}>
                  <Text style={{ fontSize: 12, color: "#555b63", fontWeight: 700 }}>
                    Tổng quãng đường: {routeInfo.totalKm != null ? `${routeInfo.totalKm.toFixed(1)} km` : "--"}
                  </Text>
                </div>
              </div>

              <div style={{ border: "1px solid #eef0f2", borderRadius: 10, padding: 10, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 12, color: "#7a7f87", fontWeight: 600 }}>Thanh toán</Text>
                  <Text style={{ fontSize: 12, fontWeight: 700, color: "#20242a" }}>
                    {dispatchOffer?.paymentMethod === "COD" ? "Tiền mặt (COD)" : "Ví/Thẻ (Đã TT online)"}
                  </Text>
                </div>
                <Text style={{ fontSize: 12, color: "#555b63" }}>
                  {dispatchOffer?.itemCount || 0} món
                  {dispatchOffer?.timeMinutes ? ` · ~${Math.round(dispatchOffer.timeMinutes)} phút tới quán` : ""}
                </Text>
              </div>
            </div>

            <div style={{
              position: "sticky",
              bottom: 0,
              borderTop: `1px solid ${BRAND_GREEN}`,
              background: BRAND_GREEN,
              padding: 8,
            }}>
              <div
                ref={sliderTrackRef}
                style={{
                  position: "relative",
                  height: 50,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.2)",
                  border: "1px solid rgba(255,255,255,0.45)",
                  overflow: "hidden",
                  touchAction: "none",
                  userSelect: "none",
                }}
              >
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingLeft: 32,
                  paddingRight: 12,
                }}>
                  <Text style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
                    {claiming ? "Đang nhận đơn..." : "Trượt sang phải để nhận đơn"}
                  </Text>
                </div>

                <div
                  role="button"
                  onPointerDown={handleSliderPointerDown}
                  onPointerMove={handleSliderPointerMove}
                  onPointerUp={handleSliderPointerUp}
                  onPointerCancel={handleSliderPointerUp}
                  style={{
                    position: "absolute",
                    top: SLIDE_TRACK_PADDING,
                    left: SLIDE_TRACK_PADDING + slideOffset,
                    width: SLIDE_KNOB_SIZE,
                    height: SLIDE_KNOB_SIZE,
                    borderRadius: 10,
                    background: "#fff",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: claiming ? "not-allowed" : isSliding ? "grabbing" : "grab",
                    transition: isSliding ? "none" : "left 0.2s ease",
                    opacity: claiming ? 0.8 : 1,
                  }}
                >
                  <Text style={{ color: BRAND_GREEN, fontSize: 18, fontWeight: 900 }}>{">>"}</Text>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
