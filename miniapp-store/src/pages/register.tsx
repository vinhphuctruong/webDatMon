import React, { useState } from "react";
import { Page, Box, Text, useSnackbar, Header } from "zmp-ui";
import { useNavigate } from "react-router";
import { submitStoreApplication } from "services/api";
import { geocodeAddress } from "utils/location";

const RegisterPage = () => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    storeName: "",
    storeAddress: "",
    storePhone: "",
    frontStoreImageData: "",
    businessLicenseImageData: "",
  });

  const handleImageUpload = (field: 'frontStoreImageData' | 'businessLicenseImageData') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (limit to 1MB to avoid 2MB express limit after base64 inflation)
      if (file.size > 1024 * 1024) {
        openSnackbar({ text: "Ảnh quá lớn, vui lòng chọn ảnh < 1MB", type: "error" });
        e.target.value = '';
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.storeName || !formData.storeAddress || !formData.storePhone) {
      openSnackbar({ text: "Vui lòng nhập đầy đủ thông tin bắt buộc", type: "error" });
      return;
    }
    
    if (!formData.frontStoreImageData) {
      openSnackbar({ text: "Vui lòng tải lên hình ảnh mặt tiền", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const resolvedCoordinates = await geocodeAddress(formData.storeAddress.trim());

      await submitStoreApplication({
        storeName: formData.storeName.trim(),
        storeAddress: formData.storeAddress.trim(),
        storePhone: formData.storePhone.trim(),
        frontStoreImageData: formData.frontStoreImageData,
        businessLicenseImageData: formData.businessLicenseImageData,
        storeLatitude: resolvedCoordinates?.lat ?? null,
        storeLongitude: resolvedCoordinates?.lng ?? null,
      });
      openSnackbar({ text: "Gửi hồ sơ thành công!", type: "success" });
      navigate("/application-status");
    } catch (error: any) {
      openSnackbar({ text: error.message || "Lỗi gửi hồ sơ", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    // Clear session to prevent loop and go to welcome page
    localStorage.removeItem("zaui_food_session");
    navigate("/welcome", { replace: true });
  };

  return (
    <Page className="page-with-bg pb-20">
      <Header title="Đăng ký mở quán" onBackClick={handleBack} />

      <Box p={4} className="tm-content-pad">
        <div style={{ marginBottom: 20 }}>
          <Text style={{ color: "var(--tm-text-secondary)" }}>
            Vui lòng cung cấp thông tin cửa hàng để trở thành đối tác của TM Food.
          </Text>
        </div>

        <form className="tm-card" style={{ padding: 16 }} onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Tên quán / Nhà hàng <span style={{color: "red"}}>*</span></Text>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                placeholder="VD: Cà phê Thức"
              />
            </div>

            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Địa chỉ cụ thể <span style={{color: "red"}}>*</span></Text>
              <textarea
                value={formData.storeAddress}
                onChange={(e) => setFormData({ ...formData, storeAddress: e.target.value })}
                rows={3}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                placeholder="Số nhà, Tên đường, Phường/Xã..."
              />
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 6 }}>
                Hệ thống sẽ tự xác định vị trí map từ địa chỉ này.
              </Text>
            </div>

            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Số điện thoại liên hệ <span style={{color: "red"}}>*</span></Text>
              <input
                type="tel"
                value={formData.storePhone}
                onChange={(e) => setFormData({ ...formData, storePhone: e.target.value })}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid var(--tm-border)" }}
                placeholder="VD: 0912345678"
              />
            </div>

            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Hình ảnh mặt tiền quán <span style={{color: "red"}}>*</span></Text>
              {formData.frontStoreImageData && (
                <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', width: '100%', height: 160, border: "1px solid var(--tm-border)" }}>
                  <img src={formData.frontStoreImageData} alt="Mặt tiền quán" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ position: "relative", width: "100%", padding: 12, borderRadius: 8, border: "1px dashed var(--tm-primary)", textAlign: "center", background: "#f1fdf7" }}>
                <Text style={{ color: "var(--tm-primary)", fontWeight: 600 }}>
                  {formData.frontStoreImageData ? "Chọn ảnh khác" : " Tải ảnh lên"}
                </Text>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload('frontStoreImageData')}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                />
              </div>
            </div>

            <div>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Hình ảnh Giấy phép KD (nếu có)</Text>
              {formData.businessLicenseImageData && (
                <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', width: '100%', height: 160, border: "1px solid var(--tm-border)" }}>
                  <img src={formData.businessLicenseImageData} alt="Giấy phép KD" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ position: "relative", width: "100%", padding: 12, borderRadius: 8, border: "1px dashed var(--tm-primary)", textAlign: "center", background: "#f1fdf7" }}>
                <Text style={{ color: "var(--tm-primary)", fontWeight: 600 }}>
                  {formData.businessLicenseImageData ? "Chọn ảnh khác" : " Tải ảnh lên"}
                </Text>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload('businessLicenseImageData')}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                />
              </div>
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
              {submitting ? "Đang gửi..." : "Gửi hồ sơ đăng ký"}
            </button>
          </div>
        </form>
      </Box>
    </Page>
  );
};

export default RegisterPage;
