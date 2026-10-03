import { expect, test } from "@playwright/test";
for (const viewport of [{ width:1440,height:900 },{ width:667,height:375 },{ width:390,height:844 }]) {
  test(`lobby replaces hints with a usable tank customizer at ${viewport.width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch:viewport.width<1000, locale:"ja-JP" });
    const page = await context.newPage();
    try {
      await page.goto("/");
      await page.getByRole("button", { name:"はじめる",exact:true }).click();
      await expect(page.locator(".practice-guide")).toHaveCount(0);
      await expect(page.getByRole("combobox", { name:"装備 1", exact:true })).toBeHidden();
      const customize = page.getByRole("button", { name:"機体をカスタマイズ",exact:true });
      const button = page.getByRole("button", { name:"プラクティス",exact:true });
      for (const control of [customize,button,page.getByRole("button", { name:"出撃",exact:true })]) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
      }
      await page.locator(".world-shutter").evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
      await page.screenshot({ path:`test-results/tank-lobby-${viewport.width}.png` });
      // モーダルの色見本は正方形で、10 色そろい、完了ボタンはスクロールせずに押せる
      await customize.click();
      const dialog = page.getByRole("dialog", { name:"機体のカスタマイズ" });
      await expect(dialog.getByRole("radiogroup", { name:"カラー1" }).getByRole("radio")).toHaveCount(10);
      const color = dialog.getByRole("radiogroup", { name:"カラー2" }).getByRole("radio", { name:"purple",exact:true });
      await color.click();
      await expect(color).toHaveAttribute("aria-checked","true");
      const swatch = (await color.boundingBox())!;
      expect(swatch.width).toBe(swatch.height);
      const done = (await dialog.getByRole("button", { name:"完了",exact:true }).boundingBox())!;
      expect(done.y + done.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({ path:`test-results/tank-customizer-${viewport.width}.png` });
    } finally { await context.close(); }
  });
}
