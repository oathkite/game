import type { TerrainMask } from "@game/sim";
import { describe, expect, it } from "vitest";
import { CRUMBLE_LIMIT, CRUMBLE_MS, crumbleAt, rimCells } from "@/game/crumble";
import { EDGE_MARGIN, edgeBlinkOn, edgeMarker } from "@/game/edgeMarker";
import { CARVE_AT_MS, IMPACT_TOTAL_MS, impactClock, INVERT_MS, invertCells, invertOn, missMarkAt } from "@/game/hitFeedback";
import { guideDots, TRAIL_EVERY, trailDots } from "@/game/trail";
import { blastCells, blastShapeCells } from "@/game/weaponArt";
import { REVEAL_MS, revealRowsAt } from "@/worldUi/openingTour";

// 着弾まわりの演出の見え方を数値で固定する。設計書 38 の E1〜E7 と L3

/** 下半分が地面の mask */
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

describe("rimCells と crumbleAt", () => {
  const before = ground(40, 30, 15);
  const after = carveOut(before, 20, 15, 6);
  const op = { cx: 20, cy: 15, radius: 6 };
  it("削られたセルのうち縁だけを拾い、地形の無かった所は拾わない", () => {
    const rim = rimCells(before, after, op);
    expect(rim.length).toBeGreaterThan(0);
    for (const c of rim) {
      expect(c.y).toBeGreaterThanOrEqual(15);
      expect(Math.hypot(c.x - 20, c.y - 15)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("大きな爆風では上限まで間引く", () => {
    const big = carveOut(before, 20, 15, 14);
    expect(rimCells(before, big, { cx: 20, cy: 15, radius: 14 }).length).toBe(CRUMBLE_LIMIT);
  });
  it("何も削っていなければ拾わない", () => {
    expect(rimCells(before, before, op)).toEqual([]);
  });
  it("かけらは中心から外へ跳ねて落ち、長さを過ぎたら消える", () => {
    const cells = [{ x: 14, y: 16 }, { x: 26, y: 16 }];
    expect(crumbleAt(0, cells, { x: 20, y: 15 })).toEqual(cells);
    const later = crumbleAt(300, cells, { x: 20, y: 15 });
    expect(later[0]!.x).toBeLessThan(14);
    expect(later[1]!.x).toBeGreaterThan(26);
    expect(crumbleAt(CRUMBLE_MS, cells, { x: 20, y: 15 })).toEqual([]);
    expect(crumbleAt(-1, cells, { x: 20, y: 15 })).toEqual([]);
  });
});

describe("trailDots と guideDots", () => {
  const points = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 10 }));
  it("進んだところまでを間隔を空けて拾い、新しい点だけを明るくする", () => {
    const dots = trailDots(points, 40);
    expect(dots.every(d => d.x < 40 && d.x % TRAIL_EVERY === 0)).toBe(true);
    expect(dots[0]!.recent).toBe(false);
    expect(dots[dots.length - 1]!.recent).toBe(true);
  });
  it("発射直後と空の位置列では何も出さない", () => {
    expect(trailDots(points, 0)).toEqual([]);
    expect(trailDots([], 10)).toEqual([]);
  });
  it("前の射撃の軌跡は弾道ごとに 3 点おき", () => {
    expect(guideDots([points.slice(0, 7), []])).toEqual([{ x: 0, y: 10 }, { x: 3, y: 10 }, { x: 6, y: 10 }]);
  });
});

describe("blastShapeCells", () => {
  it("標準砲は今と同じ円", () => {
    expect(blastShapeCells("cannon", 10, 10, 5, false)).toEqual(blastCells(10, 10, 5, false));
  });
  it("レーザーは横に長く、縦は半分の長さの十字", () => {
    const cells = blastShapeCells("laser", 10, 10, 6, false);
    const xs = cells.map(c => c.x), ys = cells.map(c => c.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(12);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(6);
    expect(new Set(cells.map(c => `${c.x}/${c.y}`)).size).toBe(cells.length);
  });
  it("掘削弾は下へ長い楕円で、上には短い", () => {
    const cells = blastShapeCells("drill", 10, 10, 6, false);
    const ys = cells.map(c => c.y);
    expect(Math.max(...ys) - 10).toBeGreaterThan(10 - Math.min(...ys));
  });
  it("浮遊砲は輪を 2 つ重ね、消える前は外の輪だけ", () => {
    expect(blastShapeCells("floater", 10, 10, 8, false).length).toBeGreaterThan(blastCells(10, 10, 8, true).length);
    expect(blastShapeCells("floater", 10, 10, 8, true)).toEqual(blastCells(10, 10, 8, true));
  });
  it("縁だけの姿は塗った姿より少ない", () => {
    for (const w of ["laser", "drill", "cannon"] as const) expect(blastShapeCells(w, 10, 10, 6, true).length).toBeLessThan(blastShapeCells(w, 10, 10, 6, false).length);
  });
});

describe("impactClock", () => {
  it("時間が足りていればそのまま、足りなければ演出の全体を縮める", () => {
    expect(impactClock(100, 1600)).toBe(100);
    expect(impactClock(150, 300)).toBe(IMPACT_TOTAL_MS / 2);
    expect(impactClock(300, 300)).toBe(IMPACT_TOTAL_MS);
    expect(impactClock(10, 0)).toBeGreaterThan(0);
  });
});

describe("invertOn と invertCells", () => {
  it("大ダメージの着弾で爆風が最大になった瞬間だけ出す", () => {
    expect(invertOn(CARVE_AT_MS, 30, false)).toBe(true);
    expect(invertOn(CARVE_AT_MS + INVERT_MS, 30, false)).toBe(false);
    expect(invertOn(CARVE_AT_MS - 1, 30, false)).toBe(false);
    expect(invertOn(CARVE_AT_MS, 20, false)).toBe(false);
    expect(invertOn(CARVE_AT_MS, 30, true)).toBe(false);
  });
  it("地形は黒、空は白に分け、マップの外は含めない", () => {
    const mask = ground(10, 10, 5);
    const { white, black } = invertCells(mask, 0, 5, 2);
    expect(white.every(c => c.y < 5 && c.x >= 0)).toBe(true);
    expect(black.every(c => c.y >= 5 && c.x >= 0)).toBe(true);
    expect(white.length + black.length).toBeGreaterThan(0);
  });
});

describe("missMarkAt の大きさ", () => {
  it("可変サイズのマップでは渡した大きさの端に寄せる", () => {
    expect(missMarkAt(0, { x: 600, y: 10 }, { width: 500, height: 225 })).toMatchObject({ x: 498 });
    expect(missMarkAt(0, { x: 600, y: 10 })).toMatchObject({ x: 398 });
  });
});

describe("edgeMarker", () => {
  const screen = { width: 800, height: 450 };
  it("画面の中なら出さない", () => {
    expect(edgeMarker({ x: 400, y: 200 }, screen)).toBeNull();
  });
  it("外なら最も近い辺へ寄せ、向きを返す", () => {
    expect(edgeMarker({ x: -50, y: 200 }, screen)).toEqual({ x: EDGE_MARGIN, y: 200, side: "left" });
    expect(edgeMarker({ x: 900, y: 500 }, screen)).toEqual({ x: 800 - EDGE_MARGIN, y: 450 - EDGE_MARGIN, side: "right" });
    expect(edgeMarker({ x: 400, y: -300 }, screen)!.side).toBe("up");
    expect(edgeMarker({ x: 400, y: 900 }, screen)!.side).toBe("down");
  });
  it("明滅し、動きを減らす設定では点いたまま", () => {
    expect(edgeBlinkOn(0, false)).toBe(true);
    expect(edgeBlinkOn(130, false)).toBe(false);
    expect(edgeBlinkOn(130, true)).toBe(true);
  });
});

describe("revealRowsAt", () => {
  it("上から段ごとに増え、描き終えたら全体", () => {
    expect(revealRowsAt(0, 225)).toBeGreaterThan(0);
    expect(revealRowsAt(300, 225)!).toBeGreaterThan(revealRowsAt(0, 225)!);
    expect(revealRowsAt(REVEAL_MS - 1, 225)).toBe(225);
    expect(revealRowsAt(REVEAL_MS, 225)).toBeNull();
  });
  it("動きを減らす設定と、開幕の途中からの再接続では全体を出す", () => {
    expect(revealRowsAt(0, 225, true)).toBeNull();
    expect(revealRowsAt(5000, 225)).toBeNull();
  });
});
