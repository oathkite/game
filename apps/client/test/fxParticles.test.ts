import type { TerrainMask } from "@game/sim";
import { describe, expect, it } from "vitest";
import { hash32, hashText, unit } from "@/game/fx/hash";
import { allocBatch, createFrame, FADE_TAIL, sampleBatch, spanOf, visibleAt, type ArtBounds } from "@/game/fx/particles";
import { DEBRIS_AFTER_RETURN_MS, DEBRIS_GRASS_KEEP, DEBRIS_GRAVITY, DEBRIS_HEAT_SHARE, DEBRIS_LIFE_MS, terrainDebris } from "@/game/fx/terrainDebris";
import { PALETTE } from "@/game/palette";
import { createGrid, setPixel, type Rect } from "@/game/pixelGrid";

// 決定論の粒と、削れた地形の破片（D1）の見え方を数値で固定する。設計書 41.3〜41.5

const WIDE: ArtBounds = { left: -100000, top: -100000, right: 100000, bottom: 100000 };

describe("hash32", () => {
  it("同じ入力からは同じ値、違う入力からは違う値を出す", () => {
    expect(hash32(1, 2, 3)).toBe(hash32(1, 2, 3));
    expect(hash32(1, 2, 3)).not.toBe(hash32(3, 2, 1));
    expect(hash32(0)).not.toBe(hash32(1));
  });
  it("unit は 0 以上 1 未満で、偏りが小さい", () => {
    const values = Array.from({ length: 4000 }, (_, i) => unit(hash32(7, i)));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    const low = values.filter((v) => v < 0.5).length;
    expect(low).toBeGreaterThan(1800);
    expect(low).toBeLessThan(2200);
  });
  it("hashText は文字列ごとに決まった数を返す", () => {
    expect(hashText("match-a")).toBe(hashText("match-a"));
    expect(hashText("match-a")).not.toBe(hashText("match-b"));
  });
});

/** 1 粒だけのまとまり */
const single = (over: { vx?: number; vy?: number; life?: number; t0?: number; fade?: number; ramp?: readonly number[]; step?: number; drag?: number }) => {
  const b = allocBatch(1, { ramps: [over.ramp ?? [PALETTE.white]], gravity: 100, drag: over.drag ?? 0 });
  b.x0[0] = 10; b.y0[0] = 20; b.vx[0] = over.vx ?? 0; b.vy[0] = over.vy ?? 0;
  b.life[0] = over.life ?? 1000; b.t0[0] = over.t0 ?? 0; b.size[0] = 1; b.fade[0] = over.fade ?? 0; b.step[0] = over.step ?? 0;
  return b;
};

describe("sampleBatch", () => {
  it("位置は x0 + vx·τ、y0 + vy·τ + g·τ²/2 を art px に切り捨てる", () => {
    const frame = createFrame(4);
    sampleBatch(single({ vx: 30, vy: -40 }), 500, WIDE, frame);
    expect(frame.n).toBe(1);
    expect(frame.x[0]).toBe(Math.floor(10 + 30 * 0.5));
    expect(frame.y[0]).toBe(Math.floor(20 - 40 * 0.5 + (100 * 0.25) / 2));
  });
  it("空気の抵抗があると、同じ時刻でも抵抗なしより手前で止まる", () => {
    const free = createFrame(1), slow = createFrame(1);
    sampleBatch(single({ vx: 200 }), 800, WIDE, free);
    sampleBatch(single({ vx: 200, drag: 3 }), 800, WIDE, slow);
    expect(slow.x[0]).toBeLessThan(free.x[0]!);
    expect(slow.x[0]).toBeGreaterThan(10);
  });
  it("生まれる前と寿命の後は描かない", () => {
    const frame = createFrame(1);
    expect(sampleBatch(single({ t0: 100 }), 50, WIDE, frame)).toBe(0);
    expect(sampleBatch(single({ life: 300 }), 300, WIDE, frame)).toBe(0);
  });
  it("範囲の外の粒は並べない", () => {
    const frame = createFrame(1);
    expect(sampleBatch(single({}), 0, { left: 0, top: 0, right: 5, bottom: 5 }, frame)).toBe(0);
  });
  it("色は段を step ごとに進め、最後の段で止まる", () => {
    const b = single({ ramp: [PALETTE.fire2, PALETTE.fire3, PALETTE.loam0], step: 100, life: 1000 });
    const at = (t: number) => { const f = createFrame(1); sampleBatch(b, t, WIDE, f); return f.color[0]; };
    expect(at(50)).toBe(PALETTE.fire2);
    expect(at(150)).toBe(PALETTE.fire3);
    expect(at(700)).toBe(PALETTE.loam0);
  });
  it("容量を超えた粒は描かない", () => {
    const b = allocBatch(5, { ramps: [[PALETTE.white]], gravity: 0, drag: 0 });
    for (let i = 0; i < 5; i++) b.life[i] = 100;
    const frame = createFrame(3);
    expect(sampleBatch(b, 10, WIDE, frame)).toBe(3);
  });
  it("spanOf はまとまりが消えるまでの時間", () => {
    const b = allocBatch(2, { ramps: [[PALETTE.white]], gravity: 0, drag: 0 });
    b.t0[0] = 100; b.life[0] = 400; b.life[1] = 450;
    expect(spanOf(b)).toBe(500);
  });
});

describe("visibleAt", () => {
  it("寿命の最後の割合で、fade の値が大きい粒から消える", () => {
    const life = 1000, late = life * (1 - FADE_TAIL / 2);
    expect(visibleAt(late, life, 0.9)).toBe(false);
    expect(visibleAt(late, life, 0.1)).toBe(true);
    expect(visibleAt(life * 0.5, life, 0.99)).toBe(true);
  });
});

/** y が top より下が地面の mask */
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
const removedCells = (before: TerrainMask, after: TerrainMask): number => before.cells.reduce((n, c, i) => n + (c === 1 && after.cells[i] === 0 ? 1 : 0), 0);

/** texel の色を座標で変える塗り。地面は深さで土の色を変える */
const paint = (mask: TerrainMask) => (rect: Rect) => {
  const grid = createGrid(rect.left * 4, rect.top * 4, rect.width * 4, rect.height * 4);
  for (let y = rect.top; y < rect.top + rect.height; y++) for (let x = rect.left; x < rect.left + rect.width; x++) {
    if (mask.cells[y * mask.width + x] !== 1) continue;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) setPixel(grid, x * 4 + sx, y * 4 + sy, sy === 0 ? PALETTE.green : PALETTE.loam1);
  }
  return grid;
};

describe("terrainDebris", () => {
  const before = ground(60, 40, 20), op = { cx: 30, cy: 20, radius: 6 };
  const after = carveOut(before, op.cx, op.cy, op.radius);
  const debris = (budget?: number) => terrainDebris({ before, after, op, texels: paint(before), seed: 42, ...(budget === undefined ? {} : { budget }) });

  it("削れたセルの texel を粒にし、色は削る前の地形の色のまま。草の色は 4 割だけ残す", () => {
    const b = debris();
    const colorOf = (i: number) => b.ramps[b.ramp[i]!]!.at(-1);
    const soil = Array.from({ length: b.count }, (_, i) => colorOf(i)).filter((c) => c === PALETTE.loam1).length;
    const grass = Array.from({ length: b.count }, (_, i) => colorOf(i)).filter((c) => c === PALETTE.green).length;
    // 塗りは各セルの最上行だけが草。土は 12/16、草は 4/16
    expect(soil).toBe(removedCells(before, after) * 12);
    expect(grass / (removedCells(before, after) * 4)).toBeGreaterThan(DEBRIS_GRASS_KEEP - 0.12);
    expect(grass / (removedCells(before, after) * 4)).toBeLessThan(DEBRIS_GRASS_KEEP + 0.12);
    expect(b.gravity).toBe(DEBRIS_GRAVITY);
    expect(Array.from(b.life).every((l) => l > 0 && l <= DEBRIS_LIFE_MS)).toBe(true);
  });
  it("同じ入力からは同じ破片ができる", () => {
    const a = debris(), b = debris();
    expect(b.vx).toEqual(a.vx);
    expect(b.vy).toEqual(a.vy);
    expect(b.ramp).toEqual(a.ramp);
  });
  it("爆心から左右の外へ飛び、爆心より下のドットも上へ噴き上がる", () => {
    const b = debris();
    const cx = (op.cx + 0.5) * 4;
    let outward = 0;
    for (let i = 0; i < b.count; i++) if (Math.sign(b.vx[i]!) === Math.sign(b.x0[i]! + 0.5 - cx) || Math.abs(b.x0[i]! + 0.5 - cx) < 1) outward++;
    expect(outward).toBe(b.count);
    expect(Array.from(b.vy).every((v) => v < 0)).toBe(true);
  });
  it("粒のおよそ 35% が淡い黄から熱の色で冷めてから、元の色に戻る。白は使わない", () => {
    const b = debris();
    const heated = Array.from({ length: b.count }, (_, i) => b.ramps[b.ramp[i]!]!).filter((r) => r.length > 1);
    expect(heated.length / b.count).toBeGreaterThan(DEBRIS_HEAT_SHARE - 0.08);
    expect(heated.length / b.count).toBeLessThan(DEBRIS_HEAT_SHARE + 0.08);
    expect(heated[0]![0]).toBe(PALETTE.fire1);
    expect(heated.every((r) => !r.includes(PALETTE.white))).toBe(true);
  });
  it("生まれた高さへ戻ってから 1 秒で消え、地形の上をいつまでも落ちない", () => {
    const b = debris();
    for (let i = 0; i < b.count; i++) expect(b.life[i]).toBeCloseTo(Math.min(DEBRIS_LIFE_MS, (2000 * Math.abs(b.vy[i]!)) / DEBRIS_GRAVITY + DEBRIS_AFTER_RETURN_MS), 3);
  });
  it("上限を超えると 2 × 2 art px の塊にまとめ、それでも超えたら間引く", () => {
    const texels = removedCells(before, after) * 16;
    const grouped = debris(texels / 2);
    expect(grouped.count).toBeLessThanOrEqual(texels / 4);
    expect(grouped.count).toBeGreaterThan(texels / 8);
    expect(Array.from(grouped.size).every((s) => s === 2)).toBe(true);
    const thinned = debris(texels / 16);
    expect(thinned.count).toBeLessThan(grouped.count * 0.5);
  });
  it("何も削れていなければ 0 粒", () => {
    expect(terrainDebris({ before, after: before, op, texels: paint(before), seed: 1 }).count).toBe(0);
  });
  it("時間がたつと重さで画面の下へ落ちる", () => {
    const b = debris(), early = createFrame(b.count), late = createFrame(b.count);
    sampleBatch(b, 100, WIDE, early);
    sampleBatch(b, 2000, WIDE, late);
    const mean = (f: typeof early) => Array.from(f.y.subarray(0, f.n)).reduce((s, y) => s + y, 0) / f.n;
    expect(mean(late)).toBeGreaterThan(mean(early) + 200);
  });
});

describe("terrainDebris の熱の色", () => {
  it("熱い粒の色の段を差し替えられる（レーザー弾と浮遊弾は発光色）", () => {
    const before = ground(60, 40, 20), op = { cx: 30, cy: 20, radius: 6 };
    const b = terrainDebris({ before, after: carveOut(before, op.cx, op.cy, op.radius), op, texels: paint(before), seed: 3, heat: [PALETTE.energy0, PALETTE.energy2] });
    const heated = Array.from({ length: b.count }, (_, i) => b.ramps[b.ramp[i]!]!).filter((r) => r.length > 1);
    expect(heated[0]!.slice(0, 2)).toEqual([PALETTE.energy0, PALETTE.energy2]);
  });
});
