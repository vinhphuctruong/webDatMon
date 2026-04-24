import React, { FC } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { notificationsState } from "state";
import { Box, Header, Page, Text, useNavigate, useSnackbar } from "zmp-ui";
import {
  vouchersState,
  appliedVoucherCodeState,
  Voucher,
} from "services/features";

const promoGradients = [
  "tm-promo-gradient-1",
  "tm-promo-gradient-2",
  "tm-promo-gradient-3",
];

const VoucherCard: FC<{ voucher: Voucher; onApply: (code: string) => void }> = ({
  voucher,
  onApply,
}) => {
  const isExpired = new Date(voucher.expiresAt) < new Date();
  const expiresFormatted = new Date(voucher.expiresAt).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <div
      className="tm-voucher animate-slide-up"
      style={{ opacity: voucher.used || isExpired ? 0.5 : 1 }}
    >
      <div className="tm-voucher-left">
        <div style={{ textAlign: "center" }}>
          <Text style={{ fontSize: 20 }}>🎫</Text>
          <Text
            size="xxxSmall"
            style={{ color: "var(--tm-primary)", fontWeight: 700, marginTop: 2, fontSize: 9 }}
          >
            {voucher.code}
          </Text>
        </div>
      </div>
      <div className="tm-voucher-right">
        <Text
          size="small"
          style={{ fontWeight: 600, color: "var(--tm-text-primary)", marginBottom: 2 }}
        >
          {voucher.description}
        </Text>
        <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>
          {voucher.used
            ? "Đã sử dụng"
            : isExpired
            ? "Đã hết hạn"
            : `HSD: ${expiresFormatted} · Đơn tối thiểu ${(voucher.minOrderValue / 1000).toFixed(0)}K`}
        </Text>
        {!voucher.used && !isExpired && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => onApply(voucher.code)}
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
};

const NotificationPage: FC = () => {
  const notifications = useRecoilValue(notificationsState);
  const vouchers = useRecoilValue(vouchersState);
  const setAppliedCode = useSetRecoilState(appliedVoucherCodeState);
  const navigate = useNavigate();
  const snackbar = useSnackbar();

  const handleApplyVoucher = (code: string) => {
    setAppliedCode(code);
    snackbar.openSnackbar({
      type: "success",
      text: `Đã chọn mã ${code}. Vào giỏ hàng để đặt đơn! 🎉`,
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
        <div className="tm-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <span className="tm-section-title">🎟️ Voucher của bạn</span>
          <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>
            {vouchers.filter((v) => !v.used).length} mã khả dụng
          </Text>
        </div>
        <div className="space-y-3">
          {vouchers.map((voucher, i) => (
            <VoucherCard
              key={voucher.code}
              voucher={voucher}
              onApply={handleApplyVoucher}
            />
          ))}
        </div>
      </Box>
    </Page>
  );
};

export default NotificationPage;
