import { expect, test } from "@playwright/test";
import { openFreePracticeSetup } from "../world-tests/practiceFlow";

const loadouts = [["cannon", "triple"], ["multiple", "drill"], ["laser", "digger"], ["floater", "stinger"]] as const;
for (const [first, second] of loadouts) {
  test(`weapon HUD shows ${first}/${second} and selects both shortcuts`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "はじめる", exact: true }).click();
    // 装備は自由練習の設定画面で選ぶ（37章）。既定の装備と重なる枠の入れ替えも含めて、実際の UI で選ぶ。
    await openFreePracticeSetup(page);
    await page.getByRole("combobox", { name: "装備 1", exact: true }).selectOption(first);
    await page.getByRole("combobox", { name: "装備 2", exact: true }).selectOption(second);
    await page.getByRole("button", { name: "自由練習をはじめる", exact: true }).click();
    await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
    await expect(page.getByTestId("camera-world")).toHaveAttribute("data-opening", "false", { timeout: 15000 });
    const buttons = page.locator(".battle-weapons button");
    await expect(buttons).toHaveCount(2);
    for (const width of [1440, 667]) {
      const height = width === 1440 ? 900 : 375;
      await page.setViewportSize({ width, height });
      await page.keyboard.press("e");
      await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
      await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "false");
      await page.keyboard.press("q");
      await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "true");
      await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "false");
      for (const button of await buttons.all()) {
        const box = (await button.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
      }
      await page.locator(".battle-weapons").screenshot({ path: testInfo.outputPath(`weapons-${width}.png`) });
    }
  });
}
