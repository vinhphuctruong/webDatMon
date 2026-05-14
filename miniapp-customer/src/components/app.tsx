import React from "react";
import { App, ZMPRouter, SnackbarProvider } from "zmp-ui";
import { authorize } from "zmp-sdk";
import { RecoilRoot } from "recoil";
import { getConfig } from "utils/config";
import { Layout } from "./layout";
import { ConfigProvider } from "./config-provider";
import { MaintenanceGate } from "./maintenance-gate";

const MyApp = () => {
  React.useEffect(() => {
    authorize({
      scopes: ["scope.userLocation"],
    }).catch(console.error);
  }, []);

  return (
    <RecoilRoot>
      <ConfigProvider
        cssVariables={{
          "--zmp-primary-color": getConfig((c) => c.template.primaryColor),
          "--zmp-background-color": "#f4f5f6",
        }}
      >
        <App>
          <SnackbarProvider>
            <MaintenanceGate>
              <ZMPRouter>
                <Layout />
              </ZMPRouter>
            </MaintenanceGate>
          </SnackbarProvider>
        </App>
      </ConfigProvider>
    </RecoilRoot>
  );
};
export default MyApp;

