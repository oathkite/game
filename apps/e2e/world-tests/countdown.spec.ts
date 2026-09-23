import { expect, test } from "@playwright/test";
import { startFreePractice } from "./practiceFlow";

// 残り時間は数字だけで示す（63dc954 で輪を外した）。
test("practice countdown follows the remaining seconds", async ({ page }) => {
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await startFreePractice(page);
  const dial = page.locator(".countdown-dial");
  const remaining = dial.locator("span");
  const seconds = Number(await remaining.innerText());
  await expect.poll(async () => Number(await remaining.innerText())).toBeLessThan(seconds);
  const bounds = await dial.boundingBox();
  expect(bounds!.width).toBeGreaterThanOrEqual(40);
  expect(bounds!.height).toBeGreaterThanOrEqual(40);
  await page.screenshot({ path: "test-results/countdown-ring.png" });
});
