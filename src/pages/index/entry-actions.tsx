import React, { FC } from "react";
import { Box, Text, useNavigate } from "zmp-ui";

export const EntryActions: FC = () => {
  const navigate = useNavigate();

  return (
    <Box className="bg-white" style={{ padding: "12px 16px 0" }}>
      <div
        className="tm-card"
        style={{
          padding: 14,
          display: "grid",
          gap: 10,
          background:
            "linear-gradient(135deg, rgba(0,169,109,0.08) 0%, rgba(0,169,109,0.03) 100%)",
          border: "1px solid rgba(0,169,109,0.15)",
        }}
      >
        <div>
          <Text style={{ fontSize: 15, fontWeight: 700, color: "var(--tm-text-primary)" }}>
            Tài khoản & Đối tác
          </Text>
          <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
            Đăng nhập/đăng ký nhanh hoặc nộp hồ sơ trở thành đối tác tài xế.
          </Text>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            type="button"
            onClick={() => navigate("/partner-onboarding?mode=login")}
            style={{
              border: "1px solid var(--tm-border)",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 700,
              fontSize: 13,
              color: "var(--tm-text-primary)",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            🔐 Đăng ký/Đăng nhập
          </button>

          <button
            type="button"
            onClick={() => navigate("/partner-onboarding?mode=partner&role=DRIVER")}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 700,
              fontSize: 13,
              color: "#fff",
              background:
                "linear-gradient(135deg, var(--tm-primary) 0%, var(--tm-primary-dark) 100%)",
              cursor: "pointer",
            }}
          >
            🤝 Trở thành đối tác
          </button>
        </div>
      </div>
    </Box>
  );
};

