import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./world-tests", timeout: 45000, workers: 1, reporter: "list",
  use: { locale: "ja-JP", baseURL: "http://127.0.0.1:5186", trace: "retain-on-failure" },
  webServer: { command: "pnpm --filter @game/client dev --port 5186 --host 127.0.0.1", url: "http://127.0.0.1:5186", reuseExistingServer: false },
});
