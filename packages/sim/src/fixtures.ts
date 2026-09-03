import type { TrajectoryInput } from "@game/protocol";
import { MAP_HEIGHT, MAP_WIDTH } from "./constants.js";
import { maskFromHeights, type TerrainMask } from "./terrain.js";

// テストと golden replay で使う地形。src に置くのは、ブラウザでも同じケースを走らせるため。

/** 平坦な地形。地表は y = 150 */
export const flatMask = (surface = 150): TerrainMask =>
  maskFromHeights(Array.from({ length: MAP_WIDTH }, () => surface), MAP_HEIGHT);

/** 「谷」風の地形。中央が深く落ち込み、左右は高台 */
export const valleyMask = (): TerrainMask => {
  const heights = Array.from({ length: MAP_WIDTH }, (_, x) => {
    const t = (x - MAP_WIDTH / 2) / (MAP_WIDTH / 2);
    const depth = Math.round(60 * Math.max(0, 1 - Math.abs(t) * 2.2));
    return 140 + depth;
  });
  return maskFromHeights(heights, MAP_HEIGHT);
};

/** 一部の列に地面がない浮島 */
export const islandMask = (): TerrainMask => {
  const heights = Array.from({ length: MAP_WIDTH }, (_, x) => {
    const onIsland = (x >= 40 && x <= 120) || (x >= 280 && x <= 360);
    return onIsland ? 150 : MAP_HEIGHT;
  });
  return maskFromHeights(heights, MAP_HEIGHT);
};

/**
 * 傾き付きの地形。pivot の前後 40 セルだけ、x が 6 進むごとに高さが slopePer6 セル変わる（右が高いと正）。
 * それより外は平坦にして、地表が画面外に出ないようにする。
 */
export const slopedMask = (slopePer6: number, pivot = 100, surfaceAtPivot = 150): TerrainMask => {
  const heights = Array.from({ length: MAP_WIDTH }, (_, x) => {
    const d = Math.max(-40, Math.min(40, x - pivot));
    return surfaceAtPivot - Math.round((d * slopePer6) / 6);
  });
  return maskFromHeights(heights, MAP_HEIGHT);
};

/** 平地の途中に垂直の壁がある地形。x >= wallX は wallTop まで盛り上がる */
export const wallMask = (wallX: number, wallTop: number, surface = 150): TerrainMask =>
  maskFromHeights(Array.from({ length: MAP_WIDTH }, (_, x) => (x >= wallX ? wallTop : surface)), MAP_HEIGHT);

/** 薄い板状の島。[x0, x1] の範囲に、top から thickness セルだけ地面を置く。下は奈落 */
export const slabMask = (ranges: readonly (readonly [number, number])[], top: number, thickness: number): TerrainMask => {
  const cells = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  for (const [x0, x1] of ranges) {
    for (let x = x0; x <= x1; x++) {
      for (let y = top; y < top + thickness; y++) cells[y * MAP_WIDTH + x] = 1;
    }
  }
  return { width: MAP_WIDTH, height: MAP_HEIGHT, cells };
};

export const shot = (over: Partial<TrajectoryInput> = {}): TrajectoryInput => ({
  seat: 0,
  x: 60,
  facing: 1,
  elevation: 45,
  power: 60,
  wind: 0,
  ...over,
});

/** マスクを左右反転する。対称性テストに使う */
export const mirrorMask = (mask: TerrainMask): TerrainMask => {
  const cells = new Uint8Array(mask.cells.length);
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      cells[y * mask.width + (mask.width - 1 - x)] = mask.cells[y * mask.width + x] ?? 0;
    }
  }
  return { width: mask.width, height: mask.height, cells };
};

export const mirrorX = (mask: TerrainMask, x: number): number => mask.width - 1 - x;
