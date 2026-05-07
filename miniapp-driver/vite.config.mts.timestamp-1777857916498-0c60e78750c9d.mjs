// vite.config.mts
import { defineConfig, loadEnv } from "file:///d:/app_dat_mon/miniapp-driver/node_modules/vite/dist/node/index.js";
import ZaloMiniApp from "file:///d:/app_dat_mon/miniapp-driver/node_modules/zmp-vite-plugin/dist/index.mjs";
import tsconfigPaths from "file:///d:/app_dat_mon/miniapp-driver/node_modules/vite-tsconfig-paths/dist/index.mjs";
import react from "file:///d:/app_dat_mon/miniapp-driver/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
var __vite_injected_original_import_meta_url = "file:///d:/app_dat_mon/miniapp-driver/vite.config.mts";
var __filename = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname = path.dirname(__filename);
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8081";
  return {
    root: "./src",
    base: "",
    plugins: [tsconfigPaths(), react(), ZaloMiniApp()],
    server: {
      host: true,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false
        }
      }
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
        css: path.resolve(__dirname, "src/css")
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubXRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiZDpcXFxcYXBwX2RhdF9tb25cXFxcbWluaWFwcC1kcml2ZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcImQ6XFxcXGFwcF9kYXRfbW9uXFxcXG1pbmlhcHAtZHJpdmVyXFxcXHZpdGUuY29uZmlnLm10c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vZDovYXBwX2RhdF9tb24vbWluaWFwcC1kcml2ZXIvdml0ZS5jb25maWcubXRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCBaYWxvTWluaUFwcCBmcm9tIFwiem1wLXZpdGUtcGx1Z2luXCI7XG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tIFwidml0ZS10c2NvbmZpZy1wYXRoc1wiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gXCJub2RlOnVybFwiO1xuXG5jb25zdCBfX2ZpbGVuYW1lID0gZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpO1xuY29uc3QgX19kaXJuYW1lID0gcGF0aC5kaXJuYW1lKF9fZmlsZW5hbWUpO1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksIFwiXCIpO1xuICBjb25zdCBhcGlQcm94eVRhcmdldCA9IGVudi5WSVRFX0FQSV9QUk9YWV9UQVJHRVQgfHwgXCJodHRwOi8vbG9jYWxob3N0OjgwODFcIjtcblxuICByZXR1cm4ge1xuICAgIHJvb3Q6IFwiLi9zcmNcIixcbiAgICBiYXNlOiBcIlwiLFxuICAgIHBsdWdpbnM6IFt0c2NvbmZpZ1BhdGhzKCksIHJlYWN0KCksIFphbG9NaW5pQXBwKCldLFxuICAgIHNlcnZlcjoge1xuICAgICAgaG9zdDogdHJ1ZSxcbiAgICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcbiAgICAgIHByb3h5OiB7XG4gICAgICAgIFwiL2FwaVwiOiB7XG4gICAgICAgICAgdGFyZ2V0OiBhcGlQcm94eVRhcmdldCxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICBjb21wb25lbnRzOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNyYy9jb21wb25lbnRzXCIpLFxuICAgICAgICBwYWdlczogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzcmMvcGFnZXNcIiksXG4gICAgICAgIHV0aWxzOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNyYy91dGlsc1wiKSxcbiAgICAgICAgdHlwZXM6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjL3R5cGVzXCIpLFxuICAgICAgICBzdGF0aWM6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjL3N0YXRpY1wiKSxcbiAgICAgICAgc2VydmljZXM6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjL3NlcnZpY2VzXCIpLFxuICAgICAgICBzdGF0ZTogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzcmMvc3RhdGUudHNcIiksXG4gICAgICAgIGhvb2tzOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNyYy9ob29rcy50c1wiKSxcbiAgICAgICAgY3NzOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNyYy9jc3NcIiksXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVIsU0FBUyxjQUFjLGVBQWU7QUFDdlQsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxtQkFBbUI7QUFDMUIsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHFCQUFxQjtBQUwwSSxJQUFNLDJDQUEyQztBQU96TixJQUFNLGFBQWEsY0FBYyx3Q0FBZTtBQUNoRCxJQUFNLFlBQVksS0FBSyxRQUFRLFVBQVU7QUFHekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksR0FBRyxFQUFFO0FBQzNDLFFBQU0saUJBQWlCLElBQUkseUJBQXlCO0FBRXBELFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFNBQVMsQ0FBQyxjQUFjLEdBQUcsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLElBQ2pELFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLGNBQWM7QUFBQSxNQUNkLE9BQU87QUFBQSxRQUNMLFFBQVE7QUFBQSxVQUNOLFFBQVE7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxRQUNWO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLE9BQU87QUFBQSxRQUNMLFlBQVksS0FBSyxRQUFRLFdBQVcsZ0JBQWdCO0FBQUEsUUFDcEQsT0FBTyxLQUFLLFFBQVEsV0FBVyxXQUFXO0FBQUEsUUFDMUMsT0FBTyxLQUFLLFFBQVEsV0FBVyxXQUFXO0FBQUEsUUFDMUMsT0FBTyxLQUFLLFFBQVEsV0FBVyxXQUFXO0FBQUEsUUFDMUMsUUFBUSxLQUFLLFFBQVEsV0FBVyxZQUFZO0FBQUEsUUFDNUMsVUFBVSxLQUFLLFFBQVEsV0FBVyxjQUFjO0FBQUEsUUFDaEQsT0FBTyxLQUFLLFFBQVEsV0FBVyxjQUFjO0FBQUEsUUFDN0MsT0FBTyxLQUFLLFFBQVEsV0FBVyxjQUFjO0FBQUEsUUFDN0MsS0FBSyxLQUFLLFFBQVEsV0FBVyxTQUFTO0FBQUEsTUFDeEM7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
