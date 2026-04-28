import { setNavigationBarColor } from "zmp-sdk";

export const matchStatusBarColor = (visible?: boolean) => {
  try {
    setNavigationBarColor({ color: visible ? "#fff" : "#3b82f6" });
  } catch (_error) {
    // Ignore
  }
};
