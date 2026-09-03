import { MAP_HEIGHT, MAP_WIDTH, createMask, type TerrainMask } from "@game/sim";

// 地形を整数演算だけで生成する補助。
// 浮動小数点を使わないので、Node とブラウザで同じマスクになる（設計書 02 の 2.8、TBD-4 の回避）。

/** 折れ線の頂点。x は昇順で、最初は 0、最後は MAP_WIDTH - 1 にする */
export type ProfilePoint = readonly [x: number, y: number];

/** 各列の地表の高さ。頂点の間は整数の線形補間（切り捨て） */
export const heightsFromProfile = (points: readonly ProfilePoint[]): number[] => {
  const heights: number[] = new Array<number>(MAP_WIDTH).fill(MAP_HEIGHT);
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, y0] = points[i] as ProfilePoint;
    const [x1, y1] = points[i + 1] as ProfilePoint;
    const span = x1 - x0;
    for (let x = x0; x <= x1 && x < MAP_WIDTH; x++) {
      heights[x] = span === 0 ? y0 : y0 + Math.floor(((y1 - y0) * (x - x0)) / span);
    }
  }
  return heights;
};

/** 地表から下端までを地面にする */
export const solidBelow = (heights: readonly number[]): TerrainMask => {
  const mask = createMask(MAP_WIDTH, MAP_HEIGHT);
  for (let x = 0; x < MAP_WIDTH; x++) {
    const top = heights[x] ?? MAP_HEIGHT;
    for (let y = Math.max(0, top); y < MAP_HEIGHT; y++) mask.cells[y * MAP_WIDTH + x] = 1;
  }
  return mask;
};

export type Slab = {
  readonly top: readonly ProfilePoint[];
  readonly bottom: readonly ProfilePoint[];
};

/** 上面と下面の折れ線に挟まれた板を地面にする。板の外は奈落 */
export const slabs = (list: readonly Slab[]): TerrainMask => {
  const mask = createMask(MAP_WIDTH, MAP_HEIGHT);
  for (const slab of list) {
    const tops = heightsFromProfile(slab.top);
    const bottoms = heightsFromProfile(slab.bottom);
    const x0 = slab.top[0]?.[0] ?? 0;
    const x1 = slab.top[slab.top.length - 1]?.[0] ?? -1;
    for (let x = x0; x <= x1; x++) {
      const top = tops[x] ?? MAP_HEIGHT;
      const bottom = Math.min(MAP_HEIGHT, bottoms[x] ?? MAP_HEIGHT);
      for (let y = Math.max(0, top); y < bottom; y++) mask.cells[y * MAP_WIDTH + x] = 1;
    }
  }
  return mask;
};
