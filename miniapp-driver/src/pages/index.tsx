import React, { FC, useEffect, useState, useCallback } from "react";
import { Box, Page, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { hasSession } from "services/api";
import { fetchDriverProfile, toggleOnline, fetchMyOrders } from "services/driver-api";
import { DisplayPrice } from "components/display/price";

const HomePage: FC = () => {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const [profile, setProfile] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [todayStats, setTodayStats] = useState({ earnings: 0, deliveries: 0 });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const profileRes = await fetchDriverProfile();
      setProfile(profileRes.data);
      setIsOnline(profileRes.data.isOnline);

      const ordersRes = await fetchMyOrders();
      const today = new Date().toDateString();
      const todayOrders = (ordersRes.data || []).filter((o: any) =>
        o.status === "DELIVERED" && o.completedAt && new Date(o.completedAt).toDateString() === today
      );
      setTodayStats({
        earnings: todayOrders.reduce((sum: number, o: any) => sum + (o.driverPayout || 0), 0),
        deliveries: todayOrders.length,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasSession()) {
      navigate("/login", { replace: true });
      return;
    }
    loadData();
  }, []);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await toggleOnline(!isOnline);
      setIsOnline(res.data.isOnline);
      snackbar.openSnackbar({
        type: "success",
        text: res.data.isOnline ? "Bạn đã bật nhận đơn! 🟢" : "Bạn đã tắt nhận đơn",
      });
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Lỗi cập nhật trạng thái" });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <Page className="page-with-bg">
        <Box className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
          <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
        </Box>
      </Page>
    );
  }

  return (
    <Page className="page-with-bg">
      {/* Header */}
      <div className="tm-header-gradient">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Xin chào 👋</Text>
            <Text.Title style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginTop: 2 }}>
              {profile?.user?.name || "Tài xế"}
            </Text.Title>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`tm-status-dot ${isOnline ? "tm-status-dot-online" : "tm-status-dot-offline"}`} />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
              {isOnline ? "Online" : "Offline"}
            </Text>
          </div>
        </div>
      </div>

      <Box style={{ padding: 16 }}>
        {/* Online Toggle Card */}
        <div className="tm-card animate-slide-up" style={{ padding: 20, marginBottom: 16, textAlign: "center" }}>
          <Text style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
            {isOnline ? "Bạn đang nhận đơn" : "Bật để bắt đầu nhận đơn"}
          </Text>
          <button
            className={`tm-toggle ${isOnline ? "tm-toggle-on" : "tm-toggle-off"}`}
            onClick={handleToggle}
            disabled={toggling}
            style={{ margin: "0 auto", display: "block", opacity: toggling ? 0.6 : 1 }}
          >
            <div className="tm-toggle-knob" />
          </button>
          <Text size="xxSmall" style={{ color: "var(--tm-text-tertiary)", marginTop: 8 }}>
            {profile?.vehicleType} · {profile?.licensePlate}
          </Text>
        </div>

        {/* Today Stats */}
        <Text style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📊 Hôm nay</Text>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div className="tm-stat-card animate-fade-in">
            <div className="tm-stat-value" style={{ color: "var(--tm-primary)" }}>
              <DisplayPrice>{todayStats.earnings}</DisplayPrice>
            </div>
            <div className="tm-stat-label">Thu nhập</div>
          </div>
          <div className="tm-stat-card animate-fade-in">
            <div className="tm-stat-value">{todayStats.deliveries}</div>
            <div className="tm-stat-label">Đơn đã giao</div>
          </div>
        </div>

        {/* Quick Actions */}
        <Text style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>⚡ Thao tác nhanh</Text>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div
            className="tm-card"
            onClick={() => navigate("/available")}
            style={{ padding: 16, textAlign: "center", cursor: "pointer" }}
          >
            <span style={{ fontSize: 28 }}>📋</span>
            <Text style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>Đơn chờ nhận</Text>
          </div>
          <div
            className="tm-card"
            onClick={() => navigate("/delivering")}
            style={{ padding: 16, textAlign: "center", cursor: "pointer" }}
          >
            <span style={{ fontSize: 28 }}>🚗</span>
            <Text style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>Đang giao</Text>
          </div>
          <div
            className="tm-card"
            onClick={() => navigate("/orders")}
            style={{ padding: 16, textAlign: "center", cursor: "pointer" }}
          >
            <span style={{ fontSize: 28 }}>📦</span>
            <Text style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>Lịch sử đơn</Text>
          </div>
          <div
            className="tm-card"
            onClick={() => navigate("/wallet")}
            style={{ padding: 16, textAlign: "center", cursor: "pointer" }}
          >
            <span style={{ fontSize: 28 }}>💰</span>
            <Text style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>Ví & Thu nhập</Text>
          </div>
        </div>
      </Box>
    </Page>
  );
};

export default HomePage;
