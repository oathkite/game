import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./production-tests", workers: 1, timeout: 45000, reporter: "list",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  use: { locale: "ja-JP", baseURL: "http://127.0.0.1:5188", actionTimeout: 5000, trace: "retain-on-failure" },
  webServer: { command: "pnpm --filter @game/client build && pnpm --filter @game/client preview --host 127.0.0.1 --port 5188", port: 5188, reuseExistingServer: false, timeout: 120000 },
});
