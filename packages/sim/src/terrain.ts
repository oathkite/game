import type { TerrainOp } from "@game/protocol";

// 地形マスク。1 セル 1 バイトで「地面がある」を 1 とする。
// 設計書 02 のとおり、判定はセル単位で行う。

export type TerrainMask = {
  readonly width: number;
  readonly height: number;
  /** 長さ width * height。添字は y * width + x */
  readonly cells: Uint8Array;
};

export const createMask = (width: number, height: number): TerrainMask => ({
  width,
  height,
  cells: new Uint8Array(width * height),
});

export const isSolid = (mask: TerrainMask, x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
  return mask.cells[y * mask.width + x] === 1;
};

/**
 * x 列の地表の高さ。上から見て最初に地面があるセルの y を返す。
 * 地面がなければ height を返す（下端より下、つまり奈落）。
 */
export const surfaceY = (mask: TerrainMask, x: number): number => {
  if (x < 0 || x >= mask.width) return mask.height;
  for (let y = 0; y < mask.height; y++) {
    if (mask.cells[y * mask.width + x] === 1) return y;
  }
  return mask.height;
};

/** 円形に削った新しいマスクを返す。元のマスクは変えない */
export const carve = (mask: TerrainMask, op: TerrainOp): TerrainMask => {
  const cells = new Uint8Array(mask.cells);
  const r2 = op.radius * op.radius;
  const x0 = Math.max(0, op.cx - op.radius);
  const x1 = Math.min(mask.width - 1, op.cx + op.radius);
  const y0 = Math.max(0, op.cy - op.radius);
  const y1 = Math.min(mask.height - 1, op.cy + op.radius);
  for (let y = y0; y <= y1; y++) {
    const dy = y - op.cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - op.cx;
      if (dx * dx + dy * dy <= r2) cells[y * mask.width + x] = 0;
    }
  }
  return { width: mask.width, height: mask.height, cells };
};

/** 複数の削りを順に適用する。再接続時の地形復元に使う */
export const applyOps = (mask: TerrainMask, ops: readonly TerrainOp[]): TerrainMask =>
  ops.reduce<TerrainMask>((acc, op) => carve(acc, op), mask);

/**
 * 各列の地表の高さから平坦な地形を作る。テストとマップ生成の補助。
 * heights[x] より下（y >= heights[x]）を地面にする。
 */
export const maskFromHeights = (heights: readonly number[], height: number): TerrainMask => {
  const width = heights.length;
  const mask = createMask(width, height);
  for (let x = 0; x < width; x++) {
    const top = heights[x] ?? height;
    for (let y = Math.max(0, top); y < height; y++) mask.cells[y * width + x] = 1;
  }
  return mask;
};
