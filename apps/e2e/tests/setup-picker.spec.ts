import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 360, height: 640 }, { width: 667, height: 375 }, { width: 1400, height: 800 }]) {
  test(`設定の選択肢はモーダルで変更する ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page.getByRole("button", { name: "色を変更" }).click();
    const colors = page.getByRole("dialog", { name: "色を変更" });
    await expect(colors.getByRole("button", { name: "完了" })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/color-picker-${viewport.width}.png` });
    await colors.getByRole("radio", { name: "副色（砲塔） blue", exact: true }).click();
    await colors.getByRole("radio", { name: "主色（車体） cyan", exact: true }).click();
    await colors.getByRole("button", { name: "完了" }).click();
    await expect(page.getByRole("button", { name: "色を変更" })).toBeFocused();
    await page.getByRole("button", { name: "武器を変更" }).click();
    const weapons = page.getByRole("dialog", { name: "武器を変更" });
    await expect(weapons.getByRole("button", { name: "完了" })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/weapon-picker-${viewport.width}.png` });
    await weapons.getByRole("radio", { name: "武器 1 digger", exact: true }).click();
    await expect(weapons.getByRole("radio", { name: "武器 2 cannon", exact: true })).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "武器を変更" })).toBeFocused();
    await expect(page.getByTestId("loadout-summary")).toContainText("掘削弾");
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page.getByRole("button", { name: "色を変更" }).click();
    await expect(colors.getByRole("radio", { name: "主色（車体） cyan", exact: true })).toBeChecked();
    await colors.getByRole("button", { name: "完了" }).click();
    await page.screenshot({ path: `test-results/setup-compact-${viewport.width}.png` });
  });
}
