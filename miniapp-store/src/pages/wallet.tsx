import React, { useEffect, useState } from "react";
import { Page, Box, Text, Icon, Modal, Input, Button, useSnackbar } from "zmp-ui";
import { fetchMyWallets, fetchWalletTransactions, requestPayout } from "services/api";
import { DisplayPrice } from "components/display/price";

const WalletPage = () => {
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const snackbar = useSnackbar();

  const [payoutVisible, setPayoutVisible] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [bankCode, setBankCode] = useState("VCB");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetchMyWallets();
      if (res.data && res.data.wallets && res.data.wallets.merchant) {
        setWallet(res.data.wallets.merchant);
      }
      const txRes = await fetchWalletTransactions();
      setTransactions(txRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePayout = async () => {
    const amount = Number(payoutAmount);
    if (!amount || amount < 50000) return snackbar.openSnackbar({ type: "error", text: "Số tiền tối thiểu 50,000đ" });
    if (!bankAccount || !bankAccountName) return snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập đầy đủ thông tin" });

    setIsProcessing(true);
    try {
      await requestPayout({
        amount,
        bankCode,
        bankAccountNumber: bankAccount,
        bankAccountName: bankAccountName.toUpperCase(),
        note: "Store withdraw",
      });
      snackbar.openSnackbar({ type: "success", text: "Yêu cầu rút tiền thành công" });
      setPayoutVisible(false);
      setPayoutAmount("");
      loadData();
    } catch (err: any) {
      snackbar.openSnackbar({ type: "error", text: err.message || "Lỗi yêu cầu rút tiền" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Page className="page-with-bg pb-20">
      <Box className="tm-page-topbar tm-page-safe-top">
        <div className="tm-page-topbar-title">
          <Text.Title style={{ marginBottom: 0 }}>Ví Cửa Hàng</Text.Title>
        </div>
      </Box>

      <Box p={4} className="tm-content-pad">
        {loading ? (
           <Box className="flex items-center justify-center" style={{ padding: 48 }}>
             <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
           </Box>
        ) : !wallet ? (
           <div className="tm-empty-state tm-card" style={{ padding: "42px 20px" }}>
             <span className="tm-empty-icon">💰</span>
             <Text style={{ fontWeight: 700 }}>Chưa có thông tin ví</Text>
           </div>
        ) : (
          <>
            <div 
              className="tm-card tm-interactive animate-slide-up" 
              style={{ 
                padding: 24, 
                background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                color: "#fff",
                boxShadow: "var(--tm-shadow-floating)",
                border: "none",
              }}
            >
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500, letterSpacing: 0.5, textTransform: "uppercase" }}>Số dư khả dụng</Text>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <Text.Title style={{ fontSize: 36, color: "#fff", letterSpacing: -0.5 }}>
                  <DisplayPrice>{wallet.availableBalance}</DisplayPrice>
                </Text.Title>
              </div>
              
              <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
                <button 
                  className="tm-interactive"
                  onClick={() => setPayoutVisible(true)}
                  style={{ 
                    flex: 1, padding: "12px", borderRadius: 12, 
                    background: "#fff", color: "var(--tm-primary)", 
                    fontWeight: 700, border: "none",
                    display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                >
                  <Icon icon="zi-download" size={18} />
                  Rút tiền
                </button>
                <button 
                  className="tm-interactive"
                  style={{ 
                    flex: 1, padding: "12px", borderRadius: 12, 
                    background: "rgba(255,255,255,0.2)", color: "#fff", 
                    fontWeight: 600, border: "1px solid rgba(255,255,255,0.3)",
                    display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Icon icon="zi-clock-1" size={18} />
                  Lịch sử
                </button>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <Text.Title style={{ fontSize: 16, marginBottom: 12 }}>Giao dịch gần đây</Text.Title>
              {transactions.length === 0 ? (
                <div className="tm-card" style={{ padding: 20, textAlign: "center", background: "#fff" }}>
                  <Text style={{ color: "var(--tm-text-secondary)" }}>Chưa có giao dịch nào.</Text>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {transactions.map((tx: any) => (
                    <div key={tx.id} className="tm-card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <Text style={{ fontSize: 14, fontWeight: 600 }}>
                          {tx.direction === "CREDIT" ? "Cộng doanh thu" : "Trừ tiền / Rút tiền"}
                        </Text>
                        <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
                          {new Date(tx.createdAt).toLocaleString("vi-VN")}
                        </Text>
                        <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
                          {tx.note || tx.type}
                        </Text>
                      </div>
                      <Text style={{ 
                        fontSize: 15, fontWeight: 700, 
                        color: tx.direction === "CREDIT" ? "#059669" : "#dc2626" 
                      }}>
                        {tx.direction === "CREDIT" ? "+" : "-"}<DisplayPrice>{tx.amount}</DisplayPrice>
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Box>

      {/* Modal Rút tiền */}
      <Modal
        visible={payoutVisible}
        title="Rút doanh thu"
        onClose={() => {
          setPayoutVisible(false);
          setPayoutAmount("");
        }}
      >
        <Box p={4} style={{ display: "grid", gap: 12 }}>
          <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
            Số dư có thể rút: <DisplayPrice>{wallet?.availableBalance || 0}</DisplayPrice>
          </Text>
          <Input
            type="number"
            label="Số tiền cần rút"
            placeholder="Tối thiểu 50.000đ"
            value={payoutAmount}
            onChange={(e) => setPayoutAmount(e.target.value)}
          />
          <Input
            label="Ngân hàng"
            placeholder="VD: VCB, TCB, VMB..."
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
          />
          <Input
            label="Số tài khoản"
            placeholder="Nhập số tài khoản"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
          />
          <Input
            label="Tên chủ tài khoản"
            placeholder="NGUYEN VAN A"
            value={bankAccountName}
            onChange={(e) => setBankAccountName(e.target.value)}
          />
          <Button fullWidth onClick={handlePayout} loading={isProcessing} style={{ marginTop: 12 }}>
            Yêu cầu rút tiền
          </Button>
        </Box>
      </Modal>
    </Page>
  );
};

export default WalletPage;
