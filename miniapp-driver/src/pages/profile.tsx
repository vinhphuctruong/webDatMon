import React, { FC, useEffect, useState } from "react";
import { Box, Button, Input, Page, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import {
  ApiError,
  fetchMyProfile,
  updateMyProfile,
  changeMyPassword,
  clearApiSession,
} from "services/api";
import { fetchDriverProfile } from "services/driver-api";

const ProfilePage: FC = () => {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const [user, setUser] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", newPw: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      if (!active) return;

      Promise.all([fetchMyProfile(), fetchDriverProfile()])
        .then(([userRes, driverRes]) => {
          if (!active) return;
          setUser(userRes);
          setDriver(driverRes.data);
          setEditForm({ name: userRes.name, phone: userRes.phone || "" });
        })
        .catch((error: any) => {
          if (error instanceof ApiError && error.status === 401) {
            navigate("/login", { replace: true });
            return;
          }
          console.error(error);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateMyProfile(editForm);
      setUser({ ...user, ...editForm });
      setEditing(false);
      snackbar.openSnackbar({ type: "success", text: "Cập nhật thông tin thành công" });
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Không thể cập nhật thông tin" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPw.length < 8) {
      snackbar.openSnackbar({ type: "error", text: "Mật khẩu mới tối thiểu 8 ký tự" });
      return;
    }

    setSavingPassword(true);
    try {
      await changeMyPassword(passwordForm.current, passwordForm.newPw);
      setShowPasswordForm(false);
      setPasswordForm({ current: "", newPw: "" });
      snackbar.openSnackbar({ type: "success", text: "Đổi mật khẩu thành công" });
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Không thể đổi mật khẩu" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    clearApiSession();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <Page className="page-with-bg">
        <Box className="flex items-center justify-center" style={{ padding: 48 }}>
          <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
        </Box>
      </Page>
    );
  }

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
        <Text.Title style={{ color: "#fff", fontSize: 20 }}>Tài khoản tài xế</Text.Title>
        <Text size="xSmall" style={{ color: "rgba(255,255,255,0.82)", marginTop: 4 }}>
          Quản lý hồ sơ, phương tiện và bảo mật đăng nhập
        </Text>
      </Box>

      <Box p={4} className="tm-content-pad" style={{ marginTop: -26 }}>
        <div className="tm-card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                color: "#fff",
              }}
            >
              
            </div>
            <div>
              <Text style={{ fontWeight: 700, fontSize: 17 }}>{user?.name}</Text>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>{user?.email}</Text>
              {driver && (
                <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)", marginTop: 3 }}>
                  {driver.vehicleType} · {driver.licensePlate}
                </Text>
              )}
            </div>
          </div>
        </div>

        <div className="tm-card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ fontWeight: 700, fontSize: 15 }}>Thông tin cá nhân</Text>
            <button
              onClick={() => setEditing(!editing)}
              style={{ border: "none", background: "transparent", color: "var(--tm-primary)", fontWeight: 700 }}
            >
              {editing ? "Huỷ" : "Sửa"}
            </button>
          </div>

          {editing ? (
            <div style={{ display: "grid", gap: 12 }}>
              <Input
                value={editForm.name}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                placeholder="Họ tên"
              />
              <Input
                value={editForm.phone}
                onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
                placeholder="Số điện thoại"
              />
              <Button fullWidth loading={savingProfile} onClick={handleSaveProfile}>
                Lưu thay đổi
              </Button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Họ tên</Text>
                <Text size="xSmall" style={{ fontWeight: 700 }}>{user?.name}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Số điện thoại</Text>
                <Text size="xSmall" style={{ fontWeight: 700 }}>{user?.phone || "Chưa cập nhật"}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Email</Text>
                <Text size="xSmall" style={{ fontWeight: 700 }}>{user?.email}</Text>
              </div>
            </div>
          )}
        </div>

        <div className="tm-card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ fontWeight: 700, fontSize: 15 }}>Bảo mật</Text>
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              style={{ border: "none", background: "transparent", color: "var(--tm-primary)", fontWeight: 700 }}
            >
              {showPasswordForm ? "Huỷ" : "Đổi mật khẩu"}
            </button>
          </div>

          {showPasswordForm ? (
            <div style={{ display: "grid", gap: 12 }}>
              <Input
                type="password"
                placeholder="Mật khẩu hiện tại"
                value={passwordForm.current}
                onChange={(event) => setPasswordForm({ ...passwordForm, current: event.target.value })}
              />
              <Input
                type="password"
                placeholder="Mật khẩu mới"
                value={passwordForm.newPw}
                onChange={(event) => setPasswordForm({ ...passwordForm, newPw: event.target.value })}
              />
              <Button fullWidth loading={savingPassword} onClick={handleChangePassword}>
                Xác nhận đổi mật khẩu
              </Button>
            </div>
          ) : (
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
              Nên đổi mật khẩu định kỳ để bảo vệ tài khoản giao hàng.
            </Text>
          )}
        </div>

        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 12,
            background: "#fff1f2",
            color: "var(--tm-danger)",
            padding: "12px 14px",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Đăng xuất
        </button>
      </Box>
    </Page>
  );
};

export default ProfilePage;
