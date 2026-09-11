import { expect, test } from "@playwright/test";
test("authored terrain survives loading and loses collision cells after a real shot", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    Math.random = () => 0.75;
    localStorage.setItem("fortress.profile.v1", JSON.stringify({ nickname: "Terrain", loadout: ["cannon", "drill"] }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティスへ", exact: true }).click();
  const field = page.getByTestId("camera-world");
  await expect(field).toHaveAttribute("data-opening", "true");
  await page.screenshot({ path: `test-results/image-terrain-overview-${test.info().project.name}.png` });
  await expect(field).toHaveAttribute("data-opening", "false", { timeout: 15000 });
  const count = () => page.evaluate(() => window.__fortress!.getView().mask!.cells.reduce((sum, cell) => sum + cell, 0));
  const before = await count();
  await page.screenshot({ path: `test-results/image-terrain-before-${test.info().project.name}.png` });
  await page.keyboard.down("Space"); await page.waitForTimeout(150); await page.keyboard.up("Space");
  await expect.poll(count, { timeout: 15000 }).toBeLessThan(before);
  await expect.poll(() => page.evaluate(() => window.__fortress!.getView().phase), { timeout: 15000 }).toBe("acting");
  await page.keyboard.press("Tab"); await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/image-terrain-after-${test.info().project.name}.png` });
  expect(errors).toEqual([]);
});
