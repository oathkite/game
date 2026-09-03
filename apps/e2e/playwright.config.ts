import { defineConfig } from "@playwright/test";

// 2 つのブラウザで 1 戦を通す e2e と、ブラウザで golden replay を走らせて Node と比べるテスト。
// ゲームサーバーと Vite の開発サーバーを起動してから走る。既に動いていればそれを使う。

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1400, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @game/server start",
      url: "http://localhost:8787/health",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "pnpm --filter @game/client dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
