import { expect, test } from "@playwright/test";

test("SVG pilot uploads again after leaving and reentering practice", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const state = window as Window & { pilotUploads?: number };
    state.pilotUploads = 0;
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const original = prototype.texImage2D;
      prototype.texImage2D = function (this: WebGLRenderingContext | WebGL2RenderingContext, ...args: Parameters<typeof original>) {
        if (args.some(value => value instanceof HTMLImageElement && (value.src.includes("pilot-frog") || value.src.startsWith("data:image/svg+xml")))) state.pilotUploads!++;
        return Reflect.apply(original, this, args);
      } as typeof original;
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  for (let visit = 0; visit < 2; visit++) {
    await expect(page.locator(".tank-portrait")).toHaveAttribute("data-loaded", "true");
    const before = await page.evaluate(() => (window as Window & { pilotUploads?: number }).pilotUploads!);
    await page.getByRole("button", { name: "プラクティスへ", exact: true }).click();
    await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
    await expect.poll(() => page.evaluate(() => (window as Window & { pilotUploads?: number }).pilotUploads!)).toBeGreaterThan(before);
    await page.locator(".world-shutter").evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)));
    await page.screenshot({ path: `test-results/pilot-${info.project.name}-${visit}.png` });
    await page.getByRole("button", { name: "設定を開く", exact: true }).click();
    await page.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
  }
  expect(errors).toEqual([]);
});
