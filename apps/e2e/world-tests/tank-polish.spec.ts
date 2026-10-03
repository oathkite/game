import { expect, test } from "@playwright/test";
import { customizeTank, startFreePractice } from "./practiceFlow";

// 移動の残りと地形のマスクは開発用のフック（window.__fortress）で読むので、dev サーバーで確かめる。
test("custom colors and skins persist, hints are absent, and a held key continues after a fall", async ({ page }) => {
  await page.setViewportSize({ width:1280, height:800 });
  await page.goto("/");
  await page.getByRole("button", { name:"はじめる", exact:true }).click();
  await expect(page.getByText("操作のヒント", { exact:true })).toHaveCount(0);
  await customizeTank(page, { primary:"purple", secondary:"orange", turret:"オニオン", frame:"多脚" });
  await page.reload();
  await page.getByRole("button", { name:"はじめる", exact:true }).click();
  await page.getByRole("button", { name:"機体をカスタマイズ", exact:true }).click();
  const dialog = page.getByRole("dialog", { name:"機体のカスタマイズ" });
  await expect(dialog.getByRole("radiogroup", { name:"カラー2" }).getByRole("radio", { name:"purple", exact:true })).toHaveAttribute("aria-checked","true");
  await expect(dialog.getByRole("radiogroup", { name:"足回り" }).getByRole("radio", { name:"多脚", exact:true })).toHaveAttribute("aria-checked","true");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await startFreePractice(page);
  const field = page.getByTestId("camera-world");
  expect(await page.evaluate(() => window.__fortress!.getView().players![0].colors)).toEqual({ primary:"purple", secondary:"orange", turret:"onion", frame:"walker" });
  await page.screenshot({ path:"test-results/tank-polish-desktop.png" });
  // Install a deterministic nonlethal cliff in the client input fixture.
  // Authoritative acceptance of the same fall is covered by multiplayer-movement.test.ts.
  await page.evaluate(() => {
    const v = window.__fortress!.getView(), mask = v.mask!, pos = v.control!;
    const cells = new Uint8Array(mask.width * mask.height);
    for(let y=0;y<mask.height;y++) for(let x=0;x<mask.width;x++) cells[y*mask.width+x] = y >= (x < pos.x+2 ? pos.y : pos.y+12) ? 1 : 0;
    Object.assign(v, { mask: { ...mask,cells } });
  });
  await page.keyboard.down("ArrowRight");
  await expect(field).toHaveAttribute("data-falling","true");
  await expect.poll(() => page.evaluate(() => window.__fortress!.getView().control!.stepsLeft)).toBeLessThan(28);
  await page.keyboard.up("ArrowRight");
  const remaining = await page.evaluate(() => window.__fortress!.getView().control!.stepsLeft);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__fortress!.getView().control!.stepsLeft)).toBe(remaining);
});
