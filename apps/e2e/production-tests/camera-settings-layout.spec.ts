import { expect, test } from "@playwright/test";

test("camera settings have their layout before practice has loaded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  const panel = page.locator(".kp-camera-settings");
  const reset = panel.getByRole("button", { name: "カメラを初期値に戻す", exact: true });
  const note = panel.locator("small").last();
  await expect(note).toHaveCSS("display", "block");
  const resetBox = (await reset.boundingBox())!, noteBox = (await note.boundingBox())!;
  expect(noteBox.y).toBeGreaterThanOrEqual(resetBox.y + resetBox.height);
  const labels = await panel.locator("label").evaluateAll(elements => elements.map(element => getComputedStyle(element).justifyContent));
  expect(labels).toEqual(["space-between", "space-between"]);
  await page.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
  await page.setViewportSize({ width: 667, height: 375 });
  await page.getByRole("button", { name: "プラクティスへ", exact: true }).click();
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
  await page.getByRole("button", { name: "設定を開く", exact: true }).click();
  await expect(page.locator(".kp-camera-settings small").last()).toHaveCSS("display", "block");
});
