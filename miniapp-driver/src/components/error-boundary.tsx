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
        <Box className="flex-1 flex items-center justify-center" style={{ padding: 24, textAlign: "center" }}>
          <div>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>⚠️</Text>
            <Text style={{ fontWeight: 600, marginBottom: 8 }}>Đã xảy ra lỗi</Text>
            <Text size="xSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 16 }}>
              {this.state.error?.message || "Unknown error"}
            </Text>
            <Button size="medium" onClick={() => window.location.reload()}>Tải lại</Button>
          </div>
        </Box>
      );
    }

    return this.props.children;
  }
}
