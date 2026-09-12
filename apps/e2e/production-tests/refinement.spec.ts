import { expect, test } from "@playwright/test";
const enter = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティスへ", exact: true }).click();
};
test("opening holds input until START and leaves a full turn", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter(page);
  const field = page.getByTestId("camera-world");
  await expect(page.locator(".battle-weapons button").first()).toBeDisabled();
  await expect(field).toHaveAttribute("data-loaded", "true", { timeout: 15000 });
  await expect(field).toHaveAttribute("data-scale", "9");
  await expect(field).toHaveAttribute("data-opening", "true");
  await expect(page.locator(".battle-weapons button").first()).toBeDisabled();
  await page.screenshot({ path: "test-results/refinement-overview.png" });
  await expect(page.getByRole("status", { name: "START!" })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: "test-results/refinement-start.png" });
  await expect(field).toHaveAttribute("data-opening", "false");
  await expect(page.locator(".battle-weapons button").first()).toBeEnabled();
  await page.screenshot({ path: "test-results/refinement-desktop.png" });
});
test("compact touch cross leaves over half the landscape for the world", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 667, height: 375 }, hasTouch: true, locale: "ja-JP" });
  const page = await context.newPage();
  await enter(page);
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-opening", "false", { timeout: 15000 });
  const field = await page.getByTestId("camera-world").boundingBox();
  expect(field!.height).toBeGreaterThan(200);
  const left = await page.getByRole("button", { name: "左へ移動", exact: true }).boundingBox();
  const up = await page.getByRole("button", { name: "角度を上げる", exact: true }).boundingBox();
  const right = await page.getByRole("button", { name: "右へ移動", exact: true }).boundingBox();
  expect(left!.x).toBeLessThan(20);
  expect(up!.y).toBeLessThan(left!.y);
  expect(right!.x).toBeGreaterThan(up!.x);
  await page.screenshot({ path: "test-results/refinement-mobile.png" });
  await context.close();
});
