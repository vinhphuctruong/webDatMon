import React, { FC, useEffect, useState } from "react";
import { Box, Page, Text, Header, Input, Button, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { fetchMyProfile, updateMyProfile, changeMyPassword, clearApiSession, hasSession } from "services/api";
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
    if (!hasSession()) {
      navigate("/login", { replace: true });
      return;
    }
    Promise.all([fetchMyProfile(), fetchDriverProfile()])
      .then(([userRes, driverRes]) => {
        setUser(userRes);
        setDriver(driverRes.data);
        setEditForm({ name: userRes.name, phone: userRes.phone || "" });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateMyProfile(editForm);
      setUser({ ...user, ...editForm });
      setEditing(false);
      snackbar.openSnackbar({ type: "success", text: "Cập nhật thành công" });
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message });
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
      snackbar.openSnackbar({ type: "error", text: error.message });
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
        <Header title="Tài khoản" showBackIcon />
        <Box className="flex items-center justify-center" style={{ padding: 48 }}>
          <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
        </Box>
      </Page>
    );
  }

  return (
    <Page className="page-with-bg">
      <Header title="Tài khoản" />
      <Box style={{ padding: 16 }}>
        {/* Profile Header */}
        <div className="tm-card animate-slide-up" style={{ padding: 20, textAlign: "center", marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px", fontSize: 28, color: "#fff",
          }}>
            🚗
          </div>
          <Text style={{ fontWeight: 700, fontSize: 18 }}>{user?.name}</Text>
          <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>{user?.email}</Text>
          {driver && (
            <Text size="xxSmall" style={{ color: "var(--tm-text-tertiary)", marginTop: 4 }}>
              {driver.vehicleType} · {driver.licensePlate}
            </Text>
          )}
        </div>

        {/* Edit Info */}
        <div className="tm-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontWeight: 700, fontSize: 15 }}>Thông tin cá nhân</Text>
            <Text
              size="xSmall"
              style={{ color: "var(--tm-primary)", cursor: "pointer", fontWeight: 600 }}
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Huỷ" : "Sửa"}
            </Text>
          </div>
          {editing ? (
            <div style={{ display: "grid", gap: 12 }}>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Họ tên" />
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Số điện thoại" />
              <Button fullWidth loading={savingProfile} onClick={handleSaveProfile}>Lưu</Button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Họ tên</Text>
                <Text size="xSmall" style={{ fontWeight: 600 }}>{user?.name}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>SĐT</Text>
                <Text size="xSmall" style={{ fontWeight: 600 }}>{user?.phone || "Chưa cập nhật"}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Email</Text>
                <Text size="xSmall" style={{ fontWeight: 600 }}>{user?.email}</Text>
              </div>
            </div>
          )}
        </div>

        {/* Change Password */}
        <div className="tm-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontWeight: 700, fontSize: 15 }}>Bảo mật</Text>
            <Text
              size="xSmall"
              style={{ color: "var(--tm-primary)", cursor: "pointer", fontWeight: 600 }}
              onClick={() => setShowPasswordForm(!showPasswordForm)}
            >
              {showPasswordForm ? "Huỷ" : "Đổi mật khẩu"}
            </Text>
          </div>
          {showPasswordForm && (
            <div style={{ display: "grid", gap: 12 }}>
              <Input type="password" placeholder="Mật khẩu hiện tại" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} />
              <Input type="password" placeholder="Mật khẩu mới" value={passwordForm.newPw} onChange={(e) => setPasswordForm({ ...passwordForm, newPw: e.target.value })} />
              <Button fullWidth loading={savingPassword} onClick={handleChangePassword}>Xác nhận</Button>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: "100%", padding: 14, borderRadius: 12,
            background: "#fef2f2", color: "var(--tm-danger)",
            fontWeight: 600, border: "none", fontSize: 15, cursor: "pointer",
          }}
        >
          Đăng xuất
        </button>
      </Box>
    </Page>
  );
};

export default ProfilePage;
