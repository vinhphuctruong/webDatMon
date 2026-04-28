import React, { FC, ReactNode } from "react";
import { getConfig } from "utils/config";

export const DisplayPrice: FC<{ children: ReactNode }> = ({ children }) => {
  const amount = typeof children === "number" ? children : 0;
  const symbol = getConfig((c) => c.template.currencySymbol) || "đ";
  return <>{amount.toLocaleString("vi-VN")}{symbol}</>;
};
