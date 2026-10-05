import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // 手元は既定の 5 秒。CI の runner は手元の 1.2〜2.5 倍遅いので 4 倍の余裕を取る。1 秒を超えるテストは出力で目立たせる（設計書 7.5）
    testTimeout: process.env.CI ? 20_000 : 5_000,
    slowTestThreshold: 1000,
    setupFiles: ["@game/testing/setup"],
  },
});
