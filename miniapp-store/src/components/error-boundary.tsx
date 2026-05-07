import React from "react";
import { Box, Text } from "zmp-ui";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Unhandled UI error", error);
  }

  private reloadPage = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Box
        className="flex-1 flex flex-col justify-center items-center"
        style={{ padding: 24, textAlign: "center", background: "var(--tm-bg)", minHeight: "80vh" }}
      >
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🔧</Text>
        <Text style={{ fontWeight: 700, fontSize: 20, color: "var(--tm-text-primary)" }}>
          Hệ thống đang bảo trì
        </Text>
        <Text size="small" style={{ marginTop: 8, color: "var(--tm-text-secondary)", lineHeight: 1.5 }}>
          Hiện tại máy chủ đang được bảo trì hoặc quá tải. Mong bạn thông cảm quay lại sau ít phút nhé.
        </Text>
        <button
          onClick={this.reloadPage}
          style={{
            marginTop: 20,
            padding: "12px 24px",
            borderRadius: 12,
            border: "none",
            background: "var(--tm-primary)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Tải lại
        </button>
      </Box>
    );
  }
}

