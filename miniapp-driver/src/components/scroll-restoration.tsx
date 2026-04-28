import React, { FC, useEffect, useRef } from "react";
import { useLocation } from "react-router";

export const ScrollRestoration: FC = () => {
  const location = useLocation();
  const positionsRef = useRef<Record<string, number>>({});
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    const scrollable = document.querySelector(".zaui-page");
    if (!scrollable) return;

    // Save scroll position for leaving page
    positionsRef.current[previousPathRef.current] = scrollable.scrollTop;

    // Restore scroll position for entering page
    const savedPosition = positionsRef.current[location.pathname] || 0;
    setTimeout(() => {
      scrollable.scrollTo({ top: savedPosition, behavior: "instant" as any });
    }, 0);

    previousPathRef.current = location.pathname;
  }, [location.pathname]);

  return null;
};
