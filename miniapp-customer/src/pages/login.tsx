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
      ? "login"
      : parseModeFromSearch(location.search),
  );
  // required=1: user must login to continue (coming from protected feature)
  const [requireLogin, setRequireLogin] = useState<boolean>(() =>
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
    setRequireLogin(required);
    // Khi đi từ tính năng cần đăng nhập (required=1) thì ưu tiên mở form đăng nhập trước
    setMode(required ? "login" : parseModeFromSearch(location.search));
    
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

  const screen: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #ecfdf5 0%, #ffffff 65%, #ffffff 100%)",
    display: "flex",
    justifyContent: "center",
    padding: "28px 16px",
  };

  const card: React.CSSProperties = {
    width: "100%",
    maxWidth: 360,
    marginTop: 24,
    padding: 18,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid var(--tm-border)",
    boxShadow: "var(--tm-shadow-md)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 999,
    border: "1px solid var(--tm-border)",
    background: "#ffffff",
    color: "var(--tm-text-primary)",
    padding: "12px 14px",
    outline: "none",
    fontSize: 14,
  };

  const pillButton: React.CSSProperties = {
    width: "100%",
    border: "none",
    borderRadius: 999,
    padding: "12px 14px",
    fontWeight: 800,
    letterSpacing: 0.5,
    cursor: "pointer",
  };

  return (
    <Page style={{ background: "transparent" }}>
      <div style={screen}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div style={{ textAlign: "center" }}>
            <Text.Title style={{ color: "var(--tm-text-primary)", fontWeight: 900, fontSize: 22 }}>
              {mode === "register_customer" ? "Đăng ký tài khoản" : mode === "forgot_password" ? "Quên mật khẩu" : "Đăng nhập"}
            </Text.Title>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 6 }}>
              {mode === "register_customer"
                ? "Tạo tài khoản để đặt hàng và theo dõi đơn."
                : mode === "forgot_password"
                  ? "Nhập email để nhận OTP và đặt lại mật khẩu."
                  : "Đăng nhập để tiếp tục đặt hàng."}
            </Text>
            {requireLogin ? (
              <Text size="xSmall" style={{ color: "var(--tm-primary)", marginTop: 6, fontWeight: 800 }}>
                Vui lòng đăng nhập để tiếp tục sử dụng tính năng này.
              </Text>
            ) : null}
          </div>

          <div style={card}>
            {mode === "login" && (
              <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
                <input
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Mật khẩu"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={inputStyle}
                />

                <button
                  type="submit"
                  disabled={loginSubmitting}
                  style={{
                    ...pillButton,
                    background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                    color: "#fff",
                    opacity: loginSubmitting ? 0.7 : 1,
                  }}
                >
                  {loginSubmitting ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--tm-text-secondary)",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {showLoginPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                </button>

                <button
                  type="button"
                  onClick={() => setMode("forgot_password")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--tm-primary)",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                    textAlign: "center",
                    textDecoration: "underline",
                  }}
                >
                  Quên mật khẩu?
                </button>

                <div style={{ textAlign: "center", marginTop: 2 }}>
                  <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                    Chưa có tài khoản?
                  </Text>{" "}
                  <button
                    type="button"
                    onClick={() => setMode("register_customer")}
                    style={{
                      border: "1px solid var(--tm-primary)",
                      background: "#ffffff",
                      color: "var(--tm-primary)",
                      fontWeight: 800,
                      cursor: "pointer",
                      padding: "10px 14px",
                      borderRadius: 999,
                      marginTop: 10,
                      width: "100%",
                    }}
                  >
                    ĐĂNG KÝ
                  </button>
                </div>
              </form>
            )}

            {mode === "forgot_password" && (
              <form onSubmit={handleForgotPassword} style={{ display: "grid", gap: 12 }}>
                <input
                  type="email"
                  placeholder="Email đã đăng ký"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  disabled={fpOtpRequested && fpOtpExpiresIn > 0}
                  style={{ ...inputStyle, opacity: fpOtpRequested && fpOtpExpiresIn > 0 ? 0.6 : 1 }}
                />

                {fpOtpRequested && fpOtpExpiresIn > 0 && !fpOtpVerified && (
                  <>
                    <input
                      type="text"
                      placeholder="Mã OTP (6 số)"
                      value={fpOtpCode}
                      onChange={(e) => setFpOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      style={inputStyle}
                    />
                    <Text size="xxSmall" style={{ color: "rgba(255,255,255,0.82)", textAlign: "center" }}>
                      OTP còn hiệu lực: {fpOtpExpiresIn}s
                    </Text>
                  </>
                )}

                {fpOtpVerified && (
                  <>
                    <input
                      type={showFpPassword ? "text" : "password"}
                      placeholder="Mật khẩu mới (>= 8 ký tự)"
                      value={fpNewPassword}
                      onChange={(e) => setFpNewPassword(e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      type={showFpPassword ? "text" : "password"}
                      placeholder="Nhập lại mật khẩu mới"
                      value={fpConfirmPassword}
                      onChange={(e) => setFpConfirmPassword(e.target.value)}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowFpPassword((prev) => !prev)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--tm-text-secondary)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      {showFpPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    </button>
                  </>
                )}

                <button
                  type="submit"
                  disabled={fpSubmitting}
                  style={{
                    ...pillButton,
                    background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                    color: "#fff",
                    opacity: fpSubmitting ? 0.7 : 1,
                  }}
                >
                  {fpSubmitting
                    ? "ĐANG XỬ LÝ..."
                    : fpOtpVerified
                      ? "ĐẶT LẠI MẬT KHẨU"
                      : fpOtpRequested && fpOtpExpiresIn > 0
                        ? "XÁC NHẬN OTP"
                        : "GỬI OTP"}
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
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    textAlign: "center",
                    textDecoration: "underline",
                  }}
                >
                  ← Quay lại đăng nhập
                </button>
              </form>
            )}

            {mode === "register_customer" && (
              <form onSubmit={handleRegisterCustomer} style={{ display: "grid", gap: 12 }}>
                <input
                  type="text"
                  placeholder="Họ và tên"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  style={inputStyle}
                />

                {customerOtpAwaitingConfirm ? (
                  <>
                    <input
                      type="text"
                      placeholder="Mã OTP (6 số)"
                      value={customerOtpCode}
                      onChange={(e) => setCustomerOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      style={inputStyle}
                    />
                    <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", textAlign: "center" }}>
                      OTP còn hiệu lực: {customerOtpExpiresIn}s
                    </Text>
                  </>
                ) : (
                  <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", textAlign: "center" }}>
                    Nhấn “ĐĂNG KÝ” để nhận OTP qua email.
                  </Text>
                )}

                <input
                  type="tel"
                  placeholder="Số điện thoại"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  style={inputStyle}
                />

                <input
                  type={showCustomerPassword ? "text" : "password"}
                  placeholder="Mật khẩu (>= 8 ký tự)"
                  value={customerPassword}
                  onChange={(e) => setCustomerPassword(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type={showCustomerPassword ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu"
                  value={customerPasswordConfirm}
                  onChange={(e) => setCustomerPasswordConfirm(e.target.value)}
                  style={inputStyle}
                />

                <button
                  type="button"
                  onClick={() => setShowCustomerPassword((prev) => !prev)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--tm-text-secondary)",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {showCustomerPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                </button>

                <button
                  type="submit"
                  disabled={customerSubmitting}
                  style={{
                    ...pillButton,
                    background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                    color: "#fff",
                    opacity: customerSubmitting ? 0.7 : 1,
                  }}
                >
                  {customerSubmitting
                    ? "ĐANG XỬ LÝ..."
                    : customerOtpAwaitingConfirm
                      ? "XÁC NHẬN OTP & ĐĂNG KÝ"
                      : "ĐĂNG KÝ"}
                </button>

                <div style={{ textAlign: "center", marginTop: 2 }}>
                  <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)" }}>
                    Đã có tài khoản?
                  </Text>{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--tm-primary)",
                      fontWeight: 900,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    Đăng nhập
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
};

export default LoginPage;
