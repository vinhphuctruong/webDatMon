import React from "react";
import { Page, Box, Text, Icon } from "zmp-ui";

const WalletPage = () => {
  return (
    <Page className="page-with-bg pb-20">
      <Box className="tm-page-topbar tm-page-safe-top">
        <div className="tm-page-topbar-title">
          <Text.Title style={{ marginBottom: 0 }}>Ví Cửa Hàng</Text.Title>
        </div>
      </Box>

      <Box p={4} className="tm-content-pad">
        <div 
          className="tm-card" 
          style={{ 
            padding: 20, 
            background: "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
            color: "#fff"
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.8)" }}>Số dư khả dụng</Text>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Text.Title style={{ fontSize: 32, color: "#fff" }}>0đ</Text.Title>
          </div>
          
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button 
              style={{ 
                flex: 1, padding: "10px", borderRadius: 8, 
                background: "#fff", color: "var(--tm-primary)", 
                fontWeight: 600, border: "none",
                display: "flex", justifyContent: "center", alignItems: "center", gap: 6
              }}
            >
              <Icon icon="zi-download" size={18} />
              Rút tiền
            </button>
            <button 
              style={{ 
                flex: 1, padding: "10px", borderRadius: 8, 
                background: "rgba(255,255,255,0.2)", color: "#fff", 
                fontWeight: 600, border: "none",
                display: "flex", justifyContent: "center", alignItems: "center", gap: 6
              }}
            >
              <Icon icon="zi-clock-1" size={18} />
              Lịch sử
            </button>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <Text.Title style={{ fontSize: 16, marginBottom: 12 }}>Giao dịch gần đây</Text.Title>
          <div className="tm-card" style={{ padding: 20, textAlign: "center", background: "#fff" }}>
            <Text style={{ color: "var(--tm-text-secondary)" }}>Chưa có giao dịch nào.</Text>
          </div>
        </div>
      </Box>
    </Page>
  );
};

export default WalletPage;
