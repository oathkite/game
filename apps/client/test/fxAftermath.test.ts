import type { TerrainMask } from "@game/sim";
import { describe, expect, it } from "vitest";
import { craterFlames, craterFloor, FLAME_MS, surfaceLight, wreckSmokeColumn } from "@/game/fx/aftermathFx";
import { createFrame, sampleBatch, spanOf, type ArtBounds } from "@/game/fx/particles";
import { damagePixels, DIGITS } from "@/game/damageFont";
import { PALETTE } from "@/game/palette";
import { getPixel, TRANSPARENT } from "@/game/pixelGrid";

// 評価と改善の 1 回目で足した余韻、地形への光、ダメージ数字のドット文字（設計書 41.13）

const WIDE: ArtBounds = { left: -100000, top: -100000, right: 100000, bottom: 100000 };

const ground = (width: number, height: number, top: number): TerrainMask => {
  const cells = new Uint8Array(width * height);
  for (let y = top; y < height; y++) for (let x = 0; x < width; x++) cells[y * width + x] = 1;
  return { width, height, cells } as TerrainMask;
};
const carveOut = (mask: TerrainMask, cx: number, cy: number, r: number): TerrainMask => {
  const cells = new Uint8Array(mask.cells);
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) cells[y * mask.width + x] = 0;
  return { ...mask, cells };
};

describe("craterFloor と craterFlames", () => {
  const before = ground(80, 60, 30), op = { cx: 40, cy: 30, radius: 8 };
  const after = carveOut(before, op.cx, op.cy, op.radius);
  it("クレーターのいちばん低い地表を、3 セル以上離して 3 つまで選ぶ", () => {
    const floor = craterFloor(after, op, 1);
    expect(floor.length).toBeGreaterThan(0);
    expect(floor.length).toBeLessThanOrEqual(3);
    for (const f of floor) {
      expect(after.cells[f.y * after.width + f.x]).toBe(1);
      expect(after.cells[(f.y - 1) * after.width + f.x]).toBe(0);
      expect(f.y).toBeGreaterThan(op.cy);
    }
    for (let i = 1; i < floor.length; i++) expect(Math.abs(floor[i]!.x - floor[0]!.x)).toBeGreaterThanOrEqual(3);
  });
  it("炎は約 2.5 秒燃え続け、火の粉は昇り、炎の色で冷える", () => {
    const b = craterFlames(after, op, 1);
    expect(spanOf(b)).toBeGreaterThan(FLAME_MS);
    expect(Array.from(b.vy).every((v) => v < 0)).toBe(true);
    const mid = createFrame(b.count);
    sampleBatch(b, FLAME_MS / 2, WIDE, mid);
    expect(mid.n).toBeGreaterThan(0);
    expect(b.ramps[0]![0]).toBe(PALETTE.fire1);
  });
  it("削れていなければ（床が爆風の外なら）炎を出さない", () => {
    const air = { width: 20, height: 20, cells: new Uint8Array(400) } as TerrainMask;
    expect(craterFlames(air, { cx: 10, cy: 10, radius: 4 }, 1).count).toBe(0);
  });
});

describe("wreckSmokeColumn", () => {
  it("3.5 秒かけて 40 粒の黒煙を昇らせ、根元の暗い灰から明るく、4 → 6 → 8 art px と膨らませる", () => {
    const b = wreckSmokeColumn(10, 20, 1);
    expect(b.count).toBe(40);
    expect(spanOf(b)).toBeGreaterThan(3500);
    expect(b.ramps[0]![0]).toBe(PALETTE.smoke3);
    expect(b.sizes).toEqual([4, 6, 8]);
    const f = createFrame(b.count);
    sampleBatch(b, b.t0[0]! + b.life[0]! * 0.9, WIDE, f);
    expect(Math.max(...Array.from(f.size.subarray(0, f.n)))).toBe(8);
  });
});

describe("surfaceLight", () => {
  const mask = ground(60, 40, 20);
  it("上面の縁の 2 texel を、中心ほど濃い 3 段で照らす", () => {
    const b = surfaceLight(mask, 30, 19, 24, PALETTE.fire2, PALETTE.fire3);
    expect(b.count).toBeGreaterThan(0);
    for (let i = 0; i < b.count; i++) expect([80, 81]).toContain(b.y0[i]);
    const cx = 122, near = Array.from(b.x0).filter((x) => Math.abs(x - cx) < 12).length, far = Array.from(b.x0).filter((x) => Math.abs(x - cx) > 30).length;
    expect(near / (2 * 12 * 2)).toBeGreaterThan(far / (2 * (43 - 30) * 2));
    expect(Array.from({ length: b.count }, (_, i) => b.ramps[b.ramp[i]!]![0])).toContain(PALETTE.fire2);
  });
  it("爆心を向いた横の面も照らし、背を向けた面は照らさない", () => {
    // 爆心の右に立つ壁。左の面が爆心を向く
    const cells = new Uint8Array(60 * 40);
    for (let y = 10; y < 40; y++) for (let x = 36; x < 60; x++) cells[y * 60 + x] = 1;
    const wall = { width: 60, height: 40, cells } as TerrainMask;
    const b = surfaceLight(wall, 30, 20, 24, PALETTE.fire2, PALETTE.fire3);
    const xs = Array.from(b.x0);
    expect(xs.some((x) => x === 144 || x === 145)).toBe(true);
  });
  it("450 ms で 3 段に弱まって消える", () => {
    const b = surfaceLight(mask, 30, 19, 24, PALETTE.fire2, PALETTE.fire3);
    const at = (t: number) => { const f = createFrame(b.count); sampleBatch(b, t, WIDE, f); return f.n; };
    expect(at(200)).toBeLessThan(at(1));
    expect(at(350)).toBeLessThan(at(200));
    expect(at(450)).toBe(0);
  });
});

describe("damagePixels", () => {
  it("5 × 7 のグリフを dot の大きさで描き、1 px の暗い輪郭を付ける", () => {
    const g = damagePixels("-35", 2, PALETTE.fire2);
    expect(g.height).toBe(7 * 2 + 2);
    expect(g.width).toBe(3 * 6 * 2 - 2 + 2);
    const colors = new Set(Array.from(g.pixels).filter((c) => c !== TRANSPARENT));
    expect([...colors].sort()).toEqual([PALETTE.outline, PALETTE.fire2].sort());
    expect(getPixel(g, 0, 0)).toBe(TRANSPARENT);
  });
  it("0〜9 と「-」をすべて持つ", () => {
    for (const ch of "0123456789-") expect(DIGITS[ch]).toHaveLength(7);
  });
});
