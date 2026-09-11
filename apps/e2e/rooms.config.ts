import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./rooms-tests", testIgnore: "public-rooms.spec.ts", workers: 1, timeout: 45000, reporter: "list",
  use: { locale: "ja-JP", baseURL: "http://127.0.0.1:5186", actionTimeout: 5000, trace: "retain-on-failure" },
  webServer: [
    { command: "pnpm --filter @game/server exec tsx src/rooms/main.ts", port: 8795, reuseExistingServer: false },
    { command: "pnpm --filter @game/client dev --host 127.0.0.1 --port 5186", port: 5186, reuseExistingServer: false },
  ],
});
