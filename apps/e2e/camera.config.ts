import { defineConfig } from "@playwright/test";

const port = Number(process.env.CAMERA_TEST_PORT ?? 5184);
export default defineConfig({
  testDir: "./camera-tests",
  timeout: 45_000,
  workers: 1,
  reporter: "list",
  use: { locale: "ja-JP", baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1440, height: 900 }, trace: "retain-on-failure" },
  webServer: { command: `pnpm --filter @game/client dev --port ${port} --host 127.0.0.1`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI },
});
