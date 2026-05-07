import React, { FC, useState } from "react";
import { Box, Page, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import {
  requestForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
} from "services/api";

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
    if (!email.trim()) {
      snackbar.openSnackbar({ type: "error", text: "Nhập email" });
      return;
    }
    setLoading(true);
    try {
      const res = await requestForgotPasswordOtp(email);
      if (res.debugOtp) setDebugOtp(res.debugOtp);
      snackbar.openSnackbar({ type: "success", text: "Đã gửi OTP" });
      setStep("otp");
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode) {
      snackbar.openSnackbar({ type: "error", text: "Nhập OTP" });
      return;
    }
    setLoading(true);
    try {
      await verifyForgotPasswordOtp(email, otpCode);
      setStep("reset");
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (newPassword.length < 8) {
      snackbar.openSnackbar({ type: "error", text: "Mật khẩu tối thiểu 8 ký tự" });
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithOtp({ email, otpCode, newPassword });
      snackbar.openSnackbar({ type: "success", text: "Đổi mật khẩu thành công" });
      navigate("/login", { replace: true });
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page className="page-with-bg" hideScrollbar>
      <div
        className="w-full h-full flex flex-col items-center justify-center relative p-6"
        style={{
          background: "linear-gradient(135deg, #006b45 0%, #00a96d 100%)",
          paddingTop: "calc(var(--tm-safe-area-top) + 20px)",
          paddingBottom: "calc(var(--tm-safe-area-bottom) + 24px)",
        }}
      >
        <Box className="w-full" style={{ zIndex: 1, maxWidth: 520 }}>
          <button
            onClick={() => navigate("/login")}
            style={{ background: "transparent", border: "none", color: "#fff", fontWeight: 700, marginBottom: 12 }}
          >
            ← Quay lại đăng nhập
          </button>
          <Text.Title style={{ color: "#fff", fontSize: 24, fontWeight: 800 }}>Quên mật khẩu</Text.Title>

          <div className="tm-card" style={{ padding: 20, marginTop: 16 }}>
            {step === "email" && (
              <div style={{ display: "grid", gap: 12 }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
                  Nhập email đã đăng ký để nhận mã OTP.
                </Text>
                <input
                  type="email"
                  placeholder="Email đăng ký"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: "12px 14px" }}
                />
                <button
                  onClick={handleRequestOtp}
                  disabled={loading}
                  style={{
                    border: "none",
                    borderRadius: 12,
                    padding: "12px 14px",
                    color: "#fff",
                    fontWeight: 700,
                    background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                  }}
                >
                  {loading ? "Đang gửi..." : "Gửi mã OTP"}
                </button>
              </div>
            )}

            {step === "otp" && (
              <div style={{ display: "grid", gap: 12 }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
                  Nhập mã OTP vừa nhận được trong email.
                </Text>
                {debugOtp ? (
                  <Text size="xSmall" style={{ color: "#a16207" }}>
                    Debug OTP: <strong>{debugOtp}</strong>
                  </Text>
                ) : null}
                <input
                  type="text"
                  placeholder="Mã OTP"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: "12px 14px" }}
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={loading}
                  style={{
                    border: "none",
                    borderRadius: 12,
                    padding: "12px 14px",
                    color: "#fff",
                    fontWeight: 700,
                    background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                  }}
                >
                  {loading ? "Đang xác nhận..." : "Xác nhận OTP"}
                </button>
              </div>
            )}

            {step === "reset" && (
              <div style={{ display: "grid", gap: 12 }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
                  Đặt mật khẩu mới cho tài khoản của bạn.
                </Text>
                <input
                  type="password"
                  placeholder="Mật khẩu mới (8+ ký tự)"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: "12px 14px" }}
                />
                <button
                  onClick={handleReset}
                  disabled={loading}
                  style={{
                    border: "none",
                    borderRadius: 12,
                    padding: "12px 14px",
                    color: "#fff",
                    fontWeight: 700,
                    background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                  }}
                >
                  {loading ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
                </button>
              </div>
            )}
          </div>
        </Box>
      </div>
    </Page>
  );
};

export default ForgotPasswordPage;
