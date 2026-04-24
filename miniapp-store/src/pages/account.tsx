import React, { FC, useEffect, useMemo, useState } from "react";
import { Page, Text, useNavigate, useSnackbar } from "zmp-ui";
import { getUserInfo } from "zmp-sdk";
import {
  changeMyPassword,
  clearApiSession,
  fetchMyProfile,
  updateMyProfile,
} from "services/api";
import { validateImageForSubmission } from "utils/image-quality";

const AccountPage: FC = () => {
  const navigate = useNavigate();
  const snackbar = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUploadData, setAvatarUploadData] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarChanged, setAvatarChanged] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const session = localStorage.getItem("zaui_food_session");
    if (!session) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng đăng nhập để xem thông tin" });
      navigate("/login?required=1", { replace: true });
      return;
    }

    let active = true;

    const loadProfile = async () => {
      let backendError: string | null = null;
      const [zaloUser, backendProfile] = await Promise.all([
        getUserInfo({ autoRequestPermission: true })
          .then((result) => result.userInfo)
          .catch(() => null),
        fetchMyProfile().catch((error) => {
          backendError = error instanceof Error ? error.message : "Không tải được thông tin tài khoản";
          return null;
        }),
      ]);

      if (!active) return;

      const zaloName =
        typeof zaloUser?.name === "string" ? zaloUser.name.trim() : "";
      const zaloAvatar =
        typeof zaloUser?.avatar === "string" ? zaloUser.avatar.trim() : "";

      if (backendProfile) {
        setName(zaloName || backendProfile.name || "");
        setEmail(backendProfile.email || "");
        setPhone(backendProfile.phone || "");
        setAvatarUploadData("");
        setAvatarPreview(zaloAvatar || backendProfile.avatarUrl || "");
        setAvatarChanged(false);
      } else {
        setName(zaloName || "");
        setAvatarUploadData("");
        setAvatarPreview(zaloAvatar || "");
        setAvatarChanged(false);

        if (!zaloName && !zaloAvatar && backendError) {
          snackbar.openSnackbar({
            type: "error",
            text: backendError,
          });
        }
      }

      setLoading(false);
    };

    loadProfile().catch((error) => {
      if (!active) return;
      setLoading(false);
      snackbar.openSnackbar({
        type: "error",
        text: error instanceof Error ? error.message : "Không tải được thông tin tài khoản",
      });
    });

    return () => {
      active = false;
    };
  }, []);

  const avatarLabel = useMemo(() => {
    if (avatarError) return avatarError;
    if (!avatarPreview) return "Chưa có ảnh đại diện";
    return "Ảnh đại diện hiện tại";
  }, [avatarPreview, avatarError]);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarError("Đang kiểm tra ảnh...");
    const result = await validateImageForSubmission(file, {
      minQualityScore: 70,
      maxFileSizeBytes: 4 * 1024 * 1024,
    });

    if (!result.ok) {
      setAvatarError(result.error);
      return;
    }

    setAvatarUploadData(result.dataUrl);
    setAvatarPreview(result.dataUrl);
    setAvatarError("");
    setAvatarChanged(true);
  };

  const clearAvatar = () => {
    setAvatarUploadData("");
    setAvatarPreview("");
    setAvatarError("");
    setAvatarChanged(true);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim() || !email.trim()) {
      snackbar.openSnackbar({
        type: "error",
        text: "Tên và email là bắt buộc",
      });
      return;
    }

    setSavingProfile(true);
    try {
      const profilePayload: {
        name: string;
        email: string;
        phone: string | null;
        avatarUrl?: string | null;
      } = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      };

      if (avatarChanged) {
        profilePayload.avatarUrl = avatarUploadData.trim() || null;
      }

      const response = await updateMyProfile(profilePayload);

      const profile = response.data;
      setName(profile.name || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
      setAvatarUploadData("");
      setAvatarPreview(profile.avatarUrl || "");
      setAvatarChanged(false);

      snackbar.openSnackbar({
        type: "success",
        text: response.message || "Đã cập nhật thông tin tài khoản",
      });
    } catch (error) {
      snackbar.openSnackbar({
        type: "error",
        text: error instanceof Error ? error.message : "Cập nhật tài khoản thất bại",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const submitPasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      snackbar.openSnackbar({
        type: "error",
        text: "Vui lòng nhập đủ thông tin mật khẩu",
      });
      return;
    }

    if (newPassword.length < 8) {
      snackbar.openSnackbar({
        type: "error",
        text: "Mật khẩu mới phải có ít nhất 8 ký tự",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      snackbar.openSnackbar({
        type: "error",
        text: "Xác nhận mật khẩu mới không khớp",
      });
      return;
    }

    setChangingPassword(true);
    try {
      const response = await changeMyPassword(currentPassword, newPassword);
      clearApiSession();

      snackbar.openSnackbar({
        type: "success",
        text: response.message || "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      navigate("/partner-onboarding?mode=login");
    } catch (error) {
      snackbar.openSnackbar({
        type: "error",
        text: error instanceof Error ? error.message : "Đổi mật khẩu thất bại",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Page style={{ background: "var(--tm-bg)" }}>
      <div className="tm-header-gradient" style={{ paddingBottom: 16 }}>
        <Text.Title style={{ color: "#fff", fontWeight: 800, fontSize: 20 }}>
          Thông tin tài khoản
        </Text.Title>
        <Text size="xSmall" style={{ color: "rgba(255,255,255,0.86)", marginTop: 4 }}>
          Xem và cập nhật email, số điện thoại, tên, avatar và mật khẩu.
        </Text>
        <Text size="xSmall" style={{ color: "rgba(255,255,255,0.78)", marginTop: 2 }}>
          Khi có quyền Zalo, tên và ảnh đại diện sẽ tự động lấy từ tài khoản Zalo.
        </Text>
      </div>

      <div style={{ padding: 16, display: "grid", gap: 12 }}>
        <form className="tm-card" style={{ padding: 16, display: "grid", gap: 10 }} onSubmit={saveProfile}>
          <Text.Title style={{ fontSize: 17 }}>Hồ sơ cá nhân</Text.Title>

          {loading ? (
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
              Đang tải dữ liệu tài khoản...
            </Text>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  border: "1px solid var(--tm-border)",
                  borderRadius: 12,
                  padding: 10,
                  background: "#fafdfb",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "2px solid var(--tm-border)",
                    background: "#f1f5f3",
                    flexShrink: 0,
                  }}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : null}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xSmall" style={{ color: avatarError ? "var(--tm-danger)" : "var(--tm-text-secondary)" }}>
                    {avatarLabel}
                  </Text>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    style={{ marginTop: 6, width: "100%" }}
                  />
                  {avatarPreview ? (
                    <button
                      type="button"
                      onClick={clearAvatar}
                      style={{
                        marginTop: 8,
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 10px",
                        cursor: "pointer",
                        color: "var(--tm-danger)",
                        background: "#fff1f2",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      Xóa ảnh đại diện
                    </button>
                  ) : null}
                </div>
              </div>

              <input
                type="text"
                placeholder="Họ và tên"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
              />

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
              />

              <input
                type="tel"
                placeholder="Số điện thoại"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
              />

              <button
                type="submit"
                disabled={savingProfile}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 700,
                  color: "#fff",
                  background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
                  cursor: "pointer",
                  opacity: savingProfile ? 0.7 : 1,
                }}
              >
                {savingProfile ? "Đang lưu..." : "Lưu thông tin"}
              </button>
            </>
          )}
        </form>

        <form
          className="tm-card"
          style={{ padding: 16, display: "grid", gap: 10 }}
          onSubmit={submitPasswordChange}
        >
          <Text.Title style={{ fontSize: 17 }}>Đổi mật khẩu</Text.Title>

          <input
            type="password"
            placeholder="Mật khẩu hiện tại"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
          />

          <input
            type="password"
            placeholder="Mật khẩu mới"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
          />

          <input
            type="password"
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--tm-border)", padding: 12 }}
          />

          <button
            type="submit"
            disabled={changingPassword}
            style={{
              border: "1px solid var(--tm-primary)",
              borderRadius: 12,
              padding: "12px 14px",
              fontWeight: 700,
              color: "var(--tm-primary)",
              background: "#fff",
              cursor: "pointer",
              opacity: changingPassword ? 0.7 : 1,
            }}
          >
            {changingPassword ? "Đang cập nhật mật khẩu..." : "Đổi mật khẩu"}
          </button>
        </form>
      </div>
    </Page>
  );
};

export default AccountPage;
