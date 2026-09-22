import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./world-tests", testMatch: "jev-cpu.spec.ts", timeout: 90000, workers: 1, reporter: "list",
  use: { locale: "ja-JP", baseURL: "http://127.0.0.1:5197", trace: "retain-on-failure" },
  webServer: { command: "pnpm --filter @game/client dev --port 5197 --host 127.0.0.1", url: "http://127.0.0.1:5197", reuseExistingServer: false,
    env: { VITE_CPU_SERVER_URL: "http://127.0.0.1:5197/cpu" } },
});
