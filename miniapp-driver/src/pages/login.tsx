import React, { FC, useState } from "react";
import { Box, Page, Text, Input, Button, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { loginWithCredentials } from "services/api";

const LoginPage: FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const snackbar = useSnackbar();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập email và mật khẩu" });
      return;
    }

    setLoading(true);
    try {
      const user = await loginWithCredentials({ email: email.trim(), password });
      if (user.role !== "DRIVER") {
        snackbar.openSnackbar({ type: "error", text: "Tài khoản này không phải tài xế" });
        return;
      }
      snackbar.openSnackbar({ type: "success", text: `Xin chào ${user.name}! 🚗` });
      navigate("/", { replace: true });
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Đăng nhập thất bại" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page className="page-with-bg" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Box style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: 24 }}>
        <div className="animate-slide-up" style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🚗</div>
          <Text.Title style={{ fontSize: 28, fontWeight: 800, color: "var(--tm-primary)" }}>
            TM Food Driver
          </Text.Title>
          <Text size="small" style={{ color: "var(--tm-text-secondary)", marginTop: 4 }}>
            Ứng dụng dành cho tài xế giao hàng
          </Text>
        </div>

        <div className="tm-card animate-fade-in" style={{ padding: 24 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <Text style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Email</Text>
              <Input
                type="text"
                placeholder="driver@tmfood.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Text style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Mật khẩu</Text>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              fullWidth
              loading={loading}
              onClick={handleLogin}
              style={{ marginTop: 8 }}
            >
              Đăng nhập
            </Button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <Text
              size="xSmall"
              style={{ color: "var(--tm-primary)", cursor: "pointer", fontWeight: 500 }}
              onClick={() => navigate("/forgot-password")}
            >
              Quên mật khẩu?
            </Text>
            <Text
              size="xSmall"
              style={{ color: "var(--tm-primary)", cursor: "pointer", fontWeight: 500 }}
              onClick={() => navigate("/register")}
            >
              Đăng ký tài xế
            </Text>
          </div>
        </div>
      </Box>
    </Page>
  );
};

export default LoginPage;
