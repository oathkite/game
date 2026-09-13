import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./rooms-tests",
  testMatch: ["image-terrain.spec.ts", "resize-input.spec.ts"],
  workers: 1,
  timeout: 90000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5173", locale: "ja-JP", actionTimeout: 8000 },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "pnpm --filter game dev",
    url: "http://127.0.0.1:8796/v2/rooms",
    timeout: 120000,
    reuseExistingServer: false,
  },
});
