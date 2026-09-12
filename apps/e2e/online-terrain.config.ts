import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./rooms-tests", testMatch: ["image-terrain.spec.ts", "eight-players.spec.ts"], workers: 1, timeout: 90000, reporter: "list",
  projects: [{ name: "chromium", metadata: { mapId: process.env.TERRAIN_MAP ?? "rock-arch", measureTransfer: true }, use: { browserName: "chromium" } }, { name: "firefox", metadata: { mapId: process.env.TERRAIN_MAP ?? "rock-arch", measureTransfer: true }, use: { browserName: "firefox" } }, { name: "webkit", metadata: { mapId: process.env.TERRAIN_MAP ?? "rock-arch", measureTransfer: true }, use: { browserName: "webkit" } }],
  use: { locale: "ja-JP", baseURL: "http://127.0.0.1:5191", actionTimeout: 8000, trace: "retain-on-failure" },
  webServer: [
    { command: "pnpm --filter @game/server exec wrangler dev --config wrangler.v2.jsonc --port 8798 --local --persist-to .keropod/e2e-image-terrain --var ALLOWED_ORIGINS:http://127.0.0.1:5191", url: "http://127.0.0.1:8798/v2/rooms", timeout: 120000 },
    { command: "VITE_ROOM_SERVER_URL=http://127.0.0.1:8798 pnpm --filter @game/client build && pnpm --filter @game/client preview --host 127.0.0.1 --port 5191", port: 5191, timeout: 120000 },
  ],
});
