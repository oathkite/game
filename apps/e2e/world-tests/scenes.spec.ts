import { expect, test } from "@playwright/test";
for (const size of [{ width: 1440, height: 900 }, { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 390, height: 844 }]) {
  test.describe(`input ${size.width}`, () => {
  test.use({ hasTouch: size.width < 1000 });
  test(`world scenes at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/?prototype=world");
    const logo = page.getByRole("img", { name: "KEROPOD（ケロポッド）", exact: true });
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1536);
    const title = (await page.getByRole("heading", { name: "KEROPOD（ケロポッド）", exact: true }).boundingBox())!;
    const begin = (await page.getByRole("button", { name: "はじめる", exact: true }).boundingBox())!;
    expect(title.x).toBeGreaterThanOrEqual(0); expect(title.x + title.width).toBeLessThanOrEqual(size.width);
    expect(title.y + title.height).toBeLessThanOrEqual(begin.y);
    expect(begin.y + begin.height).toBeLessThanOrEqual(size.height - 32);
    await page.screenshot({ path: `test-results/world-start-${size.width}.png` });
    await page.getByRole("button", { name: "はじめる", exact: true }).click();
    await expect(page.getByRole("heading", { name: "出発の準備" })).toBeVisible();
    await page.getByRole("textbox", { name: "名前" }).fill("ケロテスト");
    await expect(page.getByRole("combobox", { name: "装備 2" }).locator('option[value="cannon"]')).toHaveJSProperty("disabled", true);
    await page.getByRole("button", { name: "設定", exact: true }).click();
    await expect(page.getByRole("heading", { name: "整備と設定" })).toBeVisible();
    await page.locator(".world-shutter").evaluate(e => Promise.all(e.getAnimations().map(a => a.finished)));
    await page.screenshot({ path: `test-results/world-settings-${size.width}.png` });
    await page.getByRole("combobox", { name: "機体の表示サイズ" }).selectOption("9");
    await page.getByRole("combobox", { name: "機体の表示サイズ" }).selectOption("12");
    await page.getByRole("button", { name: "音を消す" }).click();
    await expect(page.getByRole("button", { name: "音を出す" })).toBeVisible();
    await page.getByRole("button", { name: "ロビーに戻る" }).click();
    await expect(page.getByRole("textbox", { name: "名前" })).toHaveValue("ケロテスト");
    const start = page.getByRole("button", { name: "プラクティスへ" });
    const box = await start.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    await expect(page.locator(".tank-portrait")).toHaveAttribute("data-loaded", "true");
    await page.locator(".world-shutter").evaluate(e => Promise.all(e.getAnimations().map(a => a.finished)));
    await page.screenshot({ path: `test-results/world-lobby-${size.width}.png` });
    if (size.width > size.height) {
      await start.click();
      await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
      await expect(page.getByTestId("world-wind")).toBeVisible();
      await expect(page.getByTestId("camera-world")).toHaveAttribute("data-scale", "12");
      if (size.width === 1440) { await expect(page.getByRole("button", { name: "発射", exact: true })).toHaveCount(0); await expect(page.locator("[data-power-tick]")).toHaveCount(101); }
      for (const label of (size.width === 1440 ? [] : ["左へ移動", "右へ移動", "角度を下げる", "角度を上げる", "発射"])) {
        const control = (await page.getByRole("button", { name: label, exact: true }).boundingBox())!;
        expect(control.width).toBeGreaterThanOrEqual(44); expect(control.height).toBeGreaterThanOrEqual(44);
        expect(control.x).toBeGreaterThanOrEqual(0); expect(control.x + control.width).toBeLessThanOrEqual(size.width);
        expect(control.y + control.height).toBeLessThanOrEqual(size.height);
      }
      await page.screenshot({ path: `test-results/world-battle-${size.width}.png` });
      if (size.width === 1440) {
        const field = page.getByTestId("camera-world");
        await page.waitForTimeout(350);
        const beforeY = Number(await field.getAttribute("data-camera-y"));
        await field.hover({ position: { x: 720, y: 350 } });
        await page.mouse.wheel(0, -60);
        await expect.poll(async () => Number(await field.getAttribute("data-camera-y"))).toBeLessThan(beforeY - 1);
        await page.getByRole("button", { name: "設定を開く" }).click();
        await page.getByRole("button", { name: "降参して対戦を終える" }).click();
        await expect(page.getByRole("heading", { name: /の勝利/ })).toBeVisible();
        await expect(page.locator('.battle-result-player[data-reaction="win"]')).toHaveCount(1);
        await expect(page.locator('.battle-result-player[data-reaction="lose"]')).toHaveCount(1);
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
  });
}

test("terrain art preserves collision alpha after carving and ordinary terrain stays white", async ({ page }) => {
  await page.goto("/?prototype=world");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/game/terrainLayer.ts";
    const { createTerrainLayer } = await import(modulePath);
    const tile = document.createElement("canvas"); tile.width = tile.height = 8;
    tile.getContext("2d")!.fillRect(0, 0, 8, 8);
    tile.getContext("2d")!.fillStyle = "#ff0000"; tile.getContext("2d")!.fillRect(0, 0, 4, 8);
    const mask = { width: 300, height: 140, cells: new Uint8Array(300 * 140).fill(1) };
    const carved = { ...mask, cells: new Uint8Array(mask.cells) };
    for (const index of [27, 127, 128, 255, 256, 127 * 300 + 128, 128 * 300 + 128]) carved.cells[index] = 0;
    const layer = createTerrainLayer(mask, tile); layer.update(carved);
    let matches = true, continuous = true;
    const chunks = layer.sprite.children.map((sprite: any) => {
      const canvas = sprite.texture.source.resource as HTMLCanvasElement;
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      const scale = canvas.width / sprite.width;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const cell = (sprite.y + Math.floor(y / scale)) * mask.width + sprite.x + Math.floor(x / scale);
        if (pixels[(y * canvas.width + x) * 4 + 3] !== carved.cells[cell]! * 255) matches = false;
      }
      for (const x of [0, canvas.width - 1]) {
        const expected = (sprite.x * scale + x) % 256 < 128 ? 255 : 0;
        if (pixels[(24 * canvas.width + x) * 4] !== expected) continuous = false;
      }
      return { scale, width: canvas.width, height: canvas.height };
    });
    layer.destroy();
    const plain = createTerrainLayer(carved);
    const plainCanvas = plain.sprite.children[0].texture.source.resource as HTMLCanvasElement;
    const white = Array.from(plainCanvas.getContext("2d")!.getImageData(0, 0, 1, 1).data);
    plain.destroy();
    return { matches, continuous, white, chunks };
  });
  expect(result.matches).toBe(true);
  expect(result.continuous).toBe(true);
  expect(result.white).toEqual([255, 255, 255, 255]);
  expect(result.chunks).toHaveLength(6);
  for (const chunk of result.chunks) {
    expect(chunk.scale).toBe(12);
    expect(chunk.width).toBeLessThanOrEqual(1536);
    expect(chunk.height).toBeLessThanOrEqual(1536);
  }
});

test("terrain only uploads changed chunks and refreshes the moss across a chunk boundary", async ({ page }) => {
  await page.goto("/?prototype=world");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/game/terrainLayer.ts";
    const { createTerrainLayer } = await import(modulePath);
    const tile = document.createElement("canvas"); tile.width = tile.height = 8;
    tile.getContext("2d")!.fillRect(0, 0, 8, 8);
    const mask = { width: 300, height: 140, cells: new Uint8Array(300 * 140).fill(1) };
    const layer = createTerrainLayer(mask, tile);
    const updates = new Array(6).fill(0);
    layer.sprite.children.forEach((sprite: any, index: number) => sprite.texture.source.on("update", () => updates[index]++));
    mask.cells[1] = 0; layer.update(mask);
    const first = [...updates]; layer.update(mask);
    const unchanged = [...updates];
    mask.cells[127 * 300 + 130] = 0; layer.update(mask);
    const boundary = [...updates];
    const canvas = layer.sprite.children[4].texture.source.resource as HTMLCanvasElement;
    const rim = Array.from(canvas.getContext("2d")!.getImageData(24, 0, 1, 1).data);
    layer.destroy();
    return { first, unchanged, boundary, rim };
  });
  expect(result.first).toEqual([1, 0, 0, 0, 0, 0]);
  expect(result.unchanged).toEqual(result.first);
  expect(result.boundary).toEqual([1, 1, 0, 0, 1, 0]);
  expect(result.rim).toEqual([116, 132, 76, 255]);
});
