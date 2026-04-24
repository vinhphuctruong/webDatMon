import React, { FC } from "react";

export const Divider: FC<{
  size?: number;
  className?: string;
}> = ({ size = 8, className }) => (
  <div
    className={`tm-divider ${className ?? ""}`}
    style={{ height: size }}
  />
);
