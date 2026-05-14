import React, { useState, useEffect } from "react";
import { Page, Box, Text, useSnackbar } from "zmp-ui";
import { useNavigate, useLocation } from "react-router";
import { loginWithCredentials, fetchMyStoreApplication } from "services/api";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const isRegisterIntent = queryParams.get("intent") === "register";

  useEffect(() => {
    const raw = localStorage.getItem("zaui_food_session");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.accessToken) {
          navigate("/");
          return;
        }
      } catch (e) {
        // ignore
      }
      localStorage.removeItem("zaui_food_session");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      openSnackbar({ text: "Vui lòng nhập email và mật khẩu", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const user = await loginWithCredentials({ email: email.trim(), password });
      openSnackbar({ text: "Đăng nhập thành công", type: "success" });

      if (user.role === "STORE_MANAGER" || user.role === "ADMIN") {
        navigate("/");
      } else {
        // Handle CUSTOMER role: check if they have a pending application
        try {
          await fetchMyStoreApplication();
          // If successful, they have an application
          navigate("/application-status");
        } catch (appError: any) {
          // If 404, they don't have an application -> register
          navigate("/register");
        }
      }
    } catch (error: any) {
      openSnackbar({ text: error.message || "Đăng nhập thất bại", type: "error" });
    } finally {
      setSubmitting(false);
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
        <div style={{ textAlign: "center", marginBottom: 32, zIndex: 1 }}>
          <div
            style={{
              width: 80,
              height: 80,
              background: "#fff",
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            }}
          >
            <span style={{ fontSize: 40 }}></span>
          </div>
          <Text.Title style={{ color: "#fff", fontSize: 24, fontWeight: 800 }}>
            TM Food Quán
          </Text.Title>
          <Text size="small" style={{ color: "rgba(255,255,255,0.8)" }}>
            Dành cho Chủ cửa hàng & Quản lý
          </Text>
        </div>

        <form
          className="w-full tm-card"
          style={{ padding: 20, zIndex: 1 }}
          onSubmit={handleLogin}
        >
          {isRegisterIntent ? (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "#fff3ed", border: "1px solid #ffdec7" }}>
              <Text size="small" style={{ color: "#c2410c", fontWeight: 500 }}>
                Vui lòng đăng nhập tài khoản TM Food của bạn để tiếp tục Đăng ký mở quán.
              </Text>
            </div>
          ) : null}
          <Text.Title style={{ fontSize: 18, marginBottom: 16 }}>Đăng nhập</Text.Title>

          <div style={{ display: "grid", gap: 12 }}>
            <input
              type="email"
              placeholder="Email quản lý"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                borderRadius: 10,
                border: "1px solid var(--tm-border)",
                padding: "12px 14px",
              }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--tm-border)",
                  padding: "12px 14px",
                }}
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

            <div style={{ textAlign: "right", marginTop: -4 }}>
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--tm-primary)",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: 0
                }}
              >
                Quên mật khẩu?
              </button>
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
              {submitting ? "Đang xử lý..." : "Đăng nhập"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/register-account")}
              style={{
                border: "none",
                borderRadius: 12,
                padding: "14px",
                fontWeight: 600,
                color: "var(--tm-primary)",
                background: "var(--tm-primary-light)",
                marginTop: 0,
              }}
            >
              Chưa có tài khoản? Tạo mới
            </button>
          </div>
        </form>
      </div>
    </Page>
  );
};

export default LoginPage;
