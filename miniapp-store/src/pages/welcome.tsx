import React, { useEffect } from "react";
import { Page, Box, Text } from "zmp-ui";
import { useNavigate } from "react-router";

const WelcomePage = () => {
  const navigate = useNavigate();

  // Removed auto-redirect to "/" here because if a CUSTOMER is kicked from "/" to "/welcome" due to 403,
  // this would bounce them back to "/" causing an infinite loop.
  // The app starts at "/" by default anyway.

  return (
    <Page className="page-with-bg" hideScrollbar>
      <div
        className="w-full h-full flex flex-col items-center justify-center relative p-6"
        style={{
          background: "linear-gradient(135deg, #006b45 0%, #00a96d 100%)",
          paddingTop: "calc(var(--tm-safe-area-top) + 20px)",
          paddingBottom: "calc(var(--tm-safe-area-bottom) + 24px)",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1, width: "100%" }}>
          <div
            style={{
              width: 100,
              height: 100,
              background: "#fff",
              borderRadius: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
            }}
          >
            <span style={{ fontSize: 50 }}></span>
          </div>
          <Text.Title style={{ color: "#fff", fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>
            TM Food Quán
          </Text.Title>
          <Text style={{ color: "rgba(255,255,255,0.9)", textAlign: "center", fontSize: 15, padding: "0 20px" }}>
            Nền tảng quản lý cửa hàng và tiếp nhận đơn hàng thông minh dành cho Đối tác.
          </Text>
        </div>

        <div style={{ width: "100%", zIndex: 1, display: "flex", flexDirection: "column", gap: 16, paddingBottom: 40 }}>
          <button
            onClick={() => navigate("/login")}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 16,
              background: "#fff",
              color: "var(--tm-primary)",
              fontWeight: 700,
              fontSize: 16,
              border: "none",
              boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
            }}
          >
            Đăng nhập
          </button>
          
          <button
            onClick={() => navigate("/login?intent=register")}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              border: "1px solid rgba(255,255,255,0.3)",
              backdropFilter: "blur(10px)",
            }}
          >
            Đăng ký mở quán
          </button>
        </div>
      </div>
    </Page>
  );
};

export default WelcomePage;
