import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./rooms-tests", testMatch: ["eight-players.spec.ts", "result-timeout.spec.ts", "formations.spec.ts", "public-rooms.spec.ts", "invite-token.spec.ts"], workers: 1, timeout: 120000, reporter: "list",
  metadata: { measureTransfer: true },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  use: { locale: "ja-JP", baseURL: "http://127.0.0.1:5186", actionTimeout: 5000, trace: "retain-on-failure" },
  webServer: [
    { command: "pnpm --filter @game/server exec wrangler dev --config wrangler.v2.jsonc --port 8798 --local --persist-to .keropod/e2e-production", url: "http://127.0.0.1:8798/v2/rooms", reuseExistingServer: false, timeout: 120000 },
    { command: "VITE_ROOM_SERVER_URL=http://127.0.0.1:8798 pnpm --filter @game/client build && pnpm --filter @game/client preview --host 127.0.0.1 --port 5186", port: 5186, reuseExistingServer: false, timeout: 120000 },
  ],
});
