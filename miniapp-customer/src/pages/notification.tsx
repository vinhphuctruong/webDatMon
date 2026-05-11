import React, { FC, useEffect, useMemo, useState } from "react";
import { useRecoilValue } from "recoil";
import { notificationsState } from "state";
import { Box, Button, Header, Page, Text, useNavigate, useSnackbar } from "zmp-ui";
import { claimVoucherApi, fetchMyVouchers, fetchVoucherMarket, readSession, type MyVoucherItem, type VoucherMarketItem } from "services/api";

const promoGradients = [
  "tm-promo-gradient-1",
  "tm-promo-gradient-2",
  "tm-promo-gradient-3",
];

const NotificationPage: FC = () => {
  const notifications = useRecoilValue(notificationsState);
  const navigate = useNavigate();
  const snackbar = useSnackbar();

  const [loading, setLoading] = useState(false);
  const [market, setMarket] = useState<VoucherMarketItem[]>([]);
  const [mine, setMine] = useState<MyVoucherItem[]>([]);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);
  const [claimingCode, setClaimingCode] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const session = await readSession();
      if (!session) {
        setSessionReady(false);
        setMarket([]);
        setMine([]);
        return;
      }
      setSessionReady(true);
      const [mkt, my] = await Promise.all([fetchVoucherMarket(), fetchMyVouchers()]);
      setMarket(mkt);
      setMine(my);
    } catch (err: any) {
      snackbar.openSnackbar({ type: "error", text: err?.message || "Không tải được voucher" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myCodeSet = useMemo(() => new Set(mine.map((v) => v.code)), [mine]);

  const handleClaim = async (code: string) => {
    setClaimingCode(code);
    try {
      await claimVoucherApi(code);
      snackbar.openSnackbar({ type: "success", text: `Đã lưu voucher ${code}` });
      await loadAll();
    } catch (err: any) {
      snackbar.openSnackbar({ type: "error", text: err?.message || "Không lưu được voucher" });
    } finally {
      setClaimingCode(null);
    }
  };

  const handleUseHint = (code: string) => {
    snackbar.openSnackbar({
      type: "success",
      text: `Đã lưu ${code}. Vào giỏ hàng → bấm “Chọn voucher” để sử dụng.`,
    });
    navigate("/cart");
  };

  return (
    <Page style={{ background: "var(--tm-bg)" }}>
      <Header title="Ưu đãi & Voucher" showBackIcon={false} />

      {/* Promo banner cards */}
      <Box style={{ padding: 16 }} className="space-y-3">
        {notifications.map((item, i) => (
          <div
            key={item.id}
            className={`tm-promo-card ${promoGradients[i % promoGradients.length]} animate-slide-up`}
            style={{ animationDelay: `${i * 0.1}s`, cursor: "pointer" }}
          >
            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "rgba(255,255,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <img
                    src={item.image}
                    style={{ width: 22, height: 22, borderRadius: 6 }}
                  />
                </div>
                <Text.Title
                  size="small"
                  style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}
                >
                  {item.title}
                </Text.Title>
              </div>
              <Text
                size="xSmall"
                style={{
                  color: "rgba(255,255,255,0.9)",
                  lineHeight: "18px",
                  fontSize: 13,
                }}
              >
                {item.content}
              </Text>
              <div style={{ marginTop: 12 }}>
                <span
                  onClick={() => navigate("/")}
                  style={{
                    background: "rgba(255,255,255,0.25)",
                    borderRadius: 20,
                    padding: "6px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#fff",
                    backdropFilter: "blur(4px)",
                    cursor: "pointer",
                  }}
                >
                  Đặt ngay →
                </span>
              </div>
            </div>
          </div>
        ))}
      </Box>

      {/* Voucher section */}
      <Box style={{ padding: "0 16px 16px" }}>
        {sessionReady === false ? (
          <div className="tm-card" style={{ padding: 14 }}>
            <Text style={{ fontWeight: 700, marginBottom: 6 }}>Đăng nhập để săn voucher</Text>
            <Text size="small" style={{ color: "var(--tm-text-secondary)", marginBottom: 12 }}>
              Bạn cần đăng nhập để lưu voucher và sử dụng khi đặt hàng.
            </Text>
            <Button onClick={() => navigate("/login?required=1")} style={{ width: "100%", background: "var(--tm-primary)" }}>
              Đăng nhập
            </Button>
          </div>
        ) : (
          <>
            {/* Market */}
            <div className="tm-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <span className="tm-section-title"> Săn voucher</span>
              <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                {loading ? "Đang tải..." : `${market.length} mã`}
              </Text>
            </div>

            {market.length === 0 && !loading ? (
              <Text size="small" style={{ color: "var(--tm-text-secondary)" }}>
                Hiện chưa có voucher để săn.
              </Text>
            ) : (
              <div className="space-y-3">
                {market.map((v) => {
                  const expiresFormatted = new Date(v.expiresAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
                  const minK = (v.minOrderValue / 1000).toFixed(0);
                  const already = v.hasClaimed || myCodeSet.has(v.code);
                  const soldOut = Boolean(v.isSoldOut);
                  const disabled = already || soldOut || claimingCode === v.code;
                  const btnText = soldOut ? "Hết lượt" : already ? "Đã lưu" : claimingCode === v.code ? "..." : "Lưu";
                  const remainingText = v.maxClaimTotal != null ? ` · Còn ${v.remainingClaims ?? 0}` : " · Vô hạn";

                  return (
                    <div key={v.code} className="tm-voucher animate-slide-up" style={{ opacity: soldOut ? 0.5 : 1 }}>
                      <div className="tm-voucher-left">
                        <div style={{ textAlign: "center" }}>
                          <Text style={{ fontSize: 20 }}></Text>
                          <Text size="xxxSmall" style={{ color: "var(--tm-primary)", fontWeight: 700, marginTop: 2, fontSize: 9 }}>
                            {v.code}
                          </Text>
                        </div>
                      </div>
                      <div className="tm-voucher-right">
                        <Text size="small" style={{ fontWeight: 600, color: "var(--tm-text-primary)", marginBottom: 2 }}>
                          {v.description}
                        </Text>
                        <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>
                          HSD: {expiresFormatted} · Đơn tối thiểu {minK}K{remainingText}
                        </Text>
                        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                          <button
                            onClick={() => (already ? handleUseHint(v.code) : handleClaim(v.code))}
                            disabled={disabled}
                            style={{
                              background: disabled ? "#d1d5db" : "var(--tm-primary)",
                              color: "#fff",
                              borderRadius: 16,
                              padding: "5px 14px",
                              fontSize: 11,
                              fontWeight: 600,
                              border: "none",
                              cursor: disabled ? "not-allowed" : "pointer",
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            {btnText}
                          </button>
                          {already && (
                            <button
                              onClick={() => handleUseHint(v.code)}
                              style={{
                                background: "var(--tm-primary-light)",
                                color: "var(--tm-primary)",
                                borderRadius: 16,
                                padding: "5px 14px",
                                fontSize: 11,
                                fontWeight: 700,
                                border: "none",
                                cursor: "pointer",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              Dùng
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* My vouchers */}
            <div className="tm-section-header" style={{ paddingLeft: 0, paddingRight: 0, marginTop: 14 }}>
              <span className="tm-section-title"> Voucher của bạn</span>
              <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                {mine.filter((v) => !v.used && !v.isExpired && !v.notStarted).length} mã khả dụng
              </Text>
            </div>

            {mine.length === 0 && !loading ? (
              <Text size="small" style={{ color: "var(--tm-text-secondary)" }}>
                Bạn chưa lưu voucher nào. Hãy săn voucher ở phía trên.
              </Text>
            ) : (
              <div className="space-y-3">
                {mine.map((v) => {
                  const expiresFormatted = new Date(v.expiresAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
                  const minK = (v.minOrderValue / 1000).toFixed(0);
                  const statusText = v.used ? "Đã sử dụng" : v.isExpired ? "Đã hết hạn" : v.notStarted ? "Chưa bắt đầu" : `HSD: ${expiresFormatted} · Đơn tối thiểu ${minK}K`;
                  const faded = v.used || v.isExpired || v.notStarted;
                  return (
                    <div key={v.code} className="tm-voucher animate-slide-up" style={{ opacity: faded ? 0.5 : 1 }}>
                      <div className="tm-voucher-left">
                        <div style={{ textAlign: "center" }}>
                          <Text style={{ fontSize: 20 }}></Text>
                          <Text size="xxxSmall" style={{ color: "var(--tm-primary)", fontWeight: 700, marginTop: 2, fontSize: 9 }}>
                            {v.code}
                          </Text>
                        </div>
                      </div>
                      <div className="tm-voucher-right">
                        <Text size="small" style={{ fontWeight: 600, color: "var(--tm-text-primary)", marginBottom: 2 }}>
                          {v.description}
                        </Text>
                        <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>{statusText}</Text>
                        {!faded && (
                          <div style={{ marginTop: 8 }}>
                            <button
                              onClick={() => handleUseHint(v.code)}
                              style={{
                                background: "var(--tm-primary)",
                                color: "#fff",
                                borderRadius: 16,
                                padding: "5px 14px",
                                fontSize: 11,
                                fontWeight: 600,
                                border: "none",
                                cursor: "pointer",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              Sử dụng
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Box>
    </Page>
  );
};

export default NotificationPage;
