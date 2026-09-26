import { describe, expect, it } from "vitest";
import { carve, maskFromHeights, type TerrainMask } from "@game/sim";
import { isPaletteColor, PALETTE } from "@/game/palette";
import { createGrid, getPixel, TRANSPARENT, type PixelGrid } from "@/game/pixelGrid";
import { changedRect, paintTerrain, TERRAIN_THEMES, terrainDepth, TEXELS, type TerrainTheme } from "@/game/terrainPaint";

// 地形の塗り分け。設計書 40.6。1 セルを 4 × 4 texel で塗り、地形 mask の外は塗らない

const flat = (width = 40, height = 30, surface = 10): TerrainMask => maskFromHeights(Array.from({ length: width }, () => surface), height);

const paint = (mask: TerrainMask, theme: TerrainTheme = "ridge", original: TerrainMask = mask): PixelGrid => {
  const grid = createGrid(0, 0, mask.width * TEXELS, mask.height * TEXELS);
  paintTerrain({ mask, original, depth: terrainDepth(original), theme }, grid);
  return grid;
};

describe("terrainDepth", () => {
  it("最初の地形で、真上の空気から何セル下かを数える。空気は 0、上限は 15", () => {
    const depth = terrainDepth(flat(4, 30, 10));
    expect(depth[9 * 4]).toBe(0);
    expect(depth[10 * 4]).toBe(0);
    expect(depth[11 * 4]).toBe(1);
    expect(depth[29 * 4]).toBe(15);
  });
});

describe("paintTerrain", () => {
  it("地形 mask の中だけを塗り、空気のセルは透明のまま", () => {
    const grid = paint(flat());
    for (let x = 0; x < 40 * TEXELS; x += 3) {
      expect(getPixel(grid, x, 10 * TEXELS - 1)).toBe(TRANSPARENT);
      expect(getPixel(grid, x, 10 * TEXELS)).not.toBe(TRANSPARENT);
    }
  });
  it("最初の地形の上面は草で、先端の行は緑（花を除く）", () => {
    const grid = paint(flat());
    const tips = Array.from({ length: 40 * TEXELS }, (_, x) => getPixel(grid, x, 10 * TEXELS));
    const greens = new Set<number>([PALETTE.green, PALETTE.greenLight]);
    expect(tips.filter(c => greens.has(c)).length).toBeGreaterThan(tips.length * 0.85);
    // 草の下は土
    expect(getPixel(grid, 5, 13 * TEXELS)).not.toBe(PALETTE.green);
  });
  it("削れた口は草を生やさず、焦げた縁にする", () => {
    const original = flat();
    const mask = carve(original, { cx: 20, cy: 10, radius: 4 });
    const grid = paint(mask, "ridge", original);
    // 穴の底（x 20 の列の最初の地面）の先端の texel
    let y = 0;
    while (!mask.cells[y * mask.width + 20]) y++;
    const top = getPixel(grid, 20 * TEXELS + 1, y * TEXELS);
    expect([PALETTE.green, PALETTE.greenLight]).not.toContain(top);
    expect(top).toBe(TERRAIN_THEMES.ridge.charred);
  });
  it("描いた texel はすべて固定パレットの色", () => {
    const original = maskFromHeights(Array.from({ length: 60 }, (_, x) => 8 + Math.round(4 * Math.sin(x / 5))), 40);
    const mask = carve(carve(original, { cx: 12, cy: 10, radius: 5 }), { cx: 40, cy: 20, radius: 6 });
    for (const theme of Object.keys(TERRAIN_THEMES) as TerrainTheme[]) {
      const grid = paint(mask, theme, original);
      for (const color of grid.pixels) if (color !== TRANSPARENT) expect(isPaletteColor(color), `${theme} 0x${color.toString(16)}`).toBe(true);
    }
  });
  it("ステージごとに地中でいちばん多い色が違う", () => {
    const dominant = (theme: TerrainTheme): number => {
      const counts = new Map<number, number>();
      for (const c of paint(flat(), theme).pixels.slice(40 * TEXELS * 14 * TEXELS)) if (c !== TRANSPARENT) counts.set(c, (counts.get(c) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    };
    const themes: TerrainTheme[] = ["ridge", "canyon", "basin", "islands"];
    expect(new Set(themes.map(dominant)).size).toBe(4);
  });
  it("格子の一部だけを塗っても、全体を塗ったときと同じ色になる", () => {
    const mask = carve(flat(), { cx: 18, cy: 12, radius: 5 });
    const whole = paint(mask);
    const part = createGrid(15 * TEXELS, 8 * TEXELS, 10 * TEXELS, 9 * TEXELS);
    paintTerrain({ mask, original: flat(), depth: terrainDepth(flat()), theme: "ridge" }, part);
    const reference = paint(mask, "ridge", flat());
    for (let y = part.top; y < part.top + part.height; y++) for (let x = part.left; x < part.left + part.width; x++) {
      expect(getPixel(part, x, y)).toBe(getPixel(reference, x, y));
    }
    expect(whole.width).toBe(40 * TEXELS);
  });
  it("同じ入力なら同じ絵になる（乱数を使わない）", () => {
    expect(Array.from(paint(flat(), "islands").pixels).join()).toBe(Array.from(paint(flat(), "islands").pixels).join());
  });
});

describe("changedRect", () => {
  it("変わったセルを囲む矩形に余白を足し、地形の範囲に収める。変わっていなければ null", () => {
    const before = flat(), after = carve(before, { cx: 20, cy: 12, radius: 2 });
    expect(changedRect(before, before, 1)).toBeNull();
    expect(changedRect(before, after, 1)).toEqual({ left: 17, top: 9, width: 7, height: 7 });
    const corner = carve(before, { cx: 0, cy: 29, radius: 1 });
    expect(changedRect(before, corner, 1)).toEqual({ left: 0, top: 27, width: 3, height: 3 });
  });
});
