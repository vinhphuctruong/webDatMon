import React, { FC, useEffect, useMemo, useState } from "react";
import { Box, Page, Text, Icon, Modal, Input, Button, useSnackbar } from "zmp-ui";
import { 
  fetchMyWallets, 
  fetchWalletTransactions, 
  requestTopup, 
  confirmTopupMock, 
  requestPayout 
} from "services/driver-api";
import { DisplayPrice } from "components/display/price";

const WalletPage: FC = () => {
  const [wallets, setWallets] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const snackbar = useSnackbar();

  // Modals state
  const [topupVisible, setTopupVisible] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupRequest, setTopupRequest] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [payoutVisible, setPayoutVisible] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [bankCode, setBankCode] = useState("VMB");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  const loadData = async () => {
    try {
      const res = await fetchMyWallets();
      if (res.data && res.data.wallets) {
        setWallets(res.data.wallets);
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

  const handleTopup = async () => {
    if (!topupAmount || isNaN(Number(topupAmount)) || Number(topupAmount) < 10000) {
      return snackbar.openSnackbar({ type: "error", text: "Số tiền nạp tối thiểu 10,000đ" });
    }
    setIsProcessing(true);
    try {
      const res = await requestTopup(Number(topupAmount));
      setTopupRequest(res.data);
    } catch (err: any) {
      snackbar.openSnackbar({ type: "error", text: err.message || "Lỗi tạo yêu cầu nạp tiền" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmMock = async () => {
    if (!topupRequest) return;
    setIsProcessing(true);
    try {
      await confirmTopupMock(topupRequest.referenceCode);
      snackbar.openSnackbar({ type: "success", text: "Đã nạp tiền thành công (Mock)" });
      setTopupVisible(false);
      setTopupAmount("");
      setTopupRequest(null);
      loadData();
    } catch (err: any) {
      snackbar.openSnackbar({ type: "error", text: err.message || "Lỗi giả lập thanh toán" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayout = async () => {
    const amount = Number(payoutAmount);
    if (!amount || amount < 10000) return snackbar.openSnackbar({ type: "error", text: "Số tiền tối thiểu 10,000đ" });
    if (!bankAccount || !bankAccountName) return snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập đầy đủ thông tin ngân hàng" });

    setIsProcessing(true);
    try {
      await requestPayout({
        amount,
        bankCode,
        bankAccountNumber: bankAccount,
        bankAccountName: bankAccountName.toUpperCase(),
        note: "Driver withdraw",
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
      <Box
        p={4}
        className="tm-content-pad tm-page-safe-top"
        style={{
          background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
          paddingBottom: 42,
        }}
      >
        <Text.Title style={{ color: "#fff", fontSize: 20 }}>Ví & Thu nhập</Text.Title>
        <Text size="xSmall" style={{ color: "rgba(255,255,255,0.82)", marginTop: 4 }}>
          Quản lý dòng tiền vận hành tài khoản tài xế
        </Text>
      </Box>

      <Box p={4} className="tm-content-pad" style={{ marginTop: -26 }}>
        {loading ? (
          <Box className="flex items-center justify-center" style={{ padding: 48 }}>
            <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
          </Box>
        ) : !wallets ? (
          <div className="tm-empty-state tm-card" style={{ padding: "42px 20px" }}>
            <span className="tm-empty-icon"></span>
            <Text style={{ fontWeight: 700 }}>Chưa có thông tin ví</Text>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {/* Credit Wallet */}
            <div className="tm-card tm-interactive animate-slide-up" style={{ padding: 20, background: "linear-gradient(135deg, #1e293b, #0f172a)", color: "#fff", border: "none", boxShadow: "var(--tm-shadow-floating)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}></span>
                  <div>
                    <Text style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Ví tín dụng</Text>
                    <Text size="xxxSmall" style={{ color: "#94a3b8" }}>Dùng ký quỹ nhận đơn COD</Text>
                  </div>
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.1)" }}>
                <Text size="xSmall" style={{ color: "#94a3b8" }}>Khả dụng</Text>
                <Text style={{ fontSize: 28, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>
                  <DisplayPrice>{wallets.credit?.availableBalance || 0}</DisplayPrice>
                </Text>
                {wallets.credit?.holdBalance > 0 && (
                  <Text size="xxxSmall" style={{ color: "#fcd34d", marginTop: 6 }}>
                    Đang giữ: <DisplayPrice>{wallets.credit.holdBalance}</DisplayPrice>
                  </Text>
                )}
              </div>
              <button 
                className="tm-interactive"
                onClick={() => setTopupVisible(true)}
                style={{ width: "100%", padding: "12px", background: "#38bdf8", color: "#0f172a", border: "none", borderRadius: 12, marginTop: 12, fontWeight: 700, fontSize: 14 }}
              >
                Nạp tiền
              </button>
            </div>

            {/* Cash Wallet */}
            <div className="tm-card tm-interactive animate-slide-up" style={{ padding: 20, background: "linear-gradient(135deg, #064e3b, #022c22)", color: "#fff", border: "none", boxShadow: "var(--tm-shadow-floating)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}></span>
                  <div>
                    <Text style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Ví tiền mặt</Text>
                    <Text size="xxxSmall" style={{ color: "#a7f3d0" }}>Thu nhập giao hàng</Text>
                  </div>
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.1)" }}>
                <Text size="xSmall" style={{ color: "#a7f3d0" }}>Khả dụng</Text>
                <Text style={{ fontSize: 28, fontWeight: 800, color: "#34d399", marginTop: 4 }}>
                  <DisplayPrice>{wallets.cash?.availableBalance || 0}</DisplayPrice>
                </Text>
              </div>
              <button 
                className="tm-interactive"
                onClick={() => setPayoutVisible(true)}
                style={{ width: "100%", padding: "12px", background: "transparent", color: "#34d399", border: "1px solid #34d399", borderRadius: 12, marginTop: 12, fontWeight: 700, fontSize: 14 }}
              >
                Rút tiền
              </button>
            </div>

            {/* Transactions History */}
            <div style={{ marginTop: 20 }}>
              <Text style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Lịch sử giao dịch</Text>
              {transactions.length === 0 ? (
                <div className="tm-card" style={{ padding: 20, textAlign: "center" }}>
                  <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Chưa có giao dịch nào</Text>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {transactions.map((tx: any) => (
                    <div key={tx.id} className="tm-card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <Text style={{ fontSize: 14, fontWeight: 600 }}>
                          {tx.direction === "CREDIT" ? "Cộng tiền" : "Trừ tiền"}
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
          </div>
        )}
      </Box>

      {/* Modal Nạp tiền */}
      <Modal
        visible={topupVisible}
        title="Nạp ví Tín dụng"
        onClose={() => {
          setTopupVisible(false);
          setTopupRequest(null);
          setTopupAmount("");
        }}
      >
        <Box p={4}>
          {!topupRequest ? (
            <>
              <Input
                type="number"
                label="Số tiền cần nạp"
                placeholder="VD: 50000"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
              />
              <Button fullWidth onClick={handleTopup} loading={isProcessing} style={{ marginTop: 16 }}>
                Tạo mã nạp tiền
              </Button>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <Text style={{ fontWeight: 600 }}>Quét mã QR qua ứng dụng Ngân hàng</Text>
              <div style={{ background: "#f3f4f6", padding: 16, borderRadius: 8, margin: "16px 0", fontSize: 12 }}>
                [Hình ảnh QR Code (Mock)]<br/>
                Mã GD: {topupRequest.referenceCode}<br/>
                Số tiền: <DisplayPrice>{topupRequest.amount}</DisplayPrice>
              </div>
              <Button fullWidth onClick={handleConfirmMock} loading={isProcessing} style={{ background: "#059669" }}>
                Giả lập đã chuyển khoản
              </Button>
            </div>
          )}
        </Box>
      </Modal>

      {/* Modal Rút tiền */}
      <Modal
        visible={payoutVisible}
        title="Rút tiền"
        onClose={() => {
          setPayoutVisible(false);
          setPayoutAmount("");
        }}
      >
        <Box p={4} style={{ display: "grid", gap: 12 }}>
          <Input
            type="number"
            label="Số tiền cần rút"
            placeholder="VD: 100000"
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
