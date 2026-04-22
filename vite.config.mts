import { defineConfig, loadEnv } from "vite";
import ZaloMiniApp from "zmp-vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8081";

  return {
    root: "./src",
    base: "",
    plugins: [tsconfigPaths(), react(), ZaloMiniApp()],
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      alias: {
        components: path.resolve(__dirname, "src/components"),
        pages: path.resolve(__dirname, "src/pages"),
        utils: path.resolve(__dirname, "src/utils"),
        types: path.resolve(__dirname, "src/types"),
        static: path.resolve(__dirname, "src/static"),
        services: path.resolve(__dirname, "src/services"),
        state: path.resolve(__dirname, "src/state.ts"),
        hooks: path.resolve(__dirname, "src/hooks.ts"),
        css: path.resolve(__dirname, "src/css"),
      },
    },
  };
});
