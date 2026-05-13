import React, { FC, useCallback, useEffect, useMemo, useState } from "react";
import { Box, Page, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router";
import { ApiError, clearApiSession } from "services/api";
import { fetchDriverProfile, toggleOnline, fetchMyOrders } from "services/driver-api";
import { DisplayPrice } from "components/display/price";

const HomePage: FC = () => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
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
      const todayOrders = (ordersRes.data || []).filter(
        (o: any) => o.status === "DELIVERED" && o.completedAt && new Date(o.completedAt).toDateString() === today,
      );

      setTodayStats({
        earnings: todayOrders.reduce((sum: number, o: any) => sum + (o.driverPayout || 0), 0),
        deliveries: todayOrders.length,
      });
    } catch (err: any) {
      console.error(err);
      if (err instanceof ApiError) {
        if (err.status === 401) {
          clearApiSession();
          navigate("/login", { replace: true });
          return;
        }
        if (err.status === 403) {
          clearApiSession();
          navigate("/register", { replace: true });
          return;
        }
      }
      openSnackbar({ type: "error", text: err?.message || "Không tải được dữ liệu tài xế" });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      if (!active) return;
      await loadData();
    };
    void bootstrap();
    return () => {
      active = false;
    };
  }, [loadData, navigate]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await toggleOnline(!isOnline);
      setIsOnline(res.data.isOnline);
      openSnackbar({
        type: "success",
        text: res.data.isOnline ? "Bạn đã bật nhận đơn" : "Bạn đã tắt nhận đơn",
      });
    } catch (error: any) {
      openSnackbar({ type: "error", text: error.message || "Lỗi cập nhật trạng thái" });
    } finally {
      setToggling(false);
    }
  };

  const quickActions = useMemo(
    () => [
      { icon: "", label: "Đang giao", path: "/delivering" },
      { icon: "", label: "Lịch sử đơn", path: "/orders" },
      { icon: "", label: "Ví thu nhập", path: "/wallet" },
    ],
    [],
  );

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
    <Page className="page-with-bg pb-20">
      <Box
        p={4}
        className="tm-content-pad tm-page-safe-top"
        style={{
          background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
          paddingBottom: 54,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Xin chào, tài xế</Text>
            <Text.Title style={{ color: "#fff", fontSize: 20 }}>{profile?.user?.name || "TM Driver"}</Text.Title>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.2)",
              padding: "6px 12px",
              borderRadius: 20,
            }}
          >
            <span className={`tm-status-dot ${isOnline ? "tm-status-dot-online" : "tm-status-dot-offline"}`} />
            <Text style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{isOnline ? "ĐANG ONLINE" : "OFFLINE"}</Text>
          </div>
        </div>
      </Box>

      <Box p={4} className="tm-content-pad" style={{ marginTop: -36 }}>
        <div className="tm-card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <Text style={{ fontWeight: 700, fontSize: 16 }}>{isOnline ? "Sẵn sàng nhận đơn" : "Bật nhận đơn"}</Text>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
                {profile?.vehicleType || "Phương tiện"} · {profile?.licensePlate || "Biển số"}
              </Text>
            </div>
            <button
              className={`tm-toggle ${isOnline ? "tm-toggle-on" : "tm-toggle-off"}`}
              onClick={handleToggle}
              disabled={toggling}
              style={{ opacity: toggling ? 0.6 : 1 }}
            >
              <div className="tm-toggle-knob" />
            </button>
          </div>
        </div>

        <div className="tm-card" style={{ padding: 16, marginBottom: 14 }}>
          <Text.Title style={{ fontSize: 16, marginBottom: 12 }}>Hiệu suất hôm nay</Text.Title>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            <div style={{ background: "var(--tm-bg)", borderRadius: 12, padding: 12 }}>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Thu nhập</Text>
              <Text.Title style={{ fontSize: 18, color: "var(--tm-primary)" }}>
                <DisplayPrice>{todayStats.earnings}</DisplayPrice>
              </Text.Title>
            </div>
            <div style={{ background: "var(--tm-bg)", borderRadius: 12, padding: 12 }}>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>Đơn hoàn thành</Text>
              <Text.Title style={{ fontSize: 18 }}>{todayStats.deliveries}</Text.Title>
            </div>
          </div>
        </div>

        <div className="tm-card" style={{ padding: 16 }}>
          <Text.Title style={{ fontSize: 16, marginBottom: 12 }}>Tác vụ nhanh</Text.Title>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {quickActions.map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                style={{
                  border: "1px solid var(--tm-border)",
                  background: "#fff",
                  borderRadius: 12,
                  padding: "12px 8px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>{action.icon}</div>
                <Text size="xSmall" style={{ fontWeight: 600 }}>{action.label}</Text>
              </button>
            ))}
          </div>
        </div>
      </Box>
    </Page>
  );
};

export default HomePage;
