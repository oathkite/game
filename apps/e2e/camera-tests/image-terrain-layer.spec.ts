import { expect, test } from "@playwright/test";
test("image alpha and circular destruction stay aligned across texture chunks and restore", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/game/imageTerrainLayer.ts";
    const { createImageTerrainLayer } = await import(modulePath);
    const original = { width: 140, height: 20, cells: new Uint8Array(2800).fill(1) };
    const art = document.createElement("canvas"); art.width = 140; art.height = 20;
    art.getContext("2d")!.fillRect(2, 2, 136, 16);
    const layer = createImageTerrainLayer(original, art);
    const alpha = (x: number, y: number) => {
      const chunk = Math.floor(x / 128);
      const canvas = layer.sprite.children[chunk].texture.source.resource as HTMLCanvasElement;
      return canvas.getContext("2d")!.getImageData((x % 128) * 12 + 6, y * 12 + 6, 1, 1).data[3];
    };
    const initialEdge = alpha(0, 0);
    const cut = { cx: 127, cy: 10, radius: 4 }, next = { ...original, cells: original.cells.slice() };
    for (let y = 0; y < 20; y++) for (let x = 0; x < 140; x++) if ((x - cut.cx) ** 2 + (y - cut.cy) ** 2 <= cut.radius ** 2) next.cells[y * 140 + x] = 0;
    layer.update(next, cut);
    const across = [alpha(126, 10), alpha(128, 10)], untouched = alpha(100, 10);
    layer.update({ ...next, cells: next.cells.slice() });
    const persists = alpha(128, 10);
    layer.update(original);
    const restored = alpha(128, 10), restoredEdge = alpha(0, 0);
    layer.destroy();
    return { initialEdge, across, untouched, persists, restored, restoredEdge };
  });
  expect(result).toEqual({ initialEdge: 0, across: [0, 0], untouched: 255, persists: 0, restored: 255, restoredEdge: 0 });
});
