import { useVirtualKeyboardVisible } from "hooks";
import React, { FC, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { MenuItem } from "types/menu";
import { BottomNavigation, Icon } from "zmp-ui";

const tabs: Record<string, MenuItem> = {
  "/": {
    label: "Tổng quan",
    icon: <Icon icon="zi-home" />,
  },
  "/orders": {
    label: "Đơn hàng",
    icon: <Icon icon="zi-list-1" />,
  },
  "/menu": {
    label: "Thực đơn",
    icon: <Icon icon="zi-more-grid" />,
  },
  "/wallet": {
    label: "Ví & Doanh thu",
    icon: <Icon icon="zi-poll" />,
  },
  "/profile": {
    label: "Tài khoản",
    icon: <Icon icon="zi-user" />,
  },
};

export type TabKeys = keyof typeof tabs;

export const NO_BOTTOM_NAVIGATION_PAGES = [
  "/login",
  "/welcome",
  "/register",
  "/register-account",
  "/application-status",
];

export const Navigation: FC = () => {
  const keyboardVisible = useVirtualKeyboardVisible();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("zaui_food_session");
    setIsLoggedIn(!!session);
  }, [location.pathname]);

  const noBottomNav = useMemo(() => {
    return NO_BOTTOM_NAVIGATION_PAGES.includes(location.pathname);
  }, [location]);

  if (noBottomNav || keyboardVisible) {
    return <></>;
  }

  return (
    <BottomNavigation
      id="footer"
      activeKey={location.pathname}
      onChange={navigate}
      className="z-50"
    >
      {(Object.keys(tabs) as TabKeys[])
        .filter((path) => path !== "/profile" || isLoggedIn)
        .map((path: TabKeys) => (
          <BottomNavigation.Item
            key={path}
            label={tabs[path].label}
            icon={tabs[path].icon}
            activeIcon={tabs[path].activeIcon}
          />
        ))}
    </BottomNavigation>
  );
};
