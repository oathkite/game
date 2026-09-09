import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 360, height: 640 }, { width: 667, height: 375 }, { width: 1400, height: 800 }]) {
  test(`設定の選択肢はモーダルで変更する ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByText(/矢印キー:/)).toHaveCount(0);
    if (viewport.width > 640) {
      const panes = page.locator(".setup .screen-split > .pane");
      await expect(panes.nth(1).getByLabel("nickname")).toBeVisible();
      const preview = await panes.first().getByTestId("tank-preview").boundingBox();
      const pane = await panes.first().boundingBox();
      expect(preview!.height).toBeGreaterThan(pane!.height * 0.65);
    }
    await expect(page.locator(".setup-preview-pane canvas")).toHaveAttribute("data-closeup", "true");
    await expect(page.getByLabel("solo map")).toHaveCount(0);
    await expect(page.locator(".setup-preview-pane canvas")).toHaveAttribute("data-demo", "");
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page.getByRole("button", { name: "色を変更" }).click();
    const colors = page.getByRole("dialog", { name: "色を変更" });
    await expect(colors.getByRole("button", { name: "完了" })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/color-picker-${viewport.width}.png` });
    await colors.getByRole("radio", { name: "カラー1 blue", exact: true }).click();
    await colors.getByRole("radio", { name: "カラー2 cyan", exact: true }).click();
    await colors.getByRole("button", { name: "完了" }).click();
    await expect(page.getByRole("button", { name: "色を変更" })).toBeFocused();
    await page.getByRole("button", { name: "武器を変更" }).click();
    const weapons = page.getByRole("dialog", { name: "武器を変更" });
    await expect(weapons.getByRole("button", { name: "完了" })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/weapon-picker-${viewport.width}.png` });
    await weapons.getByRole("radio", { name: "武器 1 digger", exact: true }).click();
    await expect(weapons.getByRole("radio", { name: "武器 2 cannon", exact: true })).toBeChecked();
    await weapons.getByRole("radio", { name: "武器 1 triple", exact: true }).click();
    await weapons.getByRole("radio", { name: "武器 2 laser", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "武器を変更" })).toBeFocused();
    await expect(page.getByTestId("loadout-summary")).toContainText("トリプル弾 / レーザー弾");
    await expect(page.locator(".setup-preview-pane canvas")).toHaveAttribute("data-closeup", "true");
    await expect(page.getByLabel("solo map")).toHaveCount(0);
    await expect(page.locator(".setup-preview-pane canvas")).toHaveAttribute("data-demo", "");
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page.getByRole("button", { name: "色を変更" }).click();
    await expect(colors.getByRole("radio", { name: "カラー2 cyan", exact: true })).toBeChecked();
    await colors.getByRole("button", { name: "完了" }).click();
    const summary = page.getByTestId("loadout-summary");
    expect((await summary.boundingBox())!.height).toBeLessThan(24);
    expect(await summary.locator("..").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/setup-compact-${viewport.width}.png` });
  });
}

test("プラクティスは谷マップの独立画面で開く", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("solo").click();
  await expect(page.locator(".game-root .map-area canvas")).toBeVisible();
  await expect(page.locator(".setup")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__fortress?.getView().phase)).toBe("acting");
});
