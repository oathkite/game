import { expect, test } from "@playwright/test";
test("image alpha and circular destruction stay aligned across texture chunks and restore", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/game/imageTerrainLayer.ts";
    const { createImageTerrainLayer } = await import(modulePath);
    const original = { width: 140, height: 20, cells: new Uint8Array(2800).fill(1) };
    const art = document.createElement("canvas"); art.width = 140; art.height = 20;
    art.getContext("2d")!.fillStyle = "#ffffff";
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
    const edgeCanvas = layer.sprite.children[1].texture.source.resource as HTMLCanvasElement;
    const outsideCutColor = Array.from(edgeCanvas.getContext("2d")!.getImageData(49, 126, 1, 1).data);
    const across = [alpha(126, 10), alpha(128, 10)], untouched = alpha(100, 10);
    layer.update({ ...next, cells: next.cells.slice() });
    const persists = alpha(128, 10);
    layer.update(original);
    const restored = alpha(128, 10), restoredEdge = alpha(0, 0);
    layer.destroy();
    return { outsideCutColor, initialEdge, across, untouched, persists, restored, restoredEdge };
  });
  expect(result).toEqual({ outsideCutColor: [255, 255, 255, 255], initialEdge: 0, across: [0, 0], untouched: 255, persists: 0, restored: 255, restoredEdge: 0 });
});

test("reconnection and history rewind reproduce the same circular artwork cuts", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const path = "/src/game/imageTerrainLayer.ts";
    const { createImageTerrainLayer } = await import(path);
    const original = { width: 140, height: 20, cells: new Uint8Array(2800).fill(1) };
    const art = document.createElement("canvas"); art.width = 140; art.height = 20;
    art.getContext("2d")!.fillRect(0, 0, 140, 20);
    const live = createImageTerrainLayer(original, art), resumed = createImageTerrainLayer(original, art);
    const cuts = [{ cx: 127, cy: 10, radius: 4 }, { cx: 119, cy: 8, radius: 3 }];
    const cutMask = (ops: typeof cuts) => {
      const mask = { ...original, cells: original.cells.slice() };
      for (let y = 0; y < 20; y++) for (let x = 0; x < 140; x++) {
        if (ops.some(op => (x - op.cx) ** 2 + (y - op.cy) ** 2 <= op.radius ** 2)) mask.cells[y * 140 + x] = 0;
      }
      return mask;
    };
    const first = cutMask(cuts.slice(0, 1)), final = cutMask(cuts);
    const pixels = (layer: typeof live) => layer.sprite.children.map((child: any) => {
      const canvas = child.texture.source.resource as HTMLCanvasElement;
      return canvas.toDataURL();
    });
    live.update(first, cuts[0]); const firstPixels = pixels(live);
    live.update(final, cuts[1]);
    resumed.update(final, undefined, cuts);
    const same = JSON.stringify(pixels(live)) === JSON.stringify(pixels(resumed));
    resumed.update(first, undefined, cuts.slice(0, 1));
    const rewind = JSON.stringify(firstPixels) === JSON.stringify(pixels(resumed));
    resumed.update(original, undefined, []);
    const fresh = createImageTerrainLayer(original, art);
    const reset = JSON.stringify(pixels(fresh)) === JSON.stringify(pixels(resumed));
    live.destroy(); resumed.destroy(); fresh.destroy();
    return { same, rewind, reset };
  });
  expect(result).toEqual({ same: true, rewind: true, reset: true });
});
