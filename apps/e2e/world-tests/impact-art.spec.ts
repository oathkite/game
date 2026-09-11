import { expect, test } from "@playwright/test";
test("digger uses the same authored explosion as cannon while drill and laser remain distinct", async ({ page }) => {
  await page.goto("/?prototype=world");
  const result = await page.evaluate(async () => {
    const source = "/src/worldUi/impactSprites.ts";
    const { loadImpactArt } = await import(/* @vite-ignore */ source);
    const art = await loadImpactArt();
    const same = (a: string, b: string) => art.textures[a].every((texture: unknown, i: number) => texture === art.textures[b][i]);
    const result = { digger: same("digger", "cannon"), drill: same("drill", "cannon"), laser: same("laser", "cannon"), floater: same("floater", "laser") };
    art.destroy();
    return result;
  });
  expect(result).toEqual({ digger: true, drill: false, laser: false, floater: true });
});
test("all eight weapons render authored bullets and four impact frames", async ({ page }) => {
  await page.goto("/?prototype=world");
  const result = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const [{ loadProjectileArt }, { loadImpactArt }, { createProjectileView }] = await Promise.all([
      load("/src/worldUi/projectileArt.ts"), load("/src/worldUi/impactSprites.ts"), load("/src/game/projectileView.ts"),
    ]);
    const bullets = await loadProjectileArt(), impacts = await loadImpactArt();
    const result = Object.keys(bullets).map(weapon => {
      const view = createProjectileView(0xffffff, weapon, bullets[weapon], impacts.textures[weapon]);
      view.setBullet(0, 10, 10, 0);
      for (let frame = 0; frame < 4; frame++) view.setBlast(String(frame), 20 + frame * 15, 10, 10, true, false, frame);
      const layers = view.container.children;
      const bullet = layers[4].children[0];
      const frames = layers[1].children;
      const valid = bullet.texture === bullets[weapon] && frames.length === 4 && frames.every((sprite: { texture: unknown; visible: boolean }, i: number) => sprite.visible && sprite.texture === impacts.textures[weapon][i]);
      view.destroy();
      return { weapon, valid };
    });
    impacts.destroy();
    return result;
  });
  expect(result).toHaveLength(8);
  expect(result.every(item => item.valid)).toBe(true);
});
