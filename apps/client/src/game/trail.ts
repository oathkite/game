// 弾の軌跡と、前の射撃の軌跡。設計書 38 の E3 と E7。単位はセル。

export type TrailDot = { readonly x: number; readonly y: number; readonly recent: boolean };

/** 軌跡の点の間隔（位置列の添字） */
export const TRAIL_EVERY = 2;
/** 新しい点として明るく描く範囲（位置列の添字） */
export const TRAIL_RECENT = 20;

/** 弾が位置列の添字 index まで進んだときの軌跡。every おきに拾い、recent 以内の新しい点を明るくする。間引き済みの位置列（オンライン）は every と recent を詰めて渡す */
export const trailDots = (points: readonly { readonly x: number; readonly y: number }[], index: number, every: number = TRAIL_EVERY, recent: number = TRAIL_RECENT): readonly TrailDot[] => {
  const last = Math.min(points.length - 1, Math.floor(index));
  const dots: TrailDot[] = [];
  for (let i = 0; i < last; i += every) {
    const p = points[i];
    if (p) dots.push({ x: p.x, y: p.y, recent: last - i <= recent });
  }
  return dots;
};

/** 前の射撃の軌跡の点の間隔 */
export const GUIDE_EVERY = 3;

/** 前の射撃の軌跡。弾道ごとの位置列から GUIDE_EVERY おきに拾う。空の弾道は飛ばす */
export const guideDots = (paths: readonly (readonly { readonly x: number; readonly y: number }[])[]): readonly { readonly x: number; readonly y: number }[] =>
  paths.flatMap(points => points.filter((_, i) => i % GUIDE_EVERY === 0).map(p => ({ x: p.x, y: p.y })));
