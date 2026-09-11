import { defineConfig } from "@playwright/test";
import base from "./production-rooms.config";
export default defineConfig({ ...base, testDir: "./long-match-tests", testMatch: ["natural-match.spec.ts"] });
