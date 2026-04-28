import React, { FC, useEffect, useState } from "react";
import { Box, Page, Text, Header } from "zmp-ui";
import { fetchMyWallets } from "services/driver-api";
import { DisplayPrice } from "components/display/price";

const WalletPage: FC = () => {
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyWallets()
      .then((res) => setWallets(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const walletLabels: Record<string, { label: string; icon: string; color: string }> = {
    DRIVER_CREDIT: { label: "Ví tín dụng", icon: "🏦", color: "#3b82f6" },
    DRIVER_CASH: { label: "Ví tiền mặt", icon: "💵", color: "#10b981" },
  };

  return (
    <Page className="page-with-bg">
      <Header title="Ví & Thu nhập" showBackIcon />
      <Box style={{ padding: 16 }}>
        {loading ? (
          <Box className="flex items-center justify-center" style={{ padding: 48 }}>
            <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
          </Box>
        ) : wallets.length === 0 ? (
          <div className="tm-empty-state">
            <span className="tm-empty-icon">💰</span>
            <Text style={{ fontWeight: 600 }}>Chưa có thông tin ví</Text>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {wallets.map((wallet) => {
              const config = walletLabels[wallet.type] || { label: wallet.type, icon: "💳", color: "#666" };
              return (
                <div key={wallet.id} className="tm-card animate-slide-up" style={{ padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{config.icon}</span>
                    <div>
                      <Text style={{ fontWeight: 700, fontSize: 15 }}>{config.label}</Text>
                      <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>
                        {wallet.type === "DRIVER_CREDIT"
                          ? "Dùng để ký quỹ nhận đơn COD"
                          : "Tiền nhận được từ giao hàng"
                        }
                      </Text>
                    </div>
                  </div>
                  <div style={{
                    background: "var(--tm-bg)", borderRadius: 12, padding: 16,
                    textAlign: "center",
                  }}>
                    <Text style={{ fontSize: 28, fontWeight: 800, color: config.color }}>
                      <DisplayPrice>{wallet.availableBalance || 0}</DisplayPrice>
                    </Text>
                    <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)", marginTop: 4 }}>
                      Số dư khả dụng
                    </Text>
                    {wallet.heldBalance > 0 && (
                      <Text size="xxxSmall" style={{ color: "var(--tm-warning)", marginTop: 4 }}>
                        🔒 Đang giữ: <DisplayPrice>{wallet.heldBalance}</DisplayPrice>
                      </Text>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="tm-card" style={{ padding: 20 }}>
              <Text style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>💡 Lưu ý</Text>
              <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", lineHeight: "20px" }}>
                • <strong>Ví tín dụng</strong>: Hệ thống giữ tạm khi bạn nhận đơn COD, trả lại sau khi giao thành công.{"\n"}
                • <strong>Ví tiền mặt</strong>: Thu nhập thực tế từ phí giao hàng.{"\n"}
                • Liên hệ Admin để nạp tiền vào ví tín dụng.
              </Text>
            </div>
          </div>
        )}
      </Box>
    </Page>
  );
};

export default WalletPage;
