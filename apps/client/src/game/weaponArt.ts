import type { CellPoint, WeaponId } from "@game/protocol";

// 武器の見た目。設計書 10 の 10.5 と 08 の 8.6。単位はセル。
// 戦車の絵は武器で変えない（形の整合が取れないため）。武器の違いは弾、尾、着弾の演出で出す。

export type BulletSize = { readonly w: number; readonly h: number };

/** 弾の見た目の大きさ（セル）。重い弾ほど大きく、針弾やマルチ弾の粒は小さい。物理の弾は常に 1 セル */
export const bulletSize = (weapon: WeaponId): BulletSize => {
  switch (weapon) {
    case "cannon":
      return { w: 1, h: 1 };
    case "triple":
      return { w: 0.8, h: 0.8 };
    case "multiple":
      return { w: 0.6, h: 0.6 };
    case "drill":
      // 進む向きに長い。回転して見せる
      return { w: 1.6, h: 0.8 };
    case "laser":
      // 細く長い線分。飛んでいる間に線として見える長さにする。太さは 1 セル 2 px でも 1 px 残る値
      return { w: 8, h: 0.5 };
    case "digger":
      return { w: 1.4, h: 1.4 };
    case "floater":
      return { w: 1.2, h: 1.2 };
    case "stinger":
      return { w: 1, h: 0.4 };
  }
};

/** Authored projectile sheets retain their origin; enlarge small silhouettes only for rendering. */
export const projectileArtScale = (weapon: WeaponId): number => ({
  cannon: 1.25, triple: 2.4, multiple: 3.5, drill: 1.3,
  laser: 2, digger: 1.2, floater: 1.5, stinger: 1.5,
})[weapon] / 12;

/** 爆風のセル。中心から半径 r の円をセルで塗る。ring なら縁の 1 セルの輪だけ（設計書 03 の 3.9 の消失） */
export const blastCells = (cx: number, cy: number, r: number, ring: boolean): readonly CellPoint[] => {
  const r2 = r * r;
  const inner = ring ? (r - 1) * (r - 1) : -1;
  const cells: CellPoint[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2 && d2 > inner) cells.push({ x: cx + dx, y: cy + dy });
    }
  }
  return cells;
};

/** 楕円の中（ring なら縁の 1 セル）。上端 top、下端 bottom、半幅 rx */
const ellipseCells = (cx: number, cy: number, rx: number, top: number, bottom: number, ring: boolean): readonly CellPoint[] => {
  const cells: CellPoint[] = [];
  const ry = (bottom - top) / 2, my = (bottom + top) / 2;
  const inside = (dx: number, dy: number, sx: number, sy: number): boolean => sx > 0 && sy > 0 && (dx * dx) / (sx * sx) + (dy * dy) / (sy * sy) <= 1;
  for (let dy = top; dy <= bottom; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      if (!inside(dx, dy - my, rx + 0.5, ry + 0.5)) continue;
      if (!ring || !inside(dx, dy - my, rx - 0.5, ry - 0.5)) cells.push({ x: cx + dx, y: cy + dy });
    }
  }
  return cells;
};

/** 横に細長い十字。ring なら両端だけを残す */
const crossCells = (cx: number, cy: number, r: number, ring: boolean): readonly CellPoint[] => {
  const arm = Math.max(1, Math.ceil(r / 2));
  if (ring) return [-1, 0, 1].flatMap(dy => [{ x: cx - r, y: cy + dy }, { x: cx + r, y: cy + dy }]);
  const horizontal = Array.from({ length: r * 2 + 1 }, (_, i) => ({ x: cx - r + i, y: cy }));
  const vertical = Array.from({ length: arm * 2 + 1 }, (_, i) => ({ x: cx, y: cy - arm + i })).filter(c => c.y !== cy);
  return [...horizontal, ...vertical];
};

/**
 * 武器ごとの爆風の形。設計書 38 の E4。削る範囲は sim の円のままで、見た目だけを変える。
 * レーザー弾は横に細い十字、掘削弾（digger）は下へ長い楕円、浮遊弾は内側にもう 1 つの輪を重ねる。ほかは円
 */
export const blastShapeCells = (weapon: WeaponId, cx: number, cy: number, r: number, ring: boolean): readonly CellPoint[] => {
  switch (weapon) {
    case "laser":
      return crossCells(cx, cy, r, ring);
    case "digger":
      return ellipseCells(cx, cy, Math.max(1, Math.ceil(r * 0.6)), -Math.ceil(r * 0.6), r, ring);
    case "floater":
      return ring || r < 4 ? blastCells(cx, cy, r, true) : [...blastCells(cx, cy, r, true), ...blastCells(cx, cy, Math.ceil(r / 2), true)];
    default:
      return blastCells(cx, cy, r, ring);
  }
};
