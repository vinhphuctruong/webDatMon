import React, { useState } from "react";
import { Page, Box, Text, useSnackbar, Icon } from "zmp-ui";
import { useNavigate } from "react-router";
import { requestForgotPasswordOtp, verifyForgotPasswordOtp, resetPasswordWithOtp } from "services/api";

const ForgotPasswordPage = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      openSnackbar({ text: "Vui lòng nhập email", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await requestForgotPasswordOtp(email.trim());
      openSnackbar({ text: res.message || "Đã gửi mã OTP", type: "success" });
      setStep(2);
    } catch (error: any) {
      openSnackbar({ text: error.message || "Không thể gửi mã OTP", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || !newPassword.trim()) {
      openSnackbar({ text: "Vui lòng nhập OTP và mật khẩu mới", type: "error" });
      return;
    }
    if (newPassword.length < 8) {
      openSnackbar({ text: "Mật khẩu phải từ 8 ký tự trở lên", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await resetPasswordWithOtp({
        email: email.trim(),
        otpCode: otpCode.trim(),
        newPassword: newPassword
      });
      openSnackbar({ text: res.message || "Đổi mật khẩu thành công", type: "success" });
      navigate("/login", { replace: true });
    } catch (error: any) {
      openSnackbar({ text: error.message || "Đổi mật khẩu thất bại", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page className="page-with-bg" hideScrollbar>
      <div
        className="w-full h-full flex flex-col items-center relative p-6"
        style={{
          background: "linear-gradient(135deg, #006b45 0%, #00a96d 100%)",
          paddingTop: "calc(var(--tm-safe-area-top) + 20px)",
          paddingBottom: "calc(var(--tm-safe-area-bottom) + 24px)",
        }}
      >
        <div style={{ alignSelf: "flex-start", marginBottom: 20 }}>
          <button 
            onClick={() => step === 1 ? navigate(-1) : setStep(1)}
            style={{ 
              background: "rgba(255,255,255,0.2)", 
              border: "none", 
              borderRadius: "50%", 
              width: 40, height: 40, 
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white"
            }}
          >
            <Icon icon="zi-chevron-left" />
          </button>
        </div>

        <div style={{ textAlign: "center", marginBottom: 32, zIndex: 1, width: "100%" }}>
          <Text.Title style={{ color: "#fff", fontSize: 24, fontWeight: 800 }}>
            Quên mật khẩu
          </Text.Title>
          <Text size="small" style={{ color: "rgba(255,255,255,0.8)", marginTop: 8 }}>
            {step === 1 ? "Nhập email của bạn để nhận mã khôi phục" : "Nhập mã OTP đã được gửi đến email của bạn"}
          </Text>
        </div>

        {step === 1 ? (
          <form
            className="w-full tm-card"
            style={{ padding: 20, zIndex: 1 }}
            onSubmit={handleRequestOtp}
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <Text size="small" style={{ fontWeight: 600, marginBottom: 8, color: "var(--tm-text-secondary)" }}>Email đăng ký</Text>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    borderRadius: 10,
                    border: "1px solid var(--tm-border)",
                    padding: "12px 14px",
                    width: "100%"
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "14px",
                  fontWeight: 700,
                  color: "#fff",
                  background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                  opacity: submitting ? 0.7 : 1,
                  marginTop: 8,
                }}
              >
                {submitting ? "Đang gửi..." : "Nhận mã OTP"}
              </button>
            </div>
          </form>
        ) : (
          <form
            className="w-full tm-card"
            style={{ padding: 20, zIndex: 1 }}
            onSubmit={handleResetPassword}
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ padding: 12, borderRadius: 8, background: "#f4f5f6", textAlign: "center" }}>
                <Text size="small" style={{ color: "var(--tm-text-secondary)" }}>
                  Mã xác nhận đã được gửi đến
                </Text>
                <Text style={{ fontWeight: 600 }}>{email}</Text>
              </div>

              <div>
                <Text size="small" style={{ fontWeight: 600, marginBottom: 8, color: "var(--tm-text-secondary)" }}>Mã OTP (6 số)</Text>
                <input
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{
                    borderRadius: 10,
                    border: "1px solid var(--tm-border)",
                    padding: "12px 14px",
                    width: "100%",
                    fontSize: 18,
                    letterSpacing: 2,
                    textAlign: "center"
                  }}
                  required
                />
              </div>

              <div>
                <Text size="small" style={{ fontWeight: 600, marginBottom: 8, color: "var(--tm-text-secondary)" }}>Mật khẩu mới</Text>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Tối thiểu 8 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      borderRadius: 10,
                      border: "1px solid var(--tm-border)",
                      padding: "12px 14px",
                      width: "100%"
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      border: "1px solid var(--tm-border)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontWeight: 600,
                      color: "var(--tm-text-secondary)",
                      background: "#fff",
                    }}
                  >
                    {showPassword ? "Ẩn" : "Hiện"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "14px",
                  fontWeight: 700,
                  color: "#fff",
                  background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                  opacity: submitting ? 0.7 : 1,
                  marginTop: 8,
                }}
              >
                {submitting ? "Đang xử lý..." : "Đổi mật khẩu"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Page>
  );
};

export default ForgotPasswordPage;
