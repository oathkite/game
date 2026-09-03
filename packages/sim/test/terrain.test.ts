import { describe, expect, it } from "vitest";
import { applyOps, carve, createMask, isSolid, MAP_HEIGHT, MAP_WIDTH, surfaceY } from "../src/index.js";
import { flatMask, islandMask } from "./helpers.js";

describe("地形マスク", () => {
  it("平坦な地形の地表は指定した高さ", () => {
    const mask = flatMask(150);
    expect(surfaceY(mask, 0)).toBe(150);
    expect(surfaceY(mask, MAP_WIDTH - 1)).toBe(150);
    expect(isSolid(mask, 10, 149)).toBe(false);
    expect(isSolid(mask, 10, 150)).toBe(true);
  });

  it("地面がない列は高さ（奈落）を返し、範囲外は地面なし", () => {
    const mask = islandMask();
    expect(surfaceY(mask, 200)).toBe(MAP_HEIGHT);
    expect(surfaceY(mask, -1)).toBe(MAP_HEIGHT);
    expect(surfaceY(mask, MAP_WIDTH)).toBe(MAP_HEIGHT);
    expect(isSolid(mask, -1, 150)).toBe(false);
    expect(isSolid(mask, 80, MAP_HEIGHT)).toBe(false);
  });

  it("削りは円形で、元のマスクを変えない", () => {
    const mask = flatMask(150);
    const next = carve(mask, { cx: 100, cy: 150, radius: 10 });
    expect(isSolid(mask, 100, 155)).toBe(true);
    expect(isSolid(next, 100, 155)).toBe(false);
    expect(isSolid(next, 100, 160)).toBe(false);
    expect(isSolid(next, 100, 161)).toBe(true);
    expect(isSolid(next, 110, 150)).toBe(false);
    expect(isSolid(next, 111, 150)).toBe(true);
    // 半径の対角（7, 7）は 98 <= 100 で削れ、（8, 7）は 113 で残る
    expect(isSolid(next, 107, 157)).toBe(false);
    expect(isSolid(next, 108, 157)).toBe(true);
    expect(surfaceY(next, 100)).toBe(161);
  });

  it("端にかかる削りは範囲内だけを消す", () => {
    const mask = flatMask(150);
    const next = carve(mask, { cx: 0, cy: MAP_HEIGHT - 1, radius: 10 });
    expect(isSolid(next, 0, MAP_HEIGHT - 1)).toBe(false);
    expect(isSolid(next, 5, MAP_HEIGHT - 1)).toBe(false);
    expect(next.cells.length).toBe(mask.cells.length);
  });

  it("履歴の再適用で同じ地形になる", () => {
    const ops = [
      { cx: 50, cy: 150, radius: 10 },
      { cx: 55, cy: 160, radius: 10 },
    ];
    const a = applyOps(flatMask(), ops);
    const b = carve(carve(flatMask(), ops[0]!), ops[1]!);
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
  });

  it("空のマスクはすべて地面なし", () => {
    const mask = createMask(4, 3);
    expect(surfaceY(mask, 2)).toBe(3);
  });
});
