import type { TerrainMask } from "@game/sim";
import { describe, expect, it } from "vitest";
import { EDGE_MARGIN, edgeBlinkOn, edgeMarker } from "@/game/edgeMarker";
import { CARVE_AT_MS, IMPACT_TOTAL_MS, impactClock, INVERT_MS, invertCells, invertOn, missMarkAt } from "@/game/hitFeedback";
import { guideDots, TRAIL_EVERY, trailDots } from "@/game/trail";
import { REVEAL_MS, revealRowsAt } from "@/worldUi/openingTour";

// 着弾まわりの演出の見え方を数値で固定する。設計書 38 の E1〜E7 と L3

/** 下半分が地面の mask */
const ground = (width: number, height: number, top: number): TerrainMask => {
  const cells = new Uint8Array(width * height);
  for (let y = top; y < height; y++) for (let x = 0; x < width; x++) cells[y * width + x] = 1;
  return { width, height, cells } as TerrainMask;
};

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
