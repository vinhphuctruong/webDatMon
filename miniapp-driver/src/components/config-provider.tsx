import React, { FC, ReactNode, useLayoutEffect } from "react";

interface ConfigProviderProps {
  children: ReactNode;
  cssVariables: Record<string, string>;
}

export const ConfigProvider: FC<ConfigProviderProps> = ({
  children,
  cssVariables,
}) => {
  useLayoutEffect(() => {
    Object.entries(cssVariables).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }, [cssVariables]);

  return <>{children}</>;
};
