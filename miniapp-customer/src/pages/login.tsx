import React, { FC, useEffect, useState } from "react";
import { Page, Text, useNavigate, useSnackbar } from "zmp-ui";
import { useLocation } from "react-router";
import { getUserInfo } from "zmp-sdk";
import {
  loginWithCredentials,
  requestEmailOtp,
  registerCustomerAccount,
  requestForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  readSession,
} from "services/api";

type AuthMode = "login" | "register_customer" | "forgot_password";

function parseModeFromSearch(search: string): AuthMode {
  const mode = new URLSearchParams(search).get("mode");
  if (mode === "register_customer" || mode === "login" || mode === "forgot_password") {
    return mode;
  }
  return "login";
}

function parseRequiredFromSearch(search: string): boolean {
  return new URLSearchParams(search).get("required") === "1";
}

const LoginPage: FC = () => {
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>(() =>
    parseRequiredFromSearch(location.search)
      ? "register_customer"
      : parseModeFromSearch(location.search),
  );
  const [requireRegistration, setRequireRegistration] = useState<boolean>(() =>
    parseRequiredFromSearch(location.search),
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [customerPasswordConfirm, setCustomerPasswordConfirm] = useState("");
  const [customerOtpCode, setCustomerOtpCode] = useState("");
  const [customerOtpRequested, setCustomerOtpRequested] = useState(false);
  const [customerOtpEmail, setCustomerOtpEmail] = useState("");
  const [customerOtpExpiresIn, setCustomerOtpExpiresIn] = useState(0);
  const [showCustomerPassword, setShowCustomerPassword] = useState(false);
  const [customerSubmitting, setCustomerSubmitting] = useState(false);

  // Forgot password states
  const [fpEmail, setFpEmail] = useState("");
  const [fpOtpCode, setFpOtpCode] = useState("");
  const [fpOtpRequested, setFpOtpRequested] = useState(false);
  const [fpOtpExpiresIn, setFpOtpExpiresIn] = useState(0);
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpConfirmPassword, setFpConfirmPassword] = useState("");
  const [fpSubmitting, setFpSubmitting] = useState(false);
  const [showFpPassword, setShowFpPassword] = useState(false);
  const [fpOtpVerified, setFpOtpVerified] = useState(false);

  useEffect(() => {
    const required = parseRequiredFromSearch(location.search);
    setRequireRegistration(required);
    setMode(required ? "register_customer" : parseModeFromSearch(location.search));
    
    // Check session asynchronously
    readSession().then((session) => {
      setIsLoggedIn(!!session);
    });
  }, [location.search]);

  // Zalo info fetching moved to manual button click

  useEffect(() => {
    if (customerOtpExpiresIn <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCustomerOtpExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [customerOtpExpiresIn]);

  // Forgot password OTP countdown
  useEffect(() => {
    if (fpOtpExpiresIn <= 0) return;
    const timer = window.setInterval(() => {
      setFpOtpExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [fpOtpExpiresIn]);

  useEffect(() => {
    const normalizedEmail = customerEmail.trim().toLowerCase();
    if (
      customerOtpRequested &&
      customerOtpEmail &&
      normalizedEmail &&
      normalizedEmail !== customerOtpEmail
    ) {
      setCustomerOtpRequested(false);
      setCustomerOtpEmail("");
      setCustomerOtpCode("");
      setCustomerOtpExpiresIn(0);
    }
  }, [customerEmail, customerOtpRequested, customerOtpEmail]);

  const openError = (text: string) => {
    snackbar.openSnackbar({ type: "error", text });
  };

  const openSuccess = (text: string) => {
    snackbar.openSnackbar({ type: "success", text });
  };

  const resetCustomerOtpState = () => {
    setCustomerOtpRequested(false);
    setCustomerOtpEmail("");
    setCustomerOtpCode("");
    setCustomerOtpExpiresIn(0);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!loginEmail.trim() || !loginPassword.trim()) {
      openError("Vui lòng nhập email và mật khẩu");
      return;
    }

    setLoginSubmitting(true);
    try {
      const user = await loginWithCredentials({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      openSuccess(`Đăng nhập thành công`);
      navigate("/profile");
    } catch (error) {
      openError(error instanceof Error ? error.message : "Đăng nhập thất bại");
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = fpEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      openError("Vui lòng nhập email");
      return;
    }

    setFpSubmitting(true);
    try {
      // Step 1: Request OTP
      if (!fpOtpRequested || fpOtpExpiresIn <= 0) {
        const response = await requestForgotPasswordOtp(normalizedEmail);
        setFpOtpRequested(true);
        setFpOtpVerified(false);
        setFpOtpExpiresIn(response.expiresInSeconds ?? 300);
        if (response.debugOtp) {
          setFpOtpCode(response.debugOtp);
        }
        openSuccess(
          response.debugOtp
            ? `OTP test: ${response.debugOtp} (đã tự điền)`
            : "Đã gửi OTP đến email. Vui lòng kiểm tra hộp thư.",
        );
        return;
      }

      // Step 2: Verify OTP only
      if (!fpOtpVerified) {
        if (!fpOtpCode.trim()) {
          openError("Vui lòng nhập mã OTP");
          return;
        }
        await verifyForgotPasswordOtp(normalizedEmail, fpOtpCode.trim());
        setFpOtpVerified(true);
        openSuccess("Xác nhận OTP thành công! Vui lòng nhập mật khẩu mới.");
        return;
      }

      // Step 3: Reset password
      if (!fpNewPassword.trim() || fpNewPassword.trim().length < 8) {
        openError("Mật khẩu mới phải có ít nhất 8 ký tự");
        return;
      }
      if (fpNewPassword !== fpConfirmPassword) {
        openError("Mật khẩu nhập lại không khớp");
        return;
      }

      await resetPasswordWithOtp({
        email: normalizedEmail,
        otpCode: fpOtpCode.trim(),
        newPassword: fpNewPassword,
      });

      openSuccess("Đặt lại mật khẩu thành công! Hãy đăng nhập lại.");
      setFpEmail("");
      setFpOtpCode("");
      setFpOtpRequested(false);
      setFpOtpVerified(false);
      setFpOtpExpiresIn(0);
      setFpNewPassword("");
      setFpConfirmPassword("");
      setMode("login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Có lỗi xảy ra";
      if (message.includes("hết hạn") || message.includes("không tồn tại") || message.includes("quá nhiều lần")) {
        setFpOtpRequested(false);
        setFpOtpVerified(false);
        setFpOtpExpiresIn(0);
        setFpOtpCode("");
      }
      openError(message);
    } finally {
      setFpSubmitting(false);
    }
  };

  const handleRegisterCustomer = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedEmail = customerEmail.trim().toLowerCase();

    if (
      !customerName.trim() ||
      !normalizedEmail ||
      !customerPhone.trim() ||
      !customerPassword.trim()
    ) {
      openError("Vui lòng nhập đủ họ tên, email, số điện thoại và mật khẩu");
      return;
    }

    if (customerPassword.trim().length < 8) {
      openError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    if (customerPassword !== customerPasswordConfirm) {
      openError("Mật khẩu nhập lại không khớp");
      return;
    }

    const otpSessionValid =
      customerOtpRequested &&
      customerOtpEmail === normalizedEmail &&
      customerOtpExpiresIn > 0;

    setCustomerSubmitting(true);
    try {
      if (!otpSessionValid) {
        const response = await requestEmailOtp(normalizedEmail);
        setCustomerOtpRequested(true);
        setCustomerOtpEmail(normalizedEmail);
        setCustomerOtpExpiresIn(response.expiresInSeconds ?? 300);

        if (response.debugOtp) {
          setCustomerOtpCode(response.debugOtp);
        }

        openSuccess(
          response.debugOtp
            ? `OTP test: ${response.debugOtp} (đã tự điền)`
            : "Đã gửi OTP. Nhập OTP rồi bấm đăng ký lần nữa để xác nhận.",
        );
        return;
      }

      if (!customerOtpCode.trim()) {
        openError("Vui lòng nhập OTP email để xác nhận");
        return;
      }

      const user = await registerCustomerAccount({
        name: customerName.trim(),
        email: normalizedEmail,
        phone: customerPhone.trim(),
        password: customerPassword,
        otpCode: customerOtpCode.trim(),
      });

      resetCustomerOtpState();
      setCustomerPassword("");
      setCustomerPasswordConfirm("");
      openSuccess(`Đăng ký khách hàng thành công`);
      navigate("/profile");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Đăng ký khách hàng thất bại";
      if (
        message.includes("hết hạn") ||
        message.includes("không tồn tại") ||
        message.includes("quá nhiều lần")
      ) {
        resetCustomerOtpState();
      }
      openError(message);
    } finally {
      setCustomerSubmitting(false);
    }
  };

  const customerOtpAwaitingConfirm =
    customerOtpRequested &&
    customerOtpEmail === customerEmail.trim().toLowerCase() &&
    customerOtpExpiresIn > 0;

  return (
    <Page style={{ background: "var(--tm-bg)" }}>
      <div className="tm-header-gradient" style={{ paddingBottom: 20 }}>
        <Text.Title style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>
          Đăng nhập hệ thống
        </Text.Title>
        <Text size="xSmall" style={{ color: "rgba(255,255,255,0.85)", marginTop: 6 }}>
          Đăng nhập hoặc tạo tài khoản để đặt hàng.
        </Text>
        {requireRegistration ? (
          <Text size="xSmall" style={{ color: "#e6fff3", marginTop: 6, fontWeight: 600 }}>
            Vui lòng hoàn tất email, số điện thoại và mật khẩu để tiếp tục sử dụng ứng dụng.
          </Text>
        ) : null}
      </div>

      <div style={{ padding: "16px", display: "grid", gap: 12 }}>
        <div className="tm-card" style={{ padding: 10, display: "flex", gap: 8 }}>
          {[
            ...(isLoggedIn ? [] : [
              { key: "login", label: "Đăng nhập" },
              { key: "register_customer", label: "Đăng ký mới" },
            ]),
          ].map((tab) => {
            const active = mode === (tab.key as AuthMode);
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMode(tab.key as AuthMode)}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 12,
                  padding: "10px 8px",
                  fontWeight: 700,
                  fontSize: 12,
                  color: active ? "#fff" : "var(--tm-text-secondary)",
                  background: active
                    ? "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)"
                    : "#f1f5f3",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {mode === "login" && (
          <form className="tm-card" style={{ padding: 16 }} onSubmit={handleLogin}>
            <Text.Title style={{ fontSize: 18 }}>Đăng nhập khách hàng</Text.Title>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 12 }}>
              Đăng nhập bằng Email và mật khẩu đã đăng ký.
            </Text>

            <div style={{ display: "grid", gap: 10 }}>
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <input
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Mật khẩu"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  style={{
                    border: "1px solid var(--tm-border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontWeight: 600,
                    color: "var(--tm-text-secondary)",
                    background: "#fff",
                    cursor: "pointer",
                    minWidth: 68,
                  }}
                >
                  {showLoginPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>
              <button
                type="submit"
                disabled={loginSubmitting}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 700,
                  color: "#fff",
                  background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                  cursor: "pointer",
                  opacity: loginSubmitting ? 0.7 : 1,
                }}
              >
                {loginSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
              <button
                type="button"
                onClick={() => setMode("forgot_password")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--tm-primary)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  padding: "4px 0",
                  textAlign: "right",
                }}
              >
                Quên mật khẩu?
              </button>
            </div>
          </form>
        )}

        {mode === "forgot_password" && (
          <form className="tm-card" style={{ padding: 16 }} onSubmit={handleForgotPassword}>
            <Text.Title style={{ fontSize: 18 }}>Quên mật khẩu</Text.Title>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 12 }}>
              {!fpOtpRequested || fpOtpExpiresIn <= 0
                ? "Bước 1/3: Nhập email đã đăng ký để nhận mã OTP."
                : !fpOtpVerified
                  ? "Bước 2/3: Nhập mã OTP đã gửi đến email của bạn."
                  : "Bước 3/3: Nhập mật khẩu mới cho tài khoản."}
            </Text>

            <div style={{ display: "grid", gap: 10 }}>
              <input
                type="email"
                placeholder="Email đã đăng ký"
                value={fpEmail}
                onChange={(e) => setFpEmail(e.target.value)}
                disabled={fpOtpRequested && fpOtpExpiresIn > 0}
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--tm-border)",
                  padding: 12,
                  opacity: fpOtpRequested && fpOtpExpiresIn > 0 ? 0.6 : 1,
                }}
              />

              {fpOtpRequested && fpOtpExpiresIn > 0 && !fpOtpVerified && (
                <>
                  <input
                    type="text"
                    placeholder="Nhập mã OTP (6 số)"
                    value={fpOtpCode}
                    onChange={(e) => setFpOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                  />
                  <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                    OTP có hiệu lực trong {fpOtpExpiresIn}s.
                  </Text>
                </>
              )}

              {fpOtpVerified && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px", borderRadius: 10,
                  background: "var(--tm-primary-light)", border: "1px solid var(--tm-primary)",
                }}>
                  <span style={{ fontSize: 16 }}>✅</span>
                  <Text size="xSmall" style={{ color: "var(--tm-primary)", fontWeight: 600 }}>
                    OTP đã xác nhận thành công
                  </Text>
                </div>
              )}

              {fpOtpVerified && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                    <input
                      type={showFpPassword ? "text" : "password"}
                      placeholder="Mật khẩu mới (>= 8 ký tự)"
                      value={fpNewPassword}
                      onChange={(e) => setFpNewPassword(e.target.value)}
                      style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowFpPassword((prev) => !prev)}
                      style={{
                        border: "1px solid var(--tm-border)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontWeight: 600,
                        color: "var(--tm-text-secondary)",
                        background: "#fff",
                        cursor: "pointer",
                        minWidth: 68,
                      }}
                    >
                      {showFpPassword ? "Ẩn" : "Hiện"}
                    </button>
                  </div>

                  <input
                    type={showFpPassword ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu mới"
                    value={fpConfirmPassword}
                    onChange={(e) => setFpConfirmPassword(e.target.value)}
                    style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                  />
                </>
              )}

              <button
                type="submit"
                disabled={fpSubmitting}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 700,
                  color: "#fff",
                  background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                  cursor: "pointer",
                  opacity: fpSubmitting ? 0.7 : 1,
                }}
              >
                {fpSubmitting
                  ? fpOtpVerified
                    ? "Đang đặt lại mật khẩu..."
                    : fpOtpRequested && fpOtpExpiresIn > 0
                      ? "Đang xác nhận OTP..."
                      : "Đang gửi OTP..."
                  : fpOtpVerified
                    ? "Đặt lại mật khẩu"
                    : fpOtpRequested && fpOtpExpiresIn > 0
                      ? "Xác nhận OTP"
                      : "Gửi mã OTP"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setFpOtpRequested(false);
                  setFpOtpVerified(false);
                  setFpOtpExpiresIn(0);
                  setFpOtpCode("");
                  setFpNewPassword("");
                  setFpConfirmPassword("");
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--tm-text-secondary)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  padding: "4px 0",
                  textAlign: "center",
                }}
              >
                ← Quay lại đăng nhập
              </button>
            </div>
          </form>
        )}

        {mode === "register_customer" && (
          <form className="tm-card" style={{ padding: 16 }} onSubmit={handleRegisterCustomer}>
            <Text.Title style={{ fontSize: 18 }}>Đăng ký khách hàng</Text.Title>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 12 }}>
              {requireRegistration
                ? "Bắt buộc hoàn tất thông tin để kích hoạt tài khoản sử dụng app."
                : "Tạo tài khoản khách hàng và đăng nhập ngay."}
            </Text>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Họ tên"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{ flex: 1, borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    snackbar.openSnackbar({ type: "info", text: "Đang yêu cầu Zalo..." });
                    getUserInfo({ autoRequestPermission: true })
                      .then((res) => {
                        const userInfoStr = JSON.stringify(res.userInfo || {});
                        snackbar.openSnackbar({ type: "success", text: `Phản hồi: ${userInfoStr}` });
                        
                        const zaloName = res.userInfo?.name?.trim() || "";
                        if (zaloName) {
                          setCustomerName(zaloName);
                        }
                      })
                      .catch((error: any) => {
                        const errMsg = error?.message || JSON.stringify(error) || "Lỗi không xác định";
                        openError(`Không thể lấy thông tin: ${errMsg}`);
                      });
                  }}
                  style={{
                    padding: "0 12px",
                    borderRadius: 10,
                    border: "1px solid var(--tm-primary)",
                    color: "var(--tm-primary)",
                    background: "var(--tm-primary-light)",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  Lấy từ Zalo
                </button>
              </div>
              <input
                type="email"
                placeholder="Email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
              />

              {customerOtpAwaitingConfirm ? (
                <input
                  type="text"
                  placeholder="Nhập OTP email (6 số)"
                  value={customerOtpCode}
                  onChange={(e) => setCustomerOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                />
              ) : (
                <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                  Nhấn "Đăng ký khách hàng" để hệ thống tự gửi OTP đến email ở trên.
                </Text>
              )}

              {customerOtpExpiresIn > 0 ? (
                <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                  OTP có hiệu lực trong {customerOtpExpiresIn}s.
                </Text>
              ) : null}

              <input
                type="tel"
                placeholder="Số điện thoại"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <input
                  type={showCustomerPassword ? "text" : "password"}
                  placeholder="Mật khẩu (>= 8 ký tự)"
                  value={customerPassword}
                  onChange={(e) => setCustomerPassword(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                />
                <button
                  type="button"
                  onClick={() => setShowCustomerPassword((prev) => !prev)}
                  style={{
                    border: "1px solid var(--tm-border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontWeight: 600,
                    color: "var(--tm-text-secondary)",
                    background: "#fff",
                    cursor: "pointer",
                    minWidth: 68,
                  }}
                >
                  {showCustomerPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>

              <input
                type={showCustomerPassword ? "text" : "password"}
                placeholder="Nhập lại mật khẩu"
                value={customerPasswordConfirm}
                onChange={(e) => setCustomerPasswordConfirm(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
              />

              <button
                type="submit"
                disabled={customerSubmitting}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 700,
                  color: "#fff",
                  background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                  cursor: "pointer",
                  opacity: customerSubmitting ? 0.7 : 1,
                }}
              >
                {customerSubmitting
                  ? customerOtpAwaitingConfirm
                    ? "Đang xác nhận OTP..."
                    : "Đang gửi OTP..."
                  : customerOtpAwaitingConfirm
                    ? "Xác nhận OTP & Đăng ký"
                    : "Đăng ký khách hàng"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Page>
  );
};

export default LoginPage;
