import React, { FC, useState } from "react";
import { Box, Page, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { loginWithCredentials } from "services/api";

const LoginPage: FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const snackbar = useSnackbar();
  const navigate = useNavigate();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập email và mật khẩu" });
      return;
    }

    setLoading(true);
    try {
      const user = await loginWithCredentials({ email: email.trim(), password });
      if (user.role !== "DRIVER") {
        snackbar.openSnackbar({ type: "error", text: "Tài khoản này không phải tài xế" });
        setLoading(false);
        return;
      }
      snackbar.openSnackbar({ type: "success", text: `Xin chào ${user.name}` });
      navigate("/", { replace: true });
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Đăng nhập thất bại" });
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
        <div style={{ textAlign: "center", marginBottom: 30, zIndex: 1 }}>
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
            <span style={{ fontSize: 38 }}>🛵</span>
          </div>
          <Text.Title style={{ color: "#fff", fontSize: 24, fontWeight: 800 }}>TM Food Driver</Text.Title>
          <Text size="small" style={{ color: "rgba(255,255,255,0.84)" }}>
            Ứng dụng dành cho đối tác tài xế
          </Text>
        </div>

        <form className="w-full tm-card" style={{ padding: 20, zIndex: 1 }} onSubmit={handleLogin}>
          <Text.Title style={{ fontSize: 18, marginBottom: 16 }}>Đăng nhập</Text.Title>

          <div style={{ display: "grid", gap: 12 }}>
            <input
              type="email"
              placeholder="driver@tmfood.local"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: "12px 14px" }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mật khẩu"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: "12px 14px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
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

            <button
              type="submit"
              disabled={loading}
              style={{
                border: "none",
                borderRadius: 12,
                padding: "14px",
                fontWeight: 700,
                color: "#fff",
                background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                opacity: loading ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                style={{ border: "none", background: "transparent", color: "var(--tm-primary)", fontWeight: 600 }}
              >
                Quên mật khẩu?
              </button>
              <button
                type="button"
                onClick={() => navigate("/register")}
                style={{ border: "none", background: "transparent", color: "var(--tm-primary)", fontWeight: 600 }}
              >
                Đăng ký tài xế
              </button>
            </div>
          </div>
        </form>
      </div>
    </Page>
  );
};

export default LoginPage;
