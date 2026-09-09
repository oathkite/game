import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./camera-tests",
  timeout: 45_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5184", viewport: { width: 1440, height: 900 }, trace: "retain-on-failure" },
  webServer: { command: "pnpm --filter @game/client dev --port 5184 --host 127.0.0.1", url: "http://127.0.0.1:5184", reuseExistingServer: !process.env.CI },
});
