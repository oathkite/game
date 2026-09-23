import { defineConfig } from "@playwright/test";
// 部屋一覧とコード参加は VITE_ROOM_SERVER_URL を指定したときだけ描画されるので、本番と同じ v2 Room API（ローカルの wrangler）へつなぐ。
export default defineConfig({ testDir: "./rooms-tests", testIgnore: ["public-rooms.spec.ts", "invite-token.spec.ts"], workers: 1, timeout: 45000, reporter: "list",
  use: { locale: "ja-JP", baseURL: "http://127.0.0.1:5186", actionTimeout: 5000, trace: "retain-on-failure" },
  webServer: [
    { command: "pnpm --filter @game/server exec wrangler dev --config wrangler.v2.jsonc --port 8797 --local --persist-to .keropod/e2e-rooms", url: "http://127.0.0.1:8797/v2/rooms", reuseExistingServer: false, timeout: 120000 },
    { command: "VITE_ROOM_SERVER_URL=http://127.0.0.1:8797 pnpm --filter @game/client dev --host 127.0.0.1 --port 5186", port: 5186, reuseExistingServer: false },
  ],
});
