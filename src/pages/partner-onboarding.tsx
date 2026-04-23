import React, { FC, useEffect, useMemo, useState } from "react";
import { Page, Text, useNavigate, useSnackbar } from "zmp-ui";
import { useLocation } from "react-router";
import { getUserInfo } from "zmp-sdk";
import {
  loginWithCredentials,
  requestEmailOtp,
  registerCustomerAccount,
  submitDriverApplication,
} from "services/api";
import { validateImageForSubmission } from "utils/image-quality";

type AuthMode = "login" | "register_customer" | "partner";
type PartnerRole = "DRIVER" | "STORE_MANAGER";
type DriverImageKey = "portrait" | "idCard" | "driverLicense";

interface DriverImageValue {
  dataUrl: string;
  qualityScore: number;
  fileName: string;
  error: string;
}

const emptyDriverImageValue: DriverImageValue = {
  dataUrl: "",
  qualityScore: 0,
  fileName: "",
  error: "",
};

function parseModeFromSearch(search: string): AuthMode {
  const mode = new URLSearchParams(search).get("mode");
  if (mode === "register_customer" || mode === "partner" || mode === "login") {
    return mode;
  }
  return "login";
}

function parsePartnerRoleFromSearch(search: string): PartnerRole {
  const role = new URLSearchParams(search).get("role");
  if (role === "STORE_MANAGER" || role === "DRIVER") {
    return role;
  }
  return "DRIVER";
}

function parseRequiredFromSearch(search: string): boolean {
  return new URLSearchParams(search).get("required") === "1";
}

const PartnerOnboardingPage: FC = () => {
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

  const [partnerRole, setPartnerRole] = useState<PartnerRole>(
    () => parsePartnerRoleFromSearch(location.search),
  );
  const [driverFullName, setDriverFullName] = useState("");
  const [driverDob, setDriverDob] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverPassword, setDriverPassword] = useState("");
  const [driverVehicleType, setDriverVehicleType] = useState("Xe máy");
  const [driverLicensePlate, setDriverLicensePlate] = useState("");
  const [driverSubmitting, setDriverSubmitting] = useState(false);

  const [driverImages, setDriverImages] = useState<Record<DriverImageKey, DriverImageValue>>({
    portrait: emptyDriverImageValue,
    idCard: emptyDriverImageValue,
    driverLicense: emptyDriverImageValue,
  });

  useEffect(() => {
    const required = parseRequiredFromSearch(location.search);
    setRequireRegistration(required);
    const session = localStorage.getItem("zaui_food_session");
    setIsLoggedIn(!!session);
    
    if (session && parseModeFromSearch(location.search) !== "partner") {
      setMode("partner");
    } else {
      setMode(required ? "register_customer" : parseModeFromSearch(location.search));
    }
    setPartnerRole(parsePartnerRoleFromSearch(location.search));
  }, [location.search]);

  useEffect(() => {
    let active = true;

    getUserInfo({ autoRequestPermission: true })
      .then((result) => {
        if (!active) return;
        const zaloName = result.userInfo?.name?.trim() || "";
        if (zaloName) {
          setCustomerName((prev) => (prev.trim() ? prev : zaloName));
          setDriverFullName((prev) => (prev.trim() ? prev : zaloName));
        }
      })
      .catch(() => {
        // Ignore permission errors and continue manual input flow.
      });

    return () => {
      active = false;
    };
  }, []);

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

  const driverImageFields = useMemo(
    () => [
      {
        key: "portrait" as const,
        label: "Ảnh chân dung",
        helper: "Chụp rõ mặt, đủ sáng, không đeo kính tối.",
      },
      {
        key: "idCard" as const,
        label: "Ảnh CCCD",
        helper: "Chụp thẳng mặt trước CCCD, không lóa, không mất góc.",
      },
      {
        key: "driverLicense" as const,
        label: "Ảnh bằng lái xe",
        helper: "Chụp rõ thông tin, còn hạn và không bị mờ.",
      },
    ],
    [],
  );

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
      openSuccess(`Đăng nhập thành công (${user.role})`);
      navigate("/profile");
    } catch (error) {
      openError(error instanceof Error ? error.message : "Đăng nhập thất bại");
    } finally {
      setLoginSubmitting(false);
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
      openSuccess(`Đăng ký khách hàng thành công (${user.role})`);
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

  const handleDriverImageChange = async (
    imageKey: DriverImageKey,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setDriverImages((prev) => ({
      ...prev,
      [imageKey]: {
        ...prev[imageKey],
        error: "Đang kiểm tra chất lượng ảnh...",
      },
    }));

    const result = await validateImageForSubmission(file, {
      minQualityScore: 110,
    });

    if (!result.ok) {
      setDriverImages((prev) => ({
        ...prev,
        [imageKey]: {
          dataUrl: "",
          qualityScore: 0,
          fileName: file.name,
          error: result.error,
        },
      }));
      return;
    }

    setDriverImages((prev) => ({
      ...prev,
      [imageKey]: {
        dataUrl: result.dataUrl,
        qualityScore: result.qualityScore,
        fileName: file.name,
        error: "",
      },
    }));
  };

  const validateDriverForm = () => {
    if (!driverFullName.trim()) return "Vui lòng nhập họ tên";
    if (!driverDob) return "Vui lòng chọn ngày tháng năm sinh";
    if (!driverEmail.trim()) return "Vui lòng nhập email";
    if (!driverPassword.trim()) return "Vui lòng nhập mật khẩu";
    if (driverPassword.trim().length < 8) return "Mật khẩu phải có ít nhất 8 ký tự";
    if (!driverVehicleType.trim()) return "Vui lòng nhập loại phương tiện";
    if (!driverLicensePlate.trim()) return "Vui lòng nhập biển số xe";

    for (const field of driverImageFields) {
      const value = driverImages[field.key];
      if (!value.dataUrl) {
        return `Vui lòng tải ${field.label.toLowerCase()}`;
      }
      if (value.error) {
        return `Ảnh ${field.label.toLowerCase()} chưa đạt yêu cầu: ${value.error}`;
      }
    }

    return null;
  };

  const handlePartnerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (partnerRole === "STORE_MANAGER") {
      openError("Luồng đăng ký cửa hàng sẽ được bổ sung sau. Hiện tại đang triển khai tài xế trước.");
      return;
    }

    const validationError = validateDriverForm();
    if (validationError) {
      openError(validationError);
      return;
    }

    setDriverSubmitting(true);

    try {
      const response = await submitDriverApplication({
        fullName: driverFullName.trim(),
        dateOfBirth: driverDob,
        email: driverEmail.trim(),
        password: driverPassword,
        phone: driverPhone.trim() || undefined,
        vehicleType: driverVehicleType.trim(),
        licensePlate: driverLicensePlate.trim().toUpperCase(),
        portraitImageData: driverImages.portrait.dataUrl,
        idCardImageData: driverImages.idCard.dataUrl,
        driverLicenseImageData: driverImages.driverLicense.dataUrl,
        portraitQualityScore: driverImages.portrait.qualityScore,
        idCardQualityScore: driverImages.idCard.qualityScore,
        driverLicenseQualityScore: driverImages.driverLicense.qualityScore,
      });

      openSuccess(response.message || "Đã gửi hồ sơ tài xế, vui lòng chờ admin xét duyệt");
      setMode("login");
      setDriverFullName("");
      setDriverDob("");
      setDriverEmail("");
      setDriverPhone("");
      setDriverPassword("");
      setDriverVehicleType("Xe máy");
      setDriverLicensePlate("");
      setDriverImages({
        portrait: emptyDriverImageValue,
        idCard: emptyDriverImageValue,
        driverLicense: emptyDriverImageValue,
      });
    } catch (error) {
      openError(error instanceof Error ? error.message : "Không thể gửi hồ sơ tài xế");
    } finally {
      setDriverSubmitting(false);
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
          Đăng nhập & Trở thành đối tác
        </Text.Title>
        <Text size="xSmall" style={{ color: "rgba(255,255,255,0.85)", marginTop: 6 }}>
          Miniapp hỗ trợ khách hàng đăng ký trực tiếp và tài xế nộp hồ sơ xét duyệt.
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
              { key: "register_customer", label: "Đăng ký khách hàng" },
            ]),
            { key: "partner", label: "Trở thành đối tác" },
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
            <Text.Title style={{ fontSize: 18 }}>Đăng nhập mọi vai trò</Text.Title>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 12 }}>
              Dùng chung cho Khách hàng, Tài xế, Cửa hàng (đã có tài khoản).
            </Text>

            <div style={{ display: "grid", gap: 10 }}>
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
              />
              <input
                type="password"
                placeholder="Mật khẩu"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
              />
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
              <input
                type="text"
                placeholder="Họ tên"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
              />
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

        {mode === "partner" && (
          <form className="tm-card" style={{ padding: 16 }} onSubmit={handlePartnerSubmit}>
            <Text.Title style={{ fontSize: 18 }}>Trở thành đối tác</Text.Title>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 12 }}>
              Chọn vai trò đối tác. Hiện tại đang triển khai hoàn chỉnh cho tài xế.
            </Text>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setPartnerRole("DRIVER")}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 8px",
                  fontWeight: 700,
                  background: partnerRole === "DRIVER" ? "var(--tm-primary)" : "#edf4f1",
                  color: partnerRole === "DRIVER" ? "#fff" : "var(--tm-text-secondary)",
                }}
              >
                Tài xế
              </button>
              <button
                type="button"
                onClick={() => setPartnerRole("STORE_MANAGER")}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 8px",
                  fontWeight: 700,
                  background: partnerRole === "STORE_MANAGER" ? "var(--tm-primary)" : "#edf4f1",
                  color: partnerRole === "STORE_MANAGER" ? "#fff" : "var(--tm-text-secondary)",
                }}
              >
                Cửa hàng
              </button>
            </div>

            {partnerRole === "STORE_MANAGER" ? (
              <div
                style={{
                  borderRadius: 12,
                  border: "1px dashed var(--tm-border)",
                  padding: 14,
                  background: "#f7faf8",
                  color: "var(--tm-text-secondary)",
                }}
              >
                <div style={{ marginBottom: 12 }}>Đăng ký trở thành đối tác Cửa hàng/Quán ăn để tiếp cận hàng ngàn khách hàng.</div>
                <button
                  type="button"
                  onClick={() => navigate("/register-store")}
                  style={{
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 16px",
                    fontWeight: 700,
                    color: "#fff",
                    background: "var(--tm-primary)",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Đăng ký mở Cửa hàng ngay
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Họ tên"
                  value={driverFullName}
                  onChange={(e) => setDriverFullName(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                />
                <input
                  type="date"
                  placeholder="Ngày tháng năm sinh"
                  value={driverDob}
                  onChange={(e) => setDriverDob(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                />
                <input
                  type="email"
                  placeholder="Email đăng nhập"
                  value={driverEmail}
                  onChange={(e) => setDriverEmail(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                />
                <input
                  type="tel"
                  placeholder="Số điện thoại"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                />
                <input
                  type="password"
                  placeholder="Mật khẩu (>= 8 ký tự)"
                  value={driverPassword}
                  onChange={(e) => setDriverPassword(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                />
                <input
                  type="text"
                  placeholder="Loại xe (ví dụ: Xe máy)"
                  value={driverVehicleType}
                  onChange={(e) => setDriverVehicleType(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                />
                <input
                  type="text"
                  placeholder="Biển số xe"
                  value={driverLicensePlate}
                  onChange={(e) => setDriverLicensePlate(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
                />

                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid var(--tm-border)",
                    padding: 12,
                    background: "#fafdfb",
                  }}
                >
                  <Text style={{ fontWeight: 700, marginBottom: 6 }}>Tải ảnh hồ sơ (tự kiểm tra ảnh mờ)</Text>
                  <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
                    {driverImageFields.map((field) => {
                      const current = driverImages[field.key];
                      return (
                        <div key={field.key} style={{ borderTop: "1px dashed var(--tm-border)", paddingTop: 10 }}>
                          <Text style={{ fontWeight: 600 }}>{field.label}</Text>
                          <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 8 }}>
                            {field.helper}
                          </Text>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            onChange={(event) => handleDriverImageChange(field.key, event)}
                            style={{ width: "100%" }}
                          />

                          {current.fileName ? (
                            <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 6 }}>
                              {current.fileName}
                            </Text>
                          ) : null}

                          {current.dataUrl ? (
                            <img
                              src={current.dataUrl}
                              alt={field.label}
                              style={{
                                marginTop: 8,
                                width: "100%",
                                maxHeight: 160,
                                objectFit: "cover",
                                borderRadius: 10,
                                border: "1px solid var(--tm-border)",
                              }}
                            />
                          ) : null}

                          {current.qualityScore > 0 ? (
                            <Text
                              size="xxxSmall"
                              style={{
                                marginTop: 6,
                                color:
                                  current.qualityScore >= 110
                                    ? "var(--tm-primary)"
                                    : "var(--tm-danger)",
                              }}
                            >
                              Điểm nét: {current.qualityScore.toFixed(1)}
                            </Text>
                          ) : null}

                          {current.error ? (
                            <Text
                              size="xxxSmall"
                              style={{
                                marginTop: 6,
                                color:
                                  current.error === "Đang kiểm tra chất lượng ảnh..."
                                    ? "var(--tm-text-secondary)"
                                    : "var(--tm-danger)",
                              }}
                            >
                              {current.error}
                            </Text>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={driverSubmitting}
                  style={{
                    border: "none",
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontWeight: 700,
                    color: "#fff",
                    background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                    cursor: "pointer",
                    opacity: driverSubmitting ? 0.7 : 1,
                  }}
                >
                  {driverSubmitting ? "Đang gửi hồ sơ..." : "Gửi hồ sơ tài xế"}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </Page>
  );
};

export default PartnerOnboardingPage;
