import { expect, test } from "@playwright/test";
test("title starts immediately without intro or replay controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "はじめる", exact: true })).toBeVisible();
  await expect(page.locator(".world-intro-machine,.world-intro-skip")).toHaveCount(0);
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.getByRole("button", { name: "イントロを再生", exact: true })).toHaveCount(0);
});
test("audio initialization refusal does not block starting the game", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { value: class { constructor() { throw new Error("audio unavailable"); } } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
});
