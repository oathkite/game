import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./world-network-tests", timeout: 45000, workers: 1, reporter: "list",
  use: { baseURL: "http://127.0.0.1:5186", trace: "retain-on-failure", actionTimeout: 5000 },
  webServer: [
    { command: "pnpm --filter @game/server exec tsx src/lab/main.ts", port: 8794, reuseExistingServer: false },
    { command: "pnpm --filter @game/client dev --host 127.0.0.1 --port 5186", url: "http://127.0.0.1:5186", reuseExistingServer: false },
  ],
});
