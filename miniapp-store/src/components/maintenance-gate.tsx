import React, { useEffect, useState, useCallback } from "react";
import { Box, Text, Button } from "zmp-ui";

const DEFAULT_API_BASE_URL = "/api/v1";
const CONFIGURED_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, "");
const RETRY_INTERVAL_MS = 10_000;

function getHealthCheckCandidates() {
  const candidates = new Set<string>();
  candidates.add(`${DEFAULT_API_BASE_URL}/categories`);

  if (CONFIGURED_API_BASE_URL) {
    candidates.add(`${CONFIGURED_API_BASE_URL}/categories`);

    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      const secureVariant = CONFIGURED_API_BASE_URL.replace(/^http:\/\//i, "https://");
      candidates.add(`${secureVariant}/categories`);
    }
  }

  return Array.from(candidates);
}

async function checkBackendHealth(): Promise<boolean> {
  for (const url of getHealthCheckCandidates()) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      clearTimeout(timeout);
      if (res.ok) return true;
    } catch {
      // try next candidate
    }
  }
  return false;
}

export const MaintenanceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");

  const check = useCallback(async () => {
    const ok = await checkBackendHealth();
    setStatus(ok ? "online" : "offline");
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  // Auto-retry when offline
  useEffect(() => {
    if (status !== "offline") return;
    const id = setInterval(check, RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status, check]);

  if (status === "online") return <>{children}</>;

  return (
    <Box
      className="maintenance-gate"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "32px",
        textAlign: "center",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          backdropFilter: "blur(10px)",
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>

      {/* Title */}
      <Text
        bold
        style={{
          fontSize: 22,
          color: "#fff",
          marginBottom: 12,
        }}
      >
        Hệ thống đang bảo trì
      </Text>

      {/* Description */}
      <Text
        style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.6,
          maxWidth: 300,
          marginBottom: 32,
        }}
      >
        {status === "checking"
          ? "Đang kiểm tra kết nối đến máy chủ..."
          : "Chúng tôi đang nâng cấp hệ thống để phục vụ bạn tốt hơn. Vui lòng quay lại sau ít phút."}
      </Text>

      {/* Spinner or Retry */}
      {status === "checking" ? (
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid rgba(255,255,255,0.3)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "maintenance-spin 0.8s linear infinite",
          }}
        />
      ) : (
        <Button
          style={{
            background: "rgba(255,255,255,0.2)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 24,
            padding: "10px 32px",
            backdropFilter: "blur(10px)",
          }}
          onClick={() => {
            setStatus("checking");
            check();
          }}
        >
          Thử lại
        </Button>
      )}

      {/* Auto-retry indicator */}
      {status === "offline" && (
        <Text
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            marginTop: 16,
          }}
        >
          Tự động kiểm tra lại sau mỗi 10 giây
        </Text>
      )}

      <style>{`
        @keyframes maintenance-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
};
