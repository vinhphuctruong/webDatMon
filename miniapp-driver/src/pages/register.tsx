import React, { FC, useState, useRef } from "react";
import { Box, Page, Text, Input, Button, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { apiFetch, requestEmailOtp } from "services/api";

// ── Image Upload Component ──────────────────────────
interface ImageUploadProps {
  label: string;
  icon: string;
  hint: string;
  value: string;
  onChange: (dataUrl: string) => void;
}

const ImageUpload: FC<ImageUploadProps> = ({ label, icon, hint, value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <Text style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{icon} {label}</Text>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: value ? "2px solid var(--tm-primary)" : "2px dashed var(--tm-border)",
          borderRadius: 12,
          padding: value ? 0 : 20,
          textAlign: "center",
          cursor: "pointer",
          background: value ? "transparent" : "var(--tm-bg)",
          overflow: "hidden",
          position: "relative",
          transition: "all 0.2s",
        }}
      >
        {value ? (
          <div style={{ position: "relative" }}>
            <img
              src={value}
              alt={label}
              style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block" }}
            />
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "rgba(0,0,0,0.5)", padding: "6px 0",
              color: "#fff", fontSize: 11, fontWeight: 600, textAlign: "center",
            }}>
               Đã tải lên · Bấm để thay đổi
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 4 }}></div>
            <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)" }}>{hint}</Text>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />
    </div>
  );
};

// ── Register Page ───────────────────────────────────
const RegisterPage: FC = () => {
  const [step, setStep] = useState<"info" | "images" | "otp" | "done">("info");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    dateOfBirth: "",
    vehicleType: "",
    licensePlate: "",
  });
  const [images, setImages] = useState({
    portraitImageData: "",
    idCardImageData: "",
    driverLicenseImageData: "",
    licensePlateImageData: "",
  });
  const [loading, setLoading] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const snackbar = useSnackbar();
  const navigate = useNavigate();

  const update = (key: string, value: string) => setForm({ ...form, [key]: value });
  const updateImage = (key: string, value: string) => setImages({ ...images, [key]: value });

  const validateInfo = () => {
    if (!form.fullName || !form.email || !form.password || !form.phone || !form.dateOfBirth || !form.vehicleType || !form.licensePlate) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng điền đầy đủ thông tin" });
      return false;
    }
    if (form.password.length < 8) {
      snackbar.openSnackbar({ type: "error", text: "Mật khẩu tối thiểu 8 ký tự" });
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (!validateInfo()) return;
    setStep("images");
  };

  const handleGoToOtp = async () => {
    if (!images.portraitImageData || !images.idCardImageData || !images.driverLicenseImageData) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng tải lên đầy đủ ảnh CCCD, bằng lái xe và ảnh chân dung" });
      return;
    }
    setLoading(true);
    try {
      const res = await requestEmailOtp(form.email);
      if (res.debugOtp) setDebugOtp(res.debugOtp);
      snackbar.openSnackbar({ type: "success", text: "Đã gửi mã OTP tới email" });
      setStep("otp");
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Gửi OTP thất bại" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!otpCode || otpCode.length !== 6) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập mã OTP 6 số" });
      return;
    }

    setLoading(true);
    try {
      // Verify OTP first
      await apiFetch("/auth/email-otp/verify-any", {
        method: "POST",
        body: JSON.stringify({ email: form.email, otpCode }),
      });

      const res = await apiFetch<{ data: { id: string; status: string }; message: string }>(
        "/auth/partner/driver-application",
        {
          method: "POST",
          body: JSON.stringify({
            fullName: form.fullName,
            email: form.email,
            password: form.password,
            phone: form.phone,
            dateOfBirth: (() => {
              const parts = form.dateOfBirth.split("/");
              if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
              return form.dateOfBirth;
            })(),
            vehicleType: form.vehicleType,
            licensePlate: form.licensePlate,
            portraitImageData: images.portraitImageData,
            idCardImageData: images.idCardImageData,
            driverLicenseImageData: images.driverLicenseImageData,
            // Quality scores - calculated from image data size
            portraitQualityScore: Math.max(120, images.portraitImageData.length / 100),
            idCardQualityScore: Math.max(120, images.idCardImageData.length / 100),
            driverLicenseQualityScore: Math.max(120, images.driverLicenseImageData.length / 100),
          }),
        },
      );
      setApplicationId(res.data.id);
      setStep("done");
      snackbar.openSnackbar({ type: "success", text: "Nộp đơn thành công! " });
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Nộp đơn thất bại" });
    } finally {
      setLoading(false);
    }
  };

  const uploadedCount = [
    images.portraitImageData,
    images.idCardImageData,
    images.driverLicenseImageData,
  ].filter(Boolean).length;

  return (
    <Page className="page-with-bg pb-20">
      <Box
        p={4}
        className="tm-content-pad tm-page-safe-top"
        style={{
          background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
          paddingBottom: 42,
        }}
      >
        <button
          onClick={() => {
            if (step === "otp") setStep("images");
            else if (step === "images") setStep("info");
            else if (step === "done") navigate("/login");
            else navigate("/login");
          }}
          style={{ border: "none", background: "transparent", color: "#fff", fontWeight: 700, marginBottom: 8 }}
        >
          ← {step === "done" ? "Về đăng nhập" : "Quay lại"}
        </button>
        <Text.Title style={{ color: "#fff", fontSize: 22 }}>
          {step === "info" && "Đăng ký Tài xế"}
          {step === "images" && "Tải ảnh xác minh"}
          {step === "otp" && "Xác nhận Email"}
          {step === "done" && "Đã nộp đơn!"}
        </Text.Title>
        {step !== "done" ? (
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 3, background: "rgba(255,255,255,0.95)" }} />
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 3,
                background:
                  step === "images" || step === "otp" ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)",
              }}
            />
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 3,
                background: step === "otp" ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)",
              }}
            />
          </div>
        ) : null}
      </Box>

      <Box p={4} className="tm-content-pad" style={{ marginTop: -24 }}>

        {/* Step 1: Info */}
        {step === "info" && (
          <div className="tm-card animate-slide-up" style={{ padding: 20 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <Text style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Họ tên</Text>
                <Input placeholder="Nguyễn Văn A" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
              </div>
              <div>
                <Text style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Ngày sinh</Text>
                <Input
                  placeholder="VD: 5/11/2004"
                  value={form.dateOfBirth}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // Only allow digits and "/"
                    let v = raw.replace(/[^\d/]/g, "");
                    // Prevent double slashes
                    v = v.replace(/\/{2,}/g, "/");
                    // Max length dd/mm/yyyy = 10 chars
                    if (v.length <= 10) update("dateOfBirth", v);
                  }}
                />
                <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)", marginTop: 2 }}>
                  Nhập ngày/tháng/năm — VD: 5/11/2004 hoặc 05/11/2004
                </Text>
              </div>
              <div>
                <Text style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Email</Text>
                <Input placeholder="email@gmail.com" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div>
                <Text style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Mật khẩu</Text>
                <Input type="password" placeholder="Tối thiểu 8 ký tự" value={form.password} onChange={(e) => update("password", e.target.value)} />
              </div>
              <div>
                <Text style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Số điện thoại</Text>
                <Input placeholder="0901234567" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div>
                <Text style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Loại xe</Text>
                <Input placeholder="VD: Xe máy, Ô tô" value={form.vehicleType} onChange={(e) => update("vehicleType", e.target.value)} />
              </div>
              <div>
                <Text style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Biển số xe</Text>
                <Input placeholder="VD: 59A1-12345" value={form.licensePlate} onChange={(e) => update("licensePlate", e.target.value)} />
              </div>
              <Button fullWidth onClick={handleNextStep} style={{ marginTop: 8 }}>
                Tiếp tục → Tải ảnh xác minh
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Images */}
        {step === "images" && (
          <div className="animate-slide-up">
            {/* Info banner */}
            <div style={{
              background: "var(--tm-primary-light)", borderRadius: 12,
              padding: 12, marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 18 }}>ℹ</span>
              <Text size="xxSmall" style={{ color: "var(--tm-primary)", lineHeight: "18px" }}>
                Vui lòng chụp ảnh rõ nét, đủ sáng. Admin sẽ xét duyệt hồ sơ trong 24h.
              </Text>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <ImageUpload
                label="Ảnh chân dung"
                icon=""
                hint="Chụp rõ khuôn mặt, nhìn thẳng"
                value={images.portraitImageData}
                onChange={(v) => updateImage("portraitImageData", v)}
              />
              <ImageUpload
                label="CCCD / CMND (mặt trước)"
                icon=""
                hint="Chụp rõ thông tin, không bị mờ"
                value={images.idCardImageData}
                onChange={(v) => updateImage("idCardImageData", v)}
              />
              <ImageUpload
                label="Bằng lái xe"
                icon=""
                hint="Chụp rõ mặt trước bằng lái"
                value={images.driverLicenseImageData}
                onChange={(v) => updateImage("driverLicenseImageData", v)}
              />
              <ImageUpload
                label="Biển số xe"
                icon=""
                hint="Chụp rõ biển số trên xe"
                value={images.licensePlateImageData}
                onChange={(v) => updateImage("licensePlateImageData", v)}
              />
            </div>

            <div style={{ marginTop: 20 }}>
              <Button fullWidth loading={loading} onClick={handleGoToOtp}>
                {uploadedCount < 3
                  ? `Cần tải thêm ${3 - uploadedCount} ảnh bắt buộc`
                  : "Tiếp tục → Xác nhận Email"
                }
              </Button>
              <Text size="xxxSmall" style={{ textAlign: "center", color: "var(--tm-text-tertiary)", marginTop: 8 }}>
                * Ảnh CCCD, bằng lái, chân dung là bắt buộc. Ảnh biển số xe là tuỳ chọn.
              </Text>
            </div>
          </div>
        )}

        {/* Step 3: OTP */}
        {step === "otp" && (
          <div className="tm-card animate-slide-up" style={{ padding: 24 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}></div>
              <Text style={{ fontWeight: 600, fontSize: 15 }}>Xác nhận email của bạn</Text>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 4 }}>
                Mã OTP đã gửi tới <strong>{form.email}</strong>
              </Text>
            </div>

            {debugOtp && (
              <div style={{ background: "#fef9e7", padding: 10, borderRadius: 8, textAlign: "center", marginBottom: 16 }}>
                <Text size="xSmall" style={{ color: "var(--tm-warning)" }}>
                  Mã OTP (Debug): <strong>{debugOtp}</strong>
                </Text>
              </div>
            )}

            <div style={{ display: "grid", gap: 16 }}>
              <Input
                placeholder="Nhập mã OTP 6 số"
                value={otpCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpCode(v);
                }}
              />
              <Button fullWidth loading={loading} onClick={handleSubmit}>
                Xác nhận & Nộp đơn
              </Button>
              <Text
                size="xSmall"
                style={{ textAlign: "center", color: "var(--tm-primary)", cursor: "pointer", fontWeight: 500 }}
                onClick={async () => {
                  try {
                    const res = await requestEmailOtp(form.email);
                    if (res.debugOtp) setDebugOtp(res.debugOtp);
                    snackbar.openSnackbar({ type: "success", text: "Đã gửi lại mã OTP" });
                  } catch (e: any) {
                    snackbar.openSnackbar({ type: "error", text: e.message });
                  }
                }}
              >
                Gửi lại mã OTP
              </Text>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="tm-card animate-slide-up" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}></div>
            <Text.Title style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Nộp đơn thành công!
            </Text.Title>
            <Text size="small" style={{ color: "var(--tm-text-secondary)", lineHeight: "22px", marginBottom: 24 }}>
              Hồ sơ của bạn đang được Admin xét duyệt. Bạn sẽ nhận thông báo khi được duyệt.
            </Text>

            <div style={{
              background: "var(--tm-bg)", borderRadius: 12, padding: 16, marginBottom: 24,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Mã đơn</Text>
                <Text size="xSmall" style={{ fontWeight: 600 }}>#{applicationId.slice(0, 8)}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Trạng thái</Text>
                <Text size="xSmall" style={{ fontWeight: 600, color: "var(--tm-warning)" }}>⏳ Chờ duyệt</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Họ tên</Text>
                <Text size="xSmall" style={{ fontWeight: 600 }}>{form.fullName}</Text>
              </div>
            </div>

            <Button fullWidth onClick={() => navigate("/login", { replace: true })}>
              Về trang đăng nhập
            </Button>
          </div>
        )}
      </Box>
    </Page>
  );
};

export default RegisterPage;
