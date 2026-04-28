import React, { FC, useState } from "react";
import { Box, Page, Text, Input, Button, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { requestForgotPasswordOtp, verifyForgotPasswordOtp, resetPasswordWithOtp } from "services/api";

const ForgotPasswordPage: FC = () => {
  const [step, setStep] = useState<"email" | "otp" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const snackbar = useSnackbar();
  const navigate = useNavigate();

  const handleRequestOtp = async () => {
    if (!email.trim()) { snackbar.openSnackbar({ type: "error", text: "Nhập email" }); return; }
    setLoading(true);
    try {
      const res = await requestForgotPasswordOtp(email);
      if (res.debugOtp) setDebugOtp(res.debugOtp);
      snackbar.openSnackbar({ type: "success", text: "Đã gửi OTP" });
      setStep("otp");
    } catch (e: any) { snackbar.openSnackbar({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode) { snackbar.openSnackbar({ type: "error", text: "Nhập OTP" }); return; }
    setLoading(true);
    try {
      await verifyForgotPasswordOtp(email, otpCode);
      setStep("reset");
    } catch (e: any) { snackbar.openSnackbar({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (newPassword.length < 8) { snackbar.openSnackbar({ type: "error", text: "Mật khẩu tối thiểu 8 ký tự" }); return; }
    setLoading(true);
    try {
      await resetPasswordWithOtp({ email, otpCode, newPassword });
      snackbar.openSnackbar({ type: "success", text: "Đổi mật khẩu thành công!" });
      navigate("/login", { replace: true });
    } catch (e: any) { snackbar.openSnackbar({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <Page className="page-with-bg">
      <Box style={{ padding: 24 }}>
        <div className="tm-link-back" onClick={() => navigate("/login")}>← Quay lại</div>
        <Text.Title style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Quên mật khẩu</Text.Title>

        <div className="tm-card" style={{ padding: 24, marginTop: 16 }}>
          {step === "email" && (
            <div style={{ display: "grid", gap: 16 }}>
              <Input placeholder="Email đăng ký" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button fullWidth loading={loading} onClick={handleRequestOtp}>Gửi mã OTP</Button>
            </div>
          )}
          {step === "otp" && (
            <div style={{ display: "grid", gap: 16 }}>
              {debugOtp && <Text size="xSmall" style={{ textAlign: "center", color: "var(--tm-warning)" }}>Debug OTP: <strong>{debugOtp}</strong></Text>}
              <Input placeholder="Nhập mã OTP" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
              <Button fullWidth loading={loading} onClick={handleVerifyOtp}>Xác nhận OTP</Button>
            </div>
          )}
          {step === "reset" && (
            <div style={{ display: "grid", gap: 16 }}>
              <Input type="password" placeholder="Mật khẩu mới (8+ ký tự)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <Button fullWidth loading={loading} onClick={handleReset}>Đặt lại mật khẩu</Button>
            </div>
          )}
        </div>
      </Box>
    </Page>
  );
};

export default ForgotPasswordPage;
