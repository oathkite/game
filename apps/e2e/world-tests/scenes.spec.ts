import { expect, test } from "@playwright/test";
for (const size of [{ width: 1440, height: 900 }, { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 390, height: 844 }]) {
  test(`world scenes at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/?prototype=world");
    await page.screenshot({ path: `test-results/world-start-${size.width}.png` });
    await page.getByRole("button", { name: "はじめる", exact: true }).click();
    await expect(page.getByRole("heading", { name: "出発の準備" })).toBeVisible();
    await page.getByRole("textbox", { name: "名前" }).fill("ケロテスト");
    await expect(page.getByRole("combobox", { name: "装備 2" }).locator('option[value="cannon"]')).toHaveJSProperty("disabled", true);
    await page.getByRole("button", { name: "設定", exact: true }).click();
    await expect(page.getByRole("heading", { name: "整備と設定" })).toBeVisible();
    await page.locator(".world-shutter").evaluate(e => Promise.all(e.getAnimations().map(a => a.finished)));
    await page.screenshot({ path: `test-results/world-settings-${size.width}.png` });
    await page.getByRole("button", { name: "音を消す" }).click();
    await expect(page.getByRole("button", { name: "音を出す" })).toBeVisible();
    await page.getByRole("button", { name: "ロビーに戻る" }).click();
    await expect(page.getByRole("textbox", { name: "名前" })).toHaveValue("ケロテスト");
    const start = page.getByRole("button", { name: "プラクティスへ" });
    const box = await start.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    await expect(page.locator(".tank-portrait")).toHaveAttribute("data-loaded", "true");
    await page.screenshot({ path: `test-results/world-lobby-${size.width}.png` });
    if (size.width > size.height) {
      await start.click();
      await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
      await expect(page.getByTestId("world-wind")).toBeVisible();
      for (const label of ["左へ移動", "右へ移動", "角度を下げる", "角度を上げる", "発射"]) {
        const control = (await page.getByRole("button", { name: label, exact: true }).boundingBox())!;
        expect(control.width).toBeGreaterThanOrEqual(44); expect(control.height).toBeGreaterThanOrEqual(44);
        expect(control.x).toBeGreaterThanOrEqual(0); expect(control.x + control.width).toBeLessThanOrEqual(size.width);
        expect(control.y + control.height).toBeLessThanOrEqual(size.height);
      }
      await page.screenshot({ path: `test-results/world-battle-${size.width}.png` });
      if (size.width === 1440) {
        await page.getByRole("button", { name: "設定を開く" }).click();
        await page.getByRole("button", { name: "降参して対戦を終える" }).click();
        await expect(page.getByRole("heading", { name: /の勝利/ })).toBeVisible();
        await expect(page.locator(".tank-portrait")).toHaveAttribute("data-loaded", "true");
        await page.screenshot({ path: "test-results/world-result-1440.png" });
        await page.getByRole("button", { name: "もう一度プレイ" }).click();
        await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
      }
      await page.getByRole("button", { name: "設定を開く" }).click();
      await page.getByRole("button", { name: "ロビーに戻る" }).click();
      await expect(page.getByRole("heading", { name: "出発の準備" })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

test("terrain art preserves collision alpha after carving and ordinary terrain stays white", async ({ page }) => {
  await page.goto("/?prototype=world");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/game/terrainLayer.ts";
    const { createTerrainLayer } = await import(modulePath);
    const tile = document.createElement("canvas"); tile.width = tile.height = 8;
    tile.getContext("2d")!.fillRect(0, 0, 8, 8);
    const mask = { width: 8, height: 8, cells: new Uint8Array(64).fill(1) };
    const carved = { ...mask, cells: new Uint8Array(mask.cells) }; carved.cells[27] = 0;
    const layer = createTerrainLayer(mask, tile); layer.update(carved);
    const canvas = layer.sprite.texture.source.resource as HTMLCanvasElement;
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, 32, 32).data;
    const matches = Array.from({ length: 64 }, (_, i) => pixels[((Math.floor(i / 8) * 4 + 2) * 32 + i % 8 * 4 + 2) * 4 + 3] === carved.cells[i]! * 255).every(Boolean);
    layer.destroy();
    const plain = createTerrainLayer(carved);
    const plainCanvas = plain.sprite.texture.source.resource as HTMLCanvasElement;
    const white = Array.from(plainCanvas.getContext("2d")!.getImageData(0, 0, 1, 1).data);
    plain.destroy();
    return { matches, white };
  });
  expect(result).toEqual({ matches: true, white: [255, 255, 255, 255] });
});
