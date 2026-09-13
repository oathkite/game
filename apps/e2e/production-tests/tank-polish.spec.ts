import { expect, test } from "@playwright/test";

test("custom colors persist, hints are absent, and a held key continues after a fall", async ({ page }) => {
  await page.setViewportSize({ width:1280, height:800 });
  await page.goto("/");
  await page.getByRole("button", { name:"はじめる", exact:true }).click();
  await expect(page.getByText("操作のヒント", { exact:true })).toHaveCount(0);
  await page.getByRole("radiogroup", { name:"車体色" }).getByRole("radio", { name:"purple", exact:true }).click();
  await page.getByRole("radiogroup", { name:"砲塔色" }).getByRole("radio", { name:"orange", exact:true }).click();
  await page.reload();
  await page.getByRole("button", { name:"はじめる", exact:true }).click();
  await expect(page.getByRole("radiogroup", { name:"車体色" }).getByRole("radio", { name:"purple", exact:true })).toHaveAttribute("aria-checked","true");
  await page.getByRole("button", { name:"プラクティス", exact:true }).click(); await page.getByRole("button", { name: "練習開始", exact: true }).click();
  const field = page.getByTestId("camera-world");
  await expect(field).toHaveAttribute("data-opening","false",{ timeout:15000 });
  expect(await page.evaluate(() => window.__fortress!.getView().players![0].colors)).toEqual({ primary:"purple", secondary:"orange" });
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
