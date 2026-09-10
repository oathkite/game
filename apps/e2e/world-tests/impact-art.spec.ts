import { expect, test } from "@playwright/test";
test("digger uses the same authored explosion as cannon while drill and laser remain distinct", async ({ page }) => {
  await page.goto("/?prototype=world");
  const result = await page.evaluate(async () => {
    const source = "/src/worldUi/impactSprites.ts";
    const { loadImpactArt } = await import(/* @vite-ignore */ source);
    const art = await loadImpactArt();
    const same = (a: string, b: string) => art.textures[a].every((texture: unknown, i: number) => texture === art.textures[b][i]);
    const result = { digger: same("digger", "cannon"), drill: same("drill", "cannon"), laser: same("laser", "cannon") };
    art.destroy();
    return result;
  });
  expect(result).toEqual({ digger: true, drill: false, laser: false });
});
