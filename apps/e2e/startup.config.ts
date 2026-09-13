import { defineConfig } from "@playwright/test";
import production from "./production.config";
export default defineConfig({
  ...production,
  testDir: "./startup-tests", timeout: 180000, workers: 1, reporter: "list",
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
