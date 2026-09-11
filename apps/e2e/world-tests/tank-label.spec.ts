import { expect, test } from "@playwright/test";

test("camera offsets keep visible tank plates in bounds without accumulating correction", async ({ page }) => {
  await page.goto("/?prototype=world");
  const result = await page.evaluate(async () => {
    const path = "/src/game/renderer.ts";
    const { createRenderer } = await import(path);
    const host = document.createElement("div"); document.body.append(host);
    const r = await createRenderer({ host, layout: { cell: 8, mapWidth: 667, mapHeight: 159 },
      mask: { width: 100, height: 50, cells: new Uint8Array(5000).fill(1) },
      players: [{ nickname: "Label", colors: { primary: "yellow", secondary: "blue" } }] });
    r.setTank(0, { x: 40, y: 8, tilt: 0, facing: 1, elevation: 45, hp: 100, visible: true, flash: false, aiming: false });
    const label = r.app.stage.children[1].children[0];
    const read = () => { const b = label.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    const initial = read();
    r.setCameraOffset(-500, -500); const outside = read();
    r.setCameraOffset(0, 0); const restored = read();
    r.setCameraOffset(0, 0); const repeated = read();
    r.destroy(); host.remove();
    return { initial, outside, restored, repeated };
  });
  expect(result.initial.y).toBeGreaterThanOrEqual(4);
  expect(result.initial.y + result.initial.height).toBeLessThanOrEqual(155);
  expect(result.outside.x + result.outside.width).toBeLessThan(0);
  expect(result.restored).toEqual(result.initial);
  expect(result.repeated).toEqual(result.initial);
});
