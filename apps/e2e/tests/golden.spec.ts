import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// 設計書 07 の 7.5「クロス環境」。同じ golden replay を Node とブラウザで走らせ、結果が一致することを確認する。

const here = fileURLToPath(new URL(".", import.meta.url));

test("golden replay は Node とブラウザで同じ結果になる", async ({ page }) => {
  const fromNode = execFileSync("pnpm", ["exec", "tsx", "scripts/golden-node.ts"], { cwd: `${here}/..`, encoding: "utf8" });
  await page.goto("/golden.html");
  await page.waitForFunction(() => typeof (window as Window & { __golden?: string }).__golden === "string");
  const fromBrowser = await page.evaluate(() => (window as Window & { __golden?: string }).__golden ?? "");
  const nodeCases = JSON.parse(fromNode) as unknown[];
  expect(nodeCases.length).toBe(14);
  expect(fromBrowser).toBe(fromNode);
});
