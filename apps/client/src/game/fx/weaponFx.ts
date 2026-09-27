import type { WeaponId } from "@game/protocol";
import { PALETTE, SMOKE_RAMP } from "../palette";
import { ART_PER_CELL } from "../pixelGrid";
import { hash32, unit } from "./hash";
import { allocBatch, type ParticleBatch } from "./particles";

// 武器ごとの個性。設計書 41 の段階 5。軌跡の粒と、着弾の火花と光の色を武器で変える。
// 軌跡は発射の瞬間に 1 つのまとまりで出し、弾がその点を通る時刻に生まれる粒にする。練習もオンラインも同じ式で描ける。

/** 弾道の点。位置はセル、at は発射からの ms */
export type TrailPoint = { readonly x: number; readonly y: number; readonly at: number };

type TrailStyle = {
  /** 粒を置く間隔（ms） */
  readonly every: number;
  readonly ramp: readonly number[];
  readonly life: number;
  readonly size: number;
  /** 上へ漂う速さ（art px/秒）と、横のばらつき */
  readonly rise: number;
  readonly jitter: number;
};

const SMOKE: readonly number[] = SMOKE_RAMP.slice(1);

/** 武器ごとの軌跡。null の武器は軌跡の粒を出さない（貫通弾は掘り進む破片、掘削弾は導火線の火花が個性） */
export const TRAIL_STYLES: Readonly<Record<WeaponId, TrailStyle | null>> = {
  cannon: { every: 33, ramp: SMOKE, life: 450, size: 2, rise: 10, jitter: 4 },
  triple: { every: 33, ramp: SMOKE, life: 300, size: 1, rise: 8, jitter: 3 },
  multiple: { every: 50, ramp: [PALETTE.fire1, PALETTE.fire2, PALETTE.fire3], life: 200, size: 1, rise: 0, jitter: 30 },
  drill: null,
  // 間を空けずに並べて 1 本の線に見せる。白い芯から発光色へ冷める（設計書 41.13 の評価で点線から改めた）
  laser: { every: 4, ramp: [PALETTE.white, PALETTE.energy0, PALETTE.energy1, PALETTE.energy2], life: 380, size: 2, rise: 0, jitter: 0 },
  digger: null,
  floater: { every: 66, ramp: [PALETTE.energy1, PALETTE.energy2], life: 350, size: 2, rise: 0, jitter: 6 },
  stinger: { every: 16, ramp: [PALETTE.white, PALETTE.starDim], life: 110, size: 1, rise: 0, jitter: 0 },
};

const TRAIL = 8;

/** 点の列の at の時刻の位置。点の間は直線でつなぐ */
const pointAt = (points: readonly TrailPoint[], at: number): { readonly x: number; readonly y: number } => {
  const right = points.findIndex(p => p.at >= at);
  if (right <= 0) return points[right === 0 ? 0 : points.length - 1]!;
  const a = points[right - 1]!, b = points[right]!;
  const f = b.at === a.at ? 0 : (at - a.at) / (b.at - a.at);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
};

/** 武器の軌跡の粒。弾が通る時刻に、通った位置に生まれる */
export const weaponTrail = (weapon: WeaponId, points: readonly TrailPoint[], seed: number): ParticleBatch | null => {
  const style = TRAIL_STYLES[weapon];
  if (!style || points.length < 2) return null;
  const end = points[points.length - 1]!.at, count = Math.max(0, Math.floor(end / style.every));
  const b = allocBatch(count, { ramps: [style.ramp], gravity: 0, drag: 1.5 });
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, TRAIL, i), at = (i + 1) * style.every, p = pointAt(points, at);
    b.x0[i] = p.x * ART_PER_CELL; b.y0[i] = p.y * ART_PER_CELL;
    b.vx[i] = (unit(hash32(h, 1)) * 2 - 1) * style.jitter;
    b.vy[i] = -style.rise + (unit(hash32(h, 2)) * 2 - 1) * style.jitter;
    b.t0[i] = at; b.life[i] = style.life * (0.8 + 0.4 * unit(hash32(h, 3)));
    b.size[i] = style.size; b.fade[i] = unit(hash32(h, 4));
  }
  return b;
};

/** 着弾の火花と光の色。レーザー弾と浮遊弾は発光色、ほかは炎の色 */
export type ImpactPalette = { readonly sparks: readonly number[]; readonly lightInner: number; readonly lightOuter: number };

const FIRE: ImpactPalette = { sparks: [PALETTE.white, PALETTE.fire1, PALETTE.fire2, PALETTE.fire3, PALETTE.fire5], lightInner: PALETTE.fire1, lightOuter: PALETTE.fire3 };
const ENERGY: ImpactPalette = { sparks: [PALETTE.white, PALETTE.energy0, PALETTE.energy1, PALETTE.energy2], lightInner: PALETTE.energy0, lightOuter: PALETTE.energy2 };

export const impactPaletteOf = (weapon: WeaponId): ImpactPalette => (weapon === "laser" || weapon === "floater" ? ENERGY : FIRE);

const CROSS = 9;

/** レーザー弾の段ごとの十字の閃光。5 × 5 art px の白い十字を 120 ms（腕の先は 70 ms）。位置はセル */
export const crossFlash = (cx: number, cy: number, seed: number): ParticleBatch => {
  const arms = [[0, 0], [1, 0], [2, 0], [-1, 0], [-2, 0], [0, 1], [0, 2], [0, -1], [0, -2]] as const;
  const b = allocBatch(arms.length, { ramps: [[PALETTE.white, PALETTE.energy0]], gravity: 0, drag: 0 });
  const x = Math.floor((cx + 0.5) * ART_PER_CELL), y = Math.floor((cy + 0.5) * ART_PER_CELL);
  arms.forEach(([dx, dy], i) => {
    b.x0[i] = x + dx; b.y0[i] = y + dy; b.life[i] = Math.abs(dx) + Math.abs(dy) === 2 ? 70 : 120;
    b.size[i] = 1; b.fade[i] = unit(hash32(seed, CROSS, i));
  });
  return b;
};

/** 削れた地形の破片のうち熱い粒の色の段。レーザー弾と浮遊弾は発光色で冷める（設計書 41.13 の評価の 2 回目） */
export const debrisHeatOf = (weapon: WeaponId): readonly number[] =>
  weapon === "laser" || weapon === "floater"
    ? [PALETTE.energy0, PALETTE.energy1, PALETTE.energy1, PALETTE.energy2, PALETTE.energy2, PALETTE.sky4, PALETTE.sky4]
    : [PALETTE.fire1, PALETTE.fire2, PALETTE.fire3, PALETTE.fire3, PALETTE.fire5, PALETTE.fire5, PALETTE.fire5];

/** 削れた地形の破片の勢いの倍率。掘削弾は土を多く高く噴き上げる */
export const debrisPowerOf = (weapon: WeaponId): number => (weapon === "digger" ? 1.35 : 1);
