import React, { useEffect, useState } from "react";
import { Page, Box, Text, Icon } from "zmp-ui";
import { useNavigate } from "react-router";
import { fetchMyStoreApplication } from "services/api";

const ApplicationStatusPage = () => {
  const navigate = useNavigate();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyStoreApplication()
      .then(res => setApp(res))
      .catch(() => {
        // If they don't have an application or are not logged in
        navigate("/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <Page className="page-with-bg">
        <Box className="flex-1 flex items-center justify-center">
          <Text>Đang tải...</Text>
        </Box>
      </Page>
    );
  }

    return (
    <Page className="page-with-bg" hideScrollbar>
      <div
        className="w-full h-full flex flex-col items-center justify-center p-6 text-center"
        style={{
          background: "#fff",
          paddingTop: "calc(var(--tm-safe-area-top) + 20px)",
          paddingBottom: "calc(var(--tm-safe-area-bottom) + 20px)",
        }}
      >
        {app?.status === "PENDING" && (
          <>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <Icon icon="zi-clock-1" size={40} style={{ color: "#d97706" }} />
            </div>
            <Text.Title style={{ fontSize: 22, marginBottom: 12 }}>Hồ sơ đang chờ duyệt</Text.Title>
            <Text style={{ color: "var(--tm-text-secondary)", marginBottom: 24, padding: "0 20px" }}>
              Cảm ơn bạn đã đăng ký mở quán. Quản trị viên của chúng tôi đang tiến hành xác minh thông tin. Quá trình này có thể mất từ 1-2 ngày làm việc.
            </Text>
          </>
        )}

        {app?.status === "REJECTED" && (
          <>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <Icon icon="zi-close-circle" size={40} style={{ color: "#ef4444" }} />
            </div>
            <Text.Title style={{ fontSize: 22, marginBottom: 12 }}>Hồ sơ bị từ chối</Text.Title>
            <Text style={{ color: "var(--tm-text-secondary)", marginBottom: 16, padding: "0 20px" }}>
              Rất tiếc, hồ sơ đăng ký của bạn không được chấp thuận vào lúc này.
            </Text>
            {app?.adminNote && (
              <div style={{ background: "#f871711a", padding: 12, borderRadius: 8, color: "#ef4444", marginBottom: 24, fontSize: 14 }}>
                Lý do: {app.adminNote}
              </div>
            )}
            <button 
              onClick={() => navigate("/register")}
              style={{ padding: "12px 24px", background: "var(--tm-primary)", color: "#fff", borderRadius: 8, fontWeight: 600, border: "none" }}
            >
              Cập nhật lại hồ sơ
            </button>
          </>
        )}

        {app?.status === "APPROVED" && (
          <>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <Icon icon="zi-check-circle" size={40} style={{ color: "var(--tm-primary)" }} />
            </div>
            <Text.Title style={{ fontSize: 22, marginBottom: 12 }}>Hồ sơ đã được duyệt</Text.Title>
            <Text style={{ color: "var(--tm-text-secondary)", marginBottom: 24, padding: "0 20px" }}>
              Chúc mừng! Cửa hàng của bạn đã được kích hoạt. Hãy làm mới ứng dụng để bắt đầu sử dụng.
            </Text>
            <button 
              onClick={() => { localStorage.clear(); navigate("/login"); }}
              style={{ padding: "12px 24px", background: "var(--tm-primary)", color: "#fff", borderRadius: 8, fontWeight: 600, border: "none" }}
            >
              Đăng nhập lại
            </button>
          </>
        )}

        <div style={{ marginTop: 40 }}>
          <button 
            onClick={() => { localStorage.removeItem("zaui_food_session"); navigate("/welcome", { replace: true }); }}
            style={{ padding: "10px", color: "var(--tm-text-secondary)", background: "transparent", border: "none", fontWeight: 600 }}
          >
            Quay lại trang chủ
          </button>
        </div>
      </div>
    </Page>
  );
};

export default ApplicationStatusPage;
