import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget =
    process.env.VITE_PROXY_TARGET ||
    env.VITE_PROXY_TARGET ||
    "http://localhost:5000";

  return {
    plugins: [react(), tailwindcss(), viteSingleFile()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: false,
      // Local development: the frontend calls `/api/...` and Vite forwards it
      // to the local mock API (`npm run mock`). Only used when the
      // Supabase env vars are empty; production talks to Supabase directly.
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
      // Allow the Arena preview host + any tunnel domain.
      allowedHosts: true,
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
    },
  };
});
