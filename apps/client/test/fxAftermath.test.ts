import type { TerrainMask } from "@game/sim";
import { describe, expect, it } from "vitest";
import { craterFlames, craterFloor, FLAME_FLICKER_MS, FLAME_MS, flameGlow, surfaceLight, wreckSmokeColumn } from "@/game/fx/aftermathFx";
import { createFrame, sampleBatch, spanOf, type ArtBounds, type ParticleBatch } from "@/game/fx/particles";
import type { FxDepth, FxLayer } from "@/game/fx/fxLayer";
import { createRendererEffects } from "@/game/fx/rendererEffects";
import type { ScreenFx } from "@/game/fx/screenFx";
import { damagePixels, DIGITS } from "@/game/damageFont";
import { PALETTE, TEAM_RAMPS } from "@/game/palette";
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
  it("炎は 1 art px ずつ上へ 3 粒重ねた舌で、上の粒ほど早く冷めて消える", () => {
    const b = craterFlames(after, op, 1);
    expect(b.x0[1]).toBe(b.x0[0]);
    expect(b.x0[2]).toBe(b.x0[0]);
    expect([b.y0[0]! - b.y0[1]!, b.y0[1]! - b.y0[2]!]).toEqual([1, 1]);
    expect(b.life[1]).toBeLessThan(b.life[0]!);
    expect(b.life[2]).toBeLessThan(b.life[1]!);
    expect(b.sizes).toEqual([2, 1, 1, 1]);
  });
  it("削れていなければ（床が爆風の外なら）炎を出さない", () => {
    const air = { width: 20, height: 20, cells: new Uint8Array(400) } as TerrainMask;
    expect(craterFlames(air, { cx: 10, cy: 10, radius: 4 }, 1).count).toBe(0);
  });
});

describe("flameGlow", () => {
  const before = ground(80, 60, 30), op = { cx: 40, cy: 30, radius: 8 }, after = carveOut(before, 40, 30, 8);
  const solidAt = (tx: number, ty: number): boolean => after.cells[Math.floor(ty / 4) * after.width + Math.floor(tx / 4)] === 1;
  const airAt = (tx: number, ty: number): boolean => { const x = Math.floor(tx / 4), y = Math.floor(ty / 4); return y < 0 || after.cells[y * after.width + x] !== 1; };
  it("炎を向いた面から 1〜3 texel 内側の土を、橙と暗い橙で照らし、縁の texel と宙には置かない", () => {
    const b = flameGlow(after, op, 1);
    expect(b.count).toBeGreaterThan(0);
    const colors = new Set(Array.from({ length: b.count }, (_, i) => b.ramps[b.ramp[i]!]![0]));
    for (const c of colors) expect([PALETTE.fire3, PALETTE.fire4]).toContain(c);
    for (let i = 0; i < b.count; i++) {
      const x = b.x0[i]!, y = b.y0[i]!;
      expect(solidAt(x, y)).toBe(true);
      // 空気に接する texel ではなく、面の向きに 2〜4 texel 先に空気がある
      expect([[0, -1], [0, 1], [-1, 0], [1, 0]].every(([dx, dy]) => !airAt(x + dx!, y + dy!))).toBe(true);
      expect([[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => [2, 3, 4].some((k) => airAt(x + dx! * k, y + dy! * k)))).toBe(true);
    }
  });
  it("120 ms のコマごとに強さが揺らぎ、炎が燃える 2.5 秒の間に弱まって消える", () => {
    const b = flameGlow(after, op, 1);
    const at = (t: number) => { const f = createFrame(b.count); sampleBatch(b, t, WIDE, f); return f.n; };
    const early = Array.from({ length: 6 }, (_, k) => at(10 + k * FLAME_FLICKER_MS));
    expect(new Set(early).size).toBeGreaterThan(1);
    expect(at(FLAME_MS * 0.9)).toBeLessThan(Math.max(...early));
    expect(at(FLAME_MS + FLAME_FLICKER_MS)).toBe(0);
  });
});

describe("wreckSmokeColumn", () => {
  it("粒の範囲を指定すると、柱全体の同じ粒を同じ生まれる時刻で作る（残骸を追って少しずつ出すため）", () => {
    const whole = wreckSmokeColumn(10, 20, 1), part = wreckSmokeColumn(10, 30, 1, 4, 8);
    expect(part.count).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(part.t0[i]).toBe(whole.t0[4 + i]);
      expect(part.vy[i]).toBe(whole.vy[4 + i]);
      expect(part.y0[i]).toBe((30 - 2.5) * 4);
    }
    expect(wreckSmokeColumn(10, 20, 1, 38, 42).count).toBe(2);
  });
  it("3.5 秒かけて 40 粒の煙を昇らせ、根元の中くらいの灰から明るく、4 → 6 → 8 art px と膨らませる", () => {
    const b = wreckSmokeColumn(10, 20, 1);
    expect(b.count).toBe(40);
    expect(spanOf(b)).toBeGreaterThan(3500);
    expect(b.ramps[0]![0]).toBe(PALETTE.smoke2);
    expect(b.sizes).toEqual([4, 6, 8]);
    const f = createFrame(b.count);
    sampleBatch(b, b.t0[0]! + b.life[0]! * 0.9, WIDE, f);
    expect(Math.max(...Array.from(f.size.subarray(0, f.n)))).toBe(8);
  });
});

describe("surfaceLight", () => {
  const mask = ground(60, 40, 20);
  it("上面の縁の 2 texel を、爆風の縁のすぐ外ほど濃い 3 段で照らし、削れる内側は照らさない", () => {
    // 爆心 (30, 19)、半径 6 セル。y = 20 の地表では x = 25〜35 のセル（texel 100〜143）が削れる
    const b = surfaceLight(mask, 30, 19, 24, PALETTE.fire2, PALETTE.fire3);
    expect(b.count).toBeGreaterThan(0);
    for (let i = 0; i < b.count; i++) expect([80, 81]).toContain(b.y0[i]);
    const xs = Array.from(b.x0);
    expect(xs.filter((x) => x >= 100 && x <= 143)).toEqual([]);
    const near = xs.filter((x) => x >= 144 && x <= 151).length, far = xs.filter((x) => x >= 158 && x <= 163).length;
    expect(near).toBe(2 * 8);
    expect(near / (2 * 8)).toBeGreaterThan(far / (2 * 6));
    expect(Array.from({ length: b.count }, (_, i) => b.ramps[b.ramp[i]!]![0])).toContain(PALETTE.fire2);
  });
  it("掘削弾ほどの大きな爆風でも、残る地表の縁のすぐ外を最も濃く照らし、縁から 9 セルより外は照らさない", () => {
    // 爆心 (60, 29)、半径 20 セル。y = 30 の地表で最初に残るセルは x = 80（texel 320〜）
    const wide = ground(120, 60, 30), b = surfaceLight(wide, 60, 29, 80, PALETTE.fire2, PALETTE.fire3);
    const rim = Array.from({ length: b.count }, (_, i) => i).filter((i) => b.x0[i]! >= 320 && b.x0[i]! <= 333);
    expect(rim).toHaveLength(2 * 14);
    for (const i of rim) expect(b.ramps[b.ramp[i]!]![0]).toBe(PALETTE.fire2);
    expect(Array.from(b.x0).filter((x) => x >= 358)).toEqual([]);
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

describe("煙の柱が残骸を追う", () => {
  const setup = () => {
    let now = 0, at: { x: number; y: number } | null = { x: 10, y: 20 };
    const emitted: { depth: FxDepth; batch: ParticleBatch; age: number }[] = [];
    const fx = { now: () => now, emit: (depth: FxDepth, batch: ParticleBatch, age = 0) => { emitted.push({ depth, batch, age }); }, clear: () => {}, count: () => 0, freeze: () => {} } as unknown as FxLayer;
    const screenFx = { tick: () => {}, clear: () => {}, tintAt: () => {}, dimAt: () => {}, flashAt: () => {} } as unknown as ScreenFx;
    const effects = createRendererEffects({ fx, screenFx, texels: undefined, screen: () => ({ width: 100, height: 100 }), reduced: () => false, soil: [PALETTE.loam1], tankAt: () => at });
    const smokes = () => emitted.filter((e) => e.depth === "back" && e.batch.sizes?.[0] === 4);
    return { effects, smokes, advance: (ms: number) => { now += ms; effects.tick(); }, move: (next: { x: number; y: number } | null) => { at = next; } };
  };
  it("4 粒ずつ、その時の残骸の接地点から出す。落ちた後の粒は落ちた先から昇る", () => {
    const t = setup();
    t.effects.wreck(10, 20, TEAM_RAMPS.red, 1, 0, 0);
    t.advance(0);
    expect(t.smokes()).toHaveLength(1);
    expect(t.smokes()[0]!.batch.count).toBe(4);
    expect(t.smokes()[0]!.batch.y0[0]).toBe((20 - 2.5) * 4);
    t.move({ x: 10, y: 30 });
    t.advance(400);
    expect(t.smokes()).toHaveLength(2);
    expect(t.smokes()[1]!.batch.y0[0]).toBe((30 - 2.5) * 4);
    // 柱の始まりからの時刻で出すので、粒の生まれる時刻は柱全体で出したときと変わらない
    expect(t.smokes()[1]!.age).toBe(400);
    t.advance(4000);
    expect(t.smokes().reduce((sum, e) => sum + e.batch.count, 0)).toBe(40);
  });
  it("残骸が見えなくなったら（場外）、その後の粒を出さない", () => {
    const t = setup();
    t.effects.wreck(10, 20, TEAM_RAMPS.red, 1, 0, 0);
    t.advance(0);
    t.move(null);
    t.advance(4000);
    expect(t.smokes()).toHaveLength(1);
  });
});
