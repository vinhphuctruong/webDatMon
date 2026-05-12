import React, { FC, Suspense } from "react";
import { Route, Routes, useNavigate, useLocation } from "react-router";
import { Box, Text } from "zmp-ui";
import { Navigation } from "./navigation";
import { ScrollRestoration } from "./scroll-restoration";
import { ErrorBoundary } from "./error-boundary";
import { GpsRequiredOverlay } from "./gps-required-overlay";
import { IncomingOrderAlert } from "./incoming-order-alert";
import { OrderCancelNoticeListener } from "./order-cancel-notice-listener";
import HomePage from "../pages/index";
import ActiveDeliveryPage from "../pages/active-delivery";
import OrdersPage from "../pages/orders";
import WalletPage from "../pages/wallet";
import ProfilePage from "../pages/profile";
import LoginPage from "../pages/login";
import RegisterPage from "../pages/register";
import ForgotPasswordPage from "../pages/forgot-password";
import NavigationPage from "../pages/navigation";
import { hasSessionAsync } from "../services/api";

const AuthGuard: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    let active = true;
    hasSessionAsync().then((has) => {
      if (!active) return;
      setHasSession(has);
      if (!has) {
        const publicPaths = ["/login", "/register", "/forgot-password"];
        if (!publicPaths.includes(location.pathname)) {
          navigate("/login", { replace: true });
        }
      }
    });
    return () => {
      active = false;
    };
  }, [location.pathname, navigate]);

  if (hasSession === null) {
    return (
      <Box className="flex-1 flex items-center justify-center" style={{ background: "var(--tm-bg)", height: "100vh" }}>
        <Text style={{ color: "var(--tm-text-secondary)" }}>Đang xác thực...</Text>
      </Box>
    );
  }

  return <>{children}</>;
};

const statusBarHeight = window.ZaloJavaScriptInterface?.getStatusBarHeight?.() ?? 0;
const safeAreaTopFromSdk = Math.max(
  0,
  Math.round(statusBarHeight / Math.max(window.devicePixelRatio || 1, 1))
);
const defaultSafeTop = import.meta.env.DEV ? 24 : 0;
const resolvedSafeTop = Math.max(safeAreaTopFromSdk, defaultSafeTop);

document.body.style.setProperty("--zaui-safe-area-inset-top", `${resolvedSafeTop}px`);
document.body.style.setProperty("--tm-safe-area-inset-top", `${resolvedSafeTop}px`);

export const Layout: FC = () => {
  return (
    <Box flex flexDirection="column" className="h-screen">
      <ScrollRestoration />
      <Box className="flex-1 flex flex-col overflow-hidden">
        <ErrorBoundary>
          <Suspense
            fallback={
              <Box
                className="flex-1 flex items-center justify-center"
                style={{ background: "var(--tm-bg)" }}
              >
                <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải...</Text>
              </Box>
            }
          >
            <Routes>
              {/* Auth routes — no GPS required */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />

              {/* Protected routes — GPS required */}
              <Route path="/*" element={
                <AuthGuard>
                  <GpsRequiredOverlay>
                    <IncomingOrderAlert />
                    <OrderCancelNoticeListener />
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/delivering" element={<ActiveDeliveryPage />} />
                      <Route path="/orders" element={<OrdersPage />} />
                      <Route path="/wallet" element={<WalletPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/navigation" element={<NavigationPage />} />
                    </Routes>
                  </GpsRequiredOverlay>
                </AuthGuard>
              } />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Box>
      <Navigation />
    </Box>
  );
};
