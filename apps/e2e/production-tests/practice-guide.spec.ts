import { expect, test } from "@playwright/test";
for (const viewport of [{ width:1440,height:900 },{ width:667,height:375 },{ width:390,height:844 }]) {
  test(`lobby replaces hints with usable color controls at ${viewport.width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch:viewport.width<1000, locale:"ja-JP" });
    const page = await context.newPage();
    try {
      await page.goto("/");
      await page.getByRole("button", { name:"はじめる",exact:true }).click();
      await expect(page.locator(".practice-guide")).toHaveCount(0);
      await expect(page.getByRole("radiogroup", { name:"車体色" }).getByRole("radio")).toHaveCount(10);
      await expect(page.getByRole("combobox", { name:"装備 1", exact:true })).toBeHidden();
      const color = page.getByRole("radiogroup", { name:"砲塔色" }).getByRole("radio", { name:"purple",exact:true });
      await color.click();
      await expect(color).toHaveAttribute("aria-checked","true");
      const button = page.getByRole("button", { name:"プラクティス",exact:true });
      const swatch = (await color.boundingBox())!;
      expect(swatch.width).toBe(swatch.height);
      for (const control of [color,button,page.getByRole("button", { name:"出撃",exact:true })]) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
      }
      await page.locator(".world-shutter").evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
      await page.screenshot({ path:`test-results/tank-lobby-${viewport.width}.png` });
    } finally { await context.close(); }
  });
}
