import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// 開発時は /ws をゲームサーバー（既定 8787）へ中継し、本番は VITE_SERVER_URL で直接つなぐ

const serverTarget = process.env.VITE_DEV_SERVER_TARGET ?? "ws://localhost:8787";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/ws": {
        target: serverTarget,
        ws: true,
        rewrite: (path) => path.replace(/^\/ws/, "/"),
      },
    },
  },
});
