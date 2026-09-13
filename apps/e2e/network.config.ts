import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./network-tests", workers: 1, timeout: 30000,
  use: { baseURL: "http://127.0.0.1:5185", trace: "retain-on-failure" },
  webServer: [
    { command: "pnpm --filter @game/server exec tsx src/lab/main.ts", port: 8794, reuseExistingServer: false },
    { command: "pnpm --filter @game/client dev --host 127.0.0.1 --port 5185", url: "http://127.0.0.1:5185", reuseExistingServer: false },
  ],
});
