import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// テストは純粋な TypeScript だけを対象にするので、React プラグインは使わない

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
