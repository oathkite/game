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

/** 尾を残す間隔（ステップ）。0 なら尾を残さない。レーザー弾は毎ステップ残して線に、針弾は残さない */
export const trailStep = (weapon: WeaponId): number => {
  switch (weapon) {
    case "laser":
      return 1;
    case "stinger":
      return 0;
    case "multiple":
      return 3;
    default:
      return 2;
  }
};

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
