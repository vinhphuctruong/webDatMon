import React, { Component, ErrorInfo, ReactNode } from "react";
import { Box, Text, Button } from "zmp-ui";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box className="flex-1 flex items-center justify-center" style={{ padding: 24, textAlign: "center", background: "var(--tm-bg)", minHeight: "80vh" }}>
          <div>
            <Text style={{ fontSize: 56, marginBottom: 16 }}></Text>
            <Text style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Hệ thống đang bảo trì</Text>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
              Hiện tại máy chủ đang được bảo trì hoặc quá tải. Mong bạn thông cảm quay lại sau ít phút nhé.
            </Text>
            <Button size="medium" onClick={() => window.location.reload()}>Tải lại</Button>
          </div>
        </Box>
      );
    }

    return this.props.children;
  }
}
