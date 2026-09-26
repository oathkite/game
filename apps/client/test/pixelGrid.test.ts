import { describe, expect, it } from "vitest";
import { colorRuns, composeLayers, createGrid, fillRect, getPixel, mirrorGrid, opaqueBounds, rotateGrid, setPixel, toRgba, TRANSPARENT } from "@/game/pixelGrid";

// 画素の格子の純関数。設計書 40.3 の「回転は描き直して格子に揃える」の土台

const opaque = (grid: ReturnType<typeof createGrid>): readonly string[] => {
  const cells: string[] = [];
  for (let y = grid.top; y < grid.top + grid.height; y++) for (let x = grid.left; x < grid.left + grid.width; x++) {
    if (getPixel(grid, x, y) !== TRANSPARENT) cells.push(`${x},${y}`);
  }
  return cells;
};

describe("createGrid と setPixel", () => {
  it("負の座標を持つ格子に書き込み、外は透明として読む", () => {
    const grid = createGrid(-2, -3, 4, 4);
    setPixel(grid, -2, -3, 0x112233);
    setPixel(grid, 1, 0, 0x445566);
    setPixel(grid, 5, 5, 0x778899);
    expect(getPixel(grid, -2, -3)).toBe(0x112233);
    expect(getPixel(grid, 1, 0)).toBe(0x445566);
    expect(getPixel(grid, 5, 5)).toBe(TRANSPARENT);
    expect(getPixel(grid, 0, 0)).toBe(TRANSPARENT);
  });
  it("fillRect は格子の中だけを塗る", () => {
    const grid = createGrid(0, 0, 3, 3);
    fillRect(grid, -1, 1, 3, 5, 0xabcdef);
    expect(opaque(grid)).toEqual(["0,1", "1,1", "0,2", "1,2"]);
  });
});

describe("rotateGrid", () => {
  it("0 度はそのまま返す", () => {
    const grid = createGrid(0, -2, 2, 2);
    fillRect(grid, 0, -2, 2, 2, 1);
    expect(rotateGrid(grid, 0)).toBe(grid);
  });
  it("90 度で原点の周りを反時計回りに回す（y は下向き）", () => {
    // 原点の右にある横長の棒は、原点の上の縦長の棒になる
    const grid = createGrid(0, 0, 3, 1);
    fillRect(grid, 0, 0, 3, 1, 7);
    const rotated = rotateGrid(grid, 90);
    expect(opaque(rotated)).toEqual(["0,-3", "0,-2", "0,-1"]);
  });
  it("180 度で点対称に移す", () => {
    const grid = createGrid(0, -1, 2, 1);
    setPixel(grid, 0, -1, 5);
    setPixel(grid, 1, -1, 6);
    const rotated = rotateGrid(grid, 180);
    expect(getPixel(rotated, -1, 0)).toBe(5);
    expect(getPixel(rotated, -2, 0)).toBe(6);
  });
  it("小さな角度でも画素の数をほぼ保つ", () => {
    const grid = createGrid(-8, -4, 16, 4);
    fillRect(grid, -8, -4, 16, 4, 3);
    for (const degrees of [9, -18, 27, 45]) {
      const count = opaque(rotateGrid(grid, degrees)).length;
      expect(count).toBeGreaterThan(64 * 0.85);
      expect(count).toBeLessThan(64 * 1.15);
    }
  });
});

describe("mirrorGrid", () => {
  it("原点の縦線で左右を入れ替える", () => {
    const grid = createGrid(0, 0, 3, 1);
    setPixel(grid, 0, 0, 1);
    setPixel(grid, 2, 0, 3);
    const mirrored = mirrorGrid(grid);
    expect(getPixel(mirrored, -1, 0)).toBe(1);
    expect(getPixel(mirrored, -3, 0)).toBe(3);
    expect(getPixel(mirrored, -2, 0)).toBe(TRANSPARENT);
  });
});

describe("composeLayers", () => {
  const block = () => {
    const grid = createGrid(0, 0, 3, 3);
    fillRect(grid, 0, 0, 3, 3, 1);
    return grid;
  };
  it("層の外側に 1 画素の輪郭を付け、上の縁と下の縁を塗り分ける", () => {
    const out = composeLayers([{ mask: block(), outline: 0x050608, paint: (_m, edge) => (edge.top ? 0xaaaaaa : edge.bottom ? 0x222222 : 0x777777) }], { left: -1, top: -1, width: 5, height: 5 });
    expect(getPixel(out, 1, -1)).toBe(0x050608);
    expect(getPixel(out, -1, 1)).toBe(0x050608);
    // 輪郭は 4 近傍だけで、角には付けない
    expect(getPixel(out, -1, -1)).toBe(TRANSPARENT);
    expect(getPixel(out, 1, 0)).toBe(0xaaaaaa);
    expect(getPixel(out, 1, 1)).toBe(0x777777);
    expect(getPixel(out, 1, 2)).toBe(0x222222);
  });
  it("上の層の輪郭は下の層を塗り替え、部品の境目を見せる", () => {
    const lower = createGrid(0, 0, 5, 1);
    fillRect(lower, 0, 0, 5, 1, 1);
    const upper = createGrid(2, -2, 1, 2);
    fillRect(upper, 2, -2, 1, 2, 2);
    const out = composeLayers([
      { mask: lower, outline: 0x050608, paint: () => 0x111111 },
      { mask: upper, outline: 0x050608, paint: () => 0x999999 },
    ], { left: -1, top: -3, width: 7, height: 5 });
    // 上の層の真下の画素は、上の層の輪郭で塗り替わる
    expect(getPixel(out, 2, 0)).toBe(0x050608);
    expect(getPixel(out, 0, 0)).toBe(0x111111);
    expect(getPixel(out, 2, -1)).toBe(0x999999);
  });
  it("輪郭のない層は塗りだけを重ねる", () => {
    const out = composeLayers([{ mask: block(), outline: null, paint: () => 0x123456 }], { left: -1, top: -1, width: 5, height: 5 });
    expect(getPixel(out, -1, 1)).toBe(TRANSPARENT);
    expect(getPixel(out, 0, 0)).toBe(0x123456);
  });
});

describe("opaqueBounds と toRgba", () => {
  it("不透明な画素を囲む最小の矩形を返す。空なら null", () => {
    const grid = createGrid(-4, -4, 8, 8);
    expect(opaqueBounds(grid)).toBeNull();
    setPixel(grid, -2, 1, 9);
    setPixel(grid, 3, -3, 9);
    expect(opaqueBounds(grid)).toEqual({ left: -2, top: -3, width: 6, height: 5 });
  });
  it("透明を alpha 0、色を不透明の RGBA にする", () => {
    const grid = createGrid(0, 0, 2, 1);
    setPixel(grid, 1, 0, 0x33ff66);
    expect(Array.from(toRgba(grid))).toEqual([0, 0, 0, 0, 0x33, 0xff, 0x66, 255]);
  });
});

describe("colorRuns", () => {
  it("行ごとに同じ色の連なりをまとめ、透明は飛ばす", () => {
    const grid = createGrid(-1, 2, 5, 2);
    fillRect(grid, -1, 2, 3, 1, 7);
    setPixel(grid, 3, 2, 8);
    fillRect(grid, 0, 3, 2, 1, 7);
    expect(colorRuns(grid)).toEqual([
      { x: -1, y: 2, w: 3, color: 7 },
      { x: 3, y: 2, w: 1, color: 8 },
      { x: 0, y: 3, w: 2, color: 7 },
    ]);
  });
});
