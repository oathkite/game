import { expect, test } from "@playwright/test";

test("green pilot keeps opaque pixel art and a common seat across all sixteen frames", async ({ page }) => {
  await page.goto("/?prototype=world");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/prototype/spriteTank.ts";
    const { loadSpriteTanks } = await import(modulePath);
    const factory = await loadSpriteTanks();
    const tank = factory.create({}, "pilot");
    const pilot = tank.world.children[0].getChildByLabel("body").getChildByLabel("pilot");
    const image = pilot.texture.source.resource as HTMLImageElement;
    const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 640;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, 768, 640).data;
    let partial = false, outside = false;
    const frames = Array.from({ length: 16 }, (_, frame) => {
      let green = 0, cloth = 0, bottom = -1;
      for (let y = 0; y < 160; y++) for (let x = 0; x < 192; x++) {
        const at = ((Math.floor(frame / 4) * 160 + y) * 768 + frame % 4 * 192 + x) * 4;
        const [r, g, b, a] = pixels.slice(at, at + 4);
        if (a !== 0 && a !== 255) partial = true;
        if (!a) continue;
        if (x < 40 || x > 82 || y < 55 || y > 101) outside = true;
        bottom = Math.max(bottom, y);
        if (g! > r! * 1.15 && g! > b! * 1.5) green++;
        if (r === 102 && g === 103 && b === 56) cloth++;
      }
      return { green, cloth, bottom };
    });
    const size = [image.naturalWidth, image.naturalHeight];
    tank.destroy(); factory.destroy();
    return { frames, partial, outside, size };
  });
  expect(result.size).toEqual([768, 640]);
  expect(result.partial).toBe(false); expect(result.outside).toBe(false);
  for (const frame of result.frames) {
    expect(frame.green).toBeGreaterThan(20); expect(frame.cloth).toBeGreaterThan(10);
    expect(frame.bottom).toBe(100);
  }
});
