import React, { FC, Suspense } from "react";
import { Route, Routes } from "react-router";
import { Box, Text } from "zmp-ui";
import { Navigation } from "./navigation";
import HomePage from "pages/index";
import CategoryPage from "pages/category";
import CartPage from "pages/cart";
import NotificationPage from "pages/notification";
import ProfilePage from "pages/profile";
import SearchPage from "pages/search";
import OrdersPage from "pages/orders";
import AddressesPage from "pages/addresses";
import CheckoutResultPage from "pages/result";
import PartnerOnboardingPage from "pages/partner-onboarding";
import AccountPage from "pages/account";
import RegisterStorePage from "pages/register-store";
import { getSystemInfo } from "zmp-sdk";
import { ScrollRestoration } from "./scroll-restoration";
import { useHandlePayment, useSyncBackendState } from "hooks";
import { ErrorBoundary } from "./error-boundary";

if (import.meta.env.DEV) {
  document.body.style.setProperty("--zaui-safe-area-inset-top", "24px");
} else if (getSystemInfo().platform === "android") {
  const statusBarHeight =
    window.ZaloJavaScriptInterface?.getStatusBarHeight() ?? 0;
  const androidSafeTop = Math.round(statusBarHeight / window.devicePixelRatio);
  document.body.style.setProperty(
    "--zaui-safe-area-inset-top",
    `${androidSafeTop}px`
  );
}

export const Layout: FC = () => {
  useHandlePayment();
  useSyncBackendState();

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
            <Routes>
              <Route path="/" element={<HomePage />}></Route>
              <Route path="/search" element={<SearchPage />}></Route>
              <Route path="/orders" element={<OrdersPage />}></Route>
              <Route path="/addresses" element={<AddressesPage />}></Route>
              <Route path="/category" element={<CategoryPage />}></Route>
              <Route path="/notification" element={<NotificationPage />}></Route>
              <Route path="/cart" element={<CartPage />}></Route>
              <Route path="/profile" element={<ProfilePage />}></Route>
              <Route path="/account" element={<AccountPage />}></Route>
              <Route path="/partner-onboarding" element={<PartnerOnboardingPage />}></Route>
              <Route path="/register-store" element={<RegisterStorePage />}></Route>
              <Route path="/result" element={<CheckoutResultPage />}></Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Box>
      <Navigation />
    </Box>
  );
};
