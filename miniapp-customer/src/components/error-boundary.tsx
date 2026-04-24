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
        style={{ padding: 24, textAlign: "center", background: "var(--tm-bg)" }}
      >
        <Text style={{ fontWeight: 700, fontSize: 20, color: "var(--tm-text-primary)" }}>
          Không thể hiển thị trang
        </Text>
        <Text size="small" style={{ marginTop: 8, color: "var(--tm-text-secondary)" }}>
          Đã xảy ra lỗi ngoài ý muốn. Bạn thử tải lại để tiếp tục đặt món nhé.
        </Text>
        <button
          onClick={this.reloadPage}
          style={{
            marginTop: 16,
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: "var(--tm-primary)",
            color: "#fff",
            fontWeight: 600,
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

