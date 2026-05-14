import React, { FC, Suspense } from "react";
import { Route, Routes } from "react-router";
import { Box, Text } from "zmp-ui";
import { Navigation } from "./navigation";
import { IncomingStoreOrderAlert } from "./incoming-store-order-alert";
import { OrderCancelNoticeListener } from "./order-cancel-notice-listener";
import HomePage from "../pages/index";
import OrdersPage from "../pages/orders";
import OrderDetailPage from "../pages/order-detail";
import MenuPage from "../pages/menu";
import ProductFormPage from "../pages/product-form";
import WalletPage from "../pages/wallet";
import SettingsPage from "../pages/settings";
import ProfilePage from "../pages/profile";
import LoginPage from "../pages/login";
import WelcomePage from "../pages/welcome";
import RegisterPage from "../pages/register";
import RegisterAccountPage from "../pages/register-account";
import ApplicationStatusPage from "../pages/application-status";
import ForgotPasswordPage from "../pages/forgot-password";
import { ScrollRestoration } from "./scroll-restoration";
import { ErrorBoundary } from "./error-boundary";

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
                <Text style={{ color: "var(--tm-text-secondary)" }}>Đang tải dữ liệu...</Text>
              </Box>
            }
          >
            <IncomingStoreOrderAlert />
            <OrderCancelNoticeListener />
            <Routes>
              {/* Auth routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register-account" element={<RegisterAccountPage />} />
              <Route path="/application-status" element={<ApplicationStatusPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />

              {/* Protected routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/order-detail/:id" element={<OrderDetailPage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/product-form" element={<ProductFormPage />} />
              <Route path="/product-form/:id" element={<ProductFormPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Box>
      <Navigation />
    </Box>
  );
};
