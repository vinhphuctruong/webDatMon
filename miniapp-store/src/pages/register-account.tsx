import React, { useState } from "react";
import { Page, Box, Text, useSnackbar, Header } from "zmp-ui";
import { useNavigate } from "react-router";
import { registerCustomerAccount, requestEmailOtp } from "services/api";

const RegisterAccountPage = () => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    otpCode: "",
  });

  const handleRequestOtp = async () => {
    if (!formData.email) {
      openSnackbar({ text: "Vui lòng nhập Email để nhận mã OTP", type: "error" });
      return;
    }
    setRequestingOtp(true);
    try {
      const res = await requestEmailOtp(formData.email.trim());
      if (res.debugOtp) {
        // In dev environment, pre-fill the OTP for convenience
        setFormData(prev => ({ ...prev, otpCode: res.debugOtp as string }));
        openSnackbar({ text: `Mã OTP thử nghiệm: ${res.debugOtp}`, type: "success" });
      } else {
        openSnackbar({ text: "Đã gửi mã OTP đến email của bạn", type: "success" });
      }
    } catch (error: any) {
      openSnackbar({ text: error.message || "Lỗi gửi OTP", type: "error" });
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.email || !formData.password || !formData.otpCode) {
      openSnackbar({ text: "Vui lòng điền đầy đủ thông tin", type: "error" });
      return;
    }

    if (formData.password.length < 8) {
      openSnackbar({ text: "Mật khẩu phải từ 8 ký tự trở lên", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      await registerCustomerAccount({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        otpCode: formData.otpCode.trim(),
      });
      openSnackbar({ text: "Tạo tài khoản thành công!", type: "success" });
      // Go to store registration form automatically
      navigate("/register", { replace: true });
    } catch (error: any) {
      openSnackbar({ text: error.message || "Lỗi tạo tài khoản", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page className="page-with-bg pb-20">
      <Header title="Tạo tài khoản mới" />

      <Box p={4} className="tm-content-pad">
        <div style={{ marginBottom: 20 }}>
          <Text style={{ color: "var(--tm-text-secondary)" }}>
            Vui lòng đăng ký tài khoản Zaui Food để có thể trở thành đối tác quản lý cửa hàng.
          </Text>
        </div>

        <form className="tm-card" style={{ padding: 16 }} onSubmit={handleRegister}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Họ và tên <span style={{color: "red"}}>*</span></Text>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                placeholder="VD: Nguyễn Văn A"
              />
            </div>

            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Số điện thoại <span style={{color: "red"}}>*</span></Text>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                placeholder="VD: 0912345678"
              />
            </div>

            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Mật khẩu <span style={{color: "red"}}>*</span></Text>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                placeholder="Ít nhất 8 ký tự"
              />
            </div>

            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Email <span style={{color: "red"}}>*</span></Text>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)", minWidth: 0 }}
                  placeholder="name@example.com"
                />
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={requestingOtp || !formData.email}
                  style={{
                    padding: "0 16px",
                    borderRadius: 8,
                    background: "var(--tm-primary-light)",
                    color: "var(--tm-primary)",
                    fontWeight: 600,
                    border: "1px solid var(--tm-primary)",
                    whiteSpace: "nowrap"
                  }}
                >
                  {requestingOtp ? "Đang gửi..." : "Nhận OTP"}
                </button>
              </div>
            </div>

            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Mã OTP <span style={{color: "red"}}>*</span></Text>
              <input
                type="text"
                value={formData.otpCode}
                onChange={(e) => setFormData({ ...formData, otpCode: e.target.value })}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)", letterSpacing: 2, fontWeight: 600 }}
                placeholder="Nhập mã 6 số"
                maxLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: 14,
                borderRadius: 12,
                background: "var(--tm-primary)",
                color: "#fff",
                fontWeight: 600,
                border: "none",
                marginTop: 16,
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? "Đang xử lý..." : "Tạo tài khoản & Tiếp tục"}
            </button>
            
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={{
                padding: 14,
                borderRadius: 12,
                background: "transparent",
                color: "var(--tm-text-secondary)",
                fontWeight: 600,
                border: "none",
                marginTop: 0,
              }}
            >
              Đã có tài khoản? Đăng nhập
            </button>
          </div>
        </form>
      </Box>
    </Page>
  );
};

export default RegisterAccountPage;
