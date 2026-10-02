import type { WeaponId } from "@game/protocol";
import type { ProjectileArt } from "../projectileSprite";
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
  /** あれば、時間ではなく道のりの間隔（art px）で置く。速いレーザー弾で点線にならないようにする */
  readonly spacing?: number;
  readonly ramp: readonly number[];
  readonly life: number;
  readonly size: number;
  /** 上へ漂う速さ（art px/秒）と、横のばらつき */
  readonly rise: number;
  readonly jitter: number;
  /** あれば、弾の中心からこの距離（セル）だけ後ろに置き、この速さ（art px/秒）で後ろへ流す。ロケットの噴射を尾から出す */
  readonly behind?: number;
  readonly exhaust?: number;
};

const SMOKE: readonly number[] = SMOKE_RAMP.slice(1);

/** 武器ごとの軌跡。null の武器は軌跡の粒を出さない（貫通弾は掘り進む破片、掘削弾は導火線の火花が個性） */
export const TRAIL_STYLES: Readonly<Record<ProjectileArt, TrailStyle | null>> = {
  cannon: { every: 33, ramp: SMOKE, life: 450, size: 2, rise: 10, jitter: 4 },
  triple: { every: 33, ramp: SMOKE, life: 300, size: 1, rise: 8, jitter: 3 },
  multiple: { every: 50, ramp: [PALETTE.fire1, PALETTE.fire2, PALETTE.fire3], life: 200, size: 1, rise: 0, jitter: 30 },
  drill: null,
  // 間を空けずに並べて 1 本の線に見せる。白い芯から発光色へ冷める（設計書 41.13 の評価で点線から改めた）
  laser: { every: 4, spacing: 1, ramp: [PALETTE.white, PALETTE.energy0, PALETTE.energy1, PALETTE.energy2], life: 380, size: 2, rise: 0, jitter: 0 },
  digger: null,
  floater: { every: 66, ramp: [PALETTE.energy1, PALETTE.energy2], life: 350, size: 2, rise: 0, jitter: 6 },
  stinger: { every: 16, ramp: [PALETTE.white, PALETTE.starDim], life: 110, size: 1, rise: 0, jitter: 0 },
  // テレポートのロケットの噴射（設計書 42.3）。炎の先から出て後ろへ流れ、白から炎の色、煙へ冷める
  teleport: { every: 10, ramp: [PALETTE.white, PALETTE.fire1, PALETTE.fire2, PALETTE.fire3, PALETTE.fire4, ...SMOKE], life: 650, size: 2, rise: 4, jitter: 9, behind: 3, exhaust: 30 },
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

/** 道のり（art px）を spacing ごとに区切った時刻。点の間の時刻は直線で補う */
const timesBySpacing = (points: readonly TrailPoint[], spacing: number): number[] => {
  const times: number[] = [];
  let carried = 0;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]!, b = points[k]!, length = Math.hypot(b.x - a.x, b.y - a.y) * ART_PER_CELL;
    for (let d = spacing - carried; d <= length; d += spacing) times.push(a.at + (b.at - a.at) * (d / Math.max(1e-6, length)));
    carried = (carried + length) % spacing;
  }
  return times;
};

/** at の時刻の進む向き（単位ベクトル）。止まっていれば右 */
const headingAt = (points: readonly TrailPoint[], at: number): { readonly x: number; readonly y: number } => {
  const a = pointAt(points, at - 16), b = pointAt(points, at + 16), length = Math.hypot(b.x - a.x, b.y - a.y);
  return length > 1e-6 ? { x: (b.x - a.x) / length, y: (b.y - a.y) / length } : { x: 1, y: 0 };
};

/** 武器の軌跡の粒。弾が通る時刻に、通った位置（behind があればその後ろ）に生まれる */
export const weaponTrail = (weapon: ProjectileArt, points: readonly TrailPoint[], seed: number): ParticleBatch | null => {
  const style = TRAIL_STYLES[weapon];
  if (!style || points.length < 2) return null;
  const end = points[points.length - 1]!.at;
  const times = style.spacing ? timesBySpacing(points, style.spacing) : Array.from({ length: Math.max(0, Math.floor(end / style.every)) }, (_, i) => (i + 1) * style.every);
  const count = times.length;
  const b = allocBatch(count, { ramps: [style.ramp], gravity: 0, drag: 1.5 });
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, TRAIL, i), at = times[i]!, p = pointAt(points, at);
    const u = style.behind || style.exhaust ? headingAt(points, at) : { x: 0, y: 0 }, behind = style.behind ?? 0, exhaust = style.exhaust ?? 0;
    b.x0[i] = (p.x - u.x * behind) * ART_PER_CELL; b.y0[i] = (p.y - u.y * behind) * ART_PER_CELL;
    b.vx[i] = (unit(hash32(h, 1)) * 2 - 1) * style.jitter - u.x * exhaust;
    b.vy[i] = -style.rise + (unit(hash32(h, 2)) * 2 - 1) * style.jitter - u.y * exhaust;
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

/** 十字の腕と、その外側 1 art px の暗い縁 */
const CROSS_ARMS: readonly (readonly [number, number])[] = [[0, 0], [1, 0], [2, 0], [-1, 0], [-2, 0], [0, 1], [0, 2], [0, -1], [0, -2]];
const CROSS_EDGE: readonly (readonly [number, number])[] = [[3, 0], [-3, 0], [0, 3], [0, -3], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2]];

/** レーザー弾の段ごとの十字の閃光。5 × 5 art px の水色の十字に暗い縁を付けて 120 ms。白く光った機体の上でも見えるようにする（評価の 3 回目）。位置はセル */
export const crossFlash = (cx: number, cy: number, seed: number): ParticleBatch => {
  const b = allocBatch(CROSS_ARMS.length + CROSS_EDGE.length, { ramps: [[PALETTE.energy0, PALETTE.energy1], [PALETTE.outline]], gravity: 0, drag: 0 });
  const x = Math.floor((cx + 0.5) * ART_PER_CELL), y = Math.floor((cy + 0.5) * ART_PER_CELL);
  [...CROSS_ARMS, ...CROSS_EDGE].forEach(([dx, dy], i) => {
    b.x0[i] = x + dx; b.y0[i] = y + dy; b.life[i] = 120; b.ramp[i] = i < CROSS_ARMS.length ? 0 : 1;
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
