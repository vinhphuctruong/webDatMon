import React, { FC, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Box, Text } from "zmp-ui";

export const EntryActions: FC = () => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const session = localStorage.getItem("zaui_food_session");
    setIsLoggedIn(!!session);
  }, [location.pathname]);

  if (isLoggedIn) {
    return null;
  }

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
            Thành viên TM Food
          </Text>
          <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
            Đăng nhập/đăng ký để nhận ưu đãi hấp dẫn.
          </Text>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <button
            type="button"
            onClick={() => navigate("/login")}
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
            🔐 Đăng ký/Đăng nhập
          </button>
        </div>
      </div>
    </Box>
  );
};


