import type { TerrainOp, WeaponId } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { PALETTE, type Ramp } from "../palette";
import { ART_PER_CELL, type PixelGrid, type Rect } from "../pixelGrid";
import { craterFlames, surfaceLight, wreckSmokeColumn } from "./aftermathFx";
import type { FxLayer } from "./fxLayer";
import { craterGlow, impactSmoke, impactSparks, lightBurst, muzzleSmoke, trackDust, wreckDebris } from "./impactFx";
import { COOL_TABLE, HIT_TABLE, KILL_TABLE, WARM_TABLE, type GradeTable } from "./gradeTables";
import type { ScreenFx } from "./screenFx";
import { terrainDebris } from "./terrainDebris";
import { crossFlash, debrisHeatOf, debrisPowerOf, impactPaletteOf, weaponTrail, type TrailPoint } from "./weaponFx";

// 再生の外で寿命が尽きるまで描く演出の入口。設計書 41。
// 練習（replay.ts）とオンライン（NetworkField.tsx）が同じ呼び方で使う。age は生まれてからの ms で、再接続などで途中から描くときに使う。

export type ImpactSpec = {
  /** 爆心（セル） */
  readonly cx: number;
  readonly cy: number;
  /** 爆風半径（セル） */
  readonly radius: number;
  /** ダメージ段階（0〜3） */
  readonly tier: number;
  readonly seed: number;
  readonly age?: number;
  readonly weapon?: WeaponId;
  /** 着弾の瞬間の地形。表面を照らす光に使う。省けば地形を照らさない */
  readonly mask?: TerrainMask;
};

export type RendererEffects = {
  /** 地形が削れた瞬間。削れた地形の破片（D1）、赤熱する縁（I3）、クレーターの底の炎と火の粉 */
  readonly crater: (before: TerrainMask, after: TerrainMask, op: TerrainOp, seed: number, age?: number, weapon?: WeaponId) => void;
  /** 着弾。火花（I1）、煙（I2）、光（I4）、地形の表面の光、空の色の寄せ。ダメージ段階 3 では暗転（I5）も出す */
  readonly impact: (spec: ImpactSpec) => void;
  /** 撃破の瞬間（delay ms 後）に 1 コマだけ画面全体を白くし、空を赤く寄せる。1 秒に 1 回まで（I5） */
  readonly killFlash: (delay?: number) => void;
  /** 発射。砲口の煙の輪（段階 4）、発射光の光、武器の軌跡の粒（段階 5）。points は弾道の点（セル、発射からの ms） */
  readonly launch: (weapon: WeaponId, points: readonly TrailPoint[], seed: number, age?: number) => void;
  /** 走行の土煙。位置はセルで接地点 */
  readonly dust: (x: number, y: number, facing: 1 | -1, seed: number) => void;
  /** 撃破の破片と黒煙の柱。delay ms 後に機体の色で散らす */
  readonly wreck: (x: number, y: number, ramp: Ramp, seed: number, delay?: number) => void;
  /** 粒の時計を止める（ヒットストップ） */
  readonly freeze: (ms: number) => void;
  /** 今描いている粒の数。FX ラボと測定に使う */
  readonly particleCount: () => number;
  /** 粒をすべて消す。FX ラボで撃ち直すときに使う */
  readonly clear: () => void;
};

/** 暗転の長さ、全画面の光の長さと間隔（ms） */
export const DIM_MS = 300;
export const FLASH_MS = 34;
export const FLASH_GAP_MS = 1000;
/** 光の半径は爆風半径のこの倍で、上限のセル数を超えない。大きな爆風で光の模様が画面を覆わないようにする */
const LIGHT_SCALE = 1.3;
const LIGHT_MAX_CELLS = 14;
const LIGHT_MS = 300;
/** 地形の照り返しの基準にする爆風半径の上限（セル）。照らすのはその 1.8 倍まで */
const SURFACE_MAX_CELLS = 11;
const MUZZLE_LIGHT_CELLS = 6;
const MUZZLE_LIGHT_MS = 140;
/** クレーターの底に炎を置く爆風半径の下限（セル）。マルチ弾の 9 発では炎を出さない */
const FLAME_MIN_RADIUS = 6;
/** 空の色を寄せる長さと、武器と大ダメージの色（設計書 41.13） */
const TINT_MS = 450;
const KILL_TINT_MS = 500;
/** 武器の色を先に、無ければダメージ段階 3 の赤。浮遊弾の直撃も青に寄せる（評価の 3 回目） */
const tintOf = (weapon: WeaponId, tier: number): GradeTable | null => {
  if (weapon === "digger") return WARM_TABLE;
  if (weapon === "floater" || weapon === "laser") return COOL_TABLE;
  return tier >= 3 ? HIT_TABLE : null;
};

type Deps = {
  readonly fx: FxLayer;
  readonly screenFx: ScreenFx;
  readonly texels: ((mask: TerrainMask, rect: Rect) => PixelGrid) | undefined;
  readonly screen: () => { readonly width: number; readonly height: number };
  readonly reduced: () => boolean;
  /** 走行の土煙の色。ステージの土の色（明るい順） */
  readonly soil: readonly number[];
};

const emitImpact = (d: Deps, s: ImpactSpec): void => {
  const age = s.age ?? 0, weapon = s.weapon ?? "cannon", colors = impactPaletteOf(weapon), from = d.fx.now() - age;
  d.fx.emit("front", impactSparks(s.cx, s.cy, s.radius, s.seed, colors.sparks), age);
  d.fx.emit("back", impactSmoke(s.cx, s.cy, s.radius, s.seed), age);
  d.fx.emit("back", lightBurst({ cx: s.cx, cy: s.cy, radius: Math.min(s.radius * LIGHT_SCALE, LIGHT_MAX_CELLS) * ART_PER_CELL, duration: LIGHT_MS, strength: 1, inner: colors.lightInner, outer: colors.lightOuter }), age);
  if (s.mask) d.fx.emit("back", surfaceLight(s.mask, s.cx, s.cy, Math.min(s.radius, SURFACE_MAX_CELLS) * ART_PER_CELL, colors.lightInner, colors.lightOuter), age);
  if (weapon === "laser") d.fx.emit("front", crossFlash(s.cx, s.cy, s.seed), age);
  if (d.reduced()) return;
  const tint = tintOf(weapon, s.tier);
  if (tint !== null) d.screenFx.tintAt(tint, from, TINT_MS);
  if (s.tier >= 3) d.screenFx.dimAt(s.cx, s.cy, Math.min(s.radius * LIGHT_SCALE, LIGHT_MAX_CELLS), from, DIM_MS);
};

export const createRendererEffects = (d: Deps): RendererEffects & { readonly tick: () => void } => {
  let lastFlash = -Infinity;
  return {
    crater: (before, after, op, seed, age = 0, weapon = "cannon") => {
      const texels = d.texels;
      if (texels) d.fx.emit("under", terrainDebris({ before, after, op, seed, power: debrisPowerOf(weapon), heat: debrisHeatOf(weapon), texels: (rect) => texels(before, rect) }), age);
      d.fx.emit("back", craterGlow(before, after, op, seed), age);
      if (op.radius >= FLAME_MIN_RADIUS) d.fx.emit("back", craterFlames(after, op, seed), age);
    },
    impact: (spec) => emitImpact(d, spec),
    killFlash: (delay = 0) => {
      const at = d.fx.now() + Math.max(0, delay);
      if (d.reduced() || at - lastFlash < FLASH_GAP_MS) return;
      lastFlash = at;
      d.screenFx.flashAt(at, FLASH_MS);
      d.screenFx.tintAt(KILL_TABLE, at, KILL_TINT_MS);
    },
    launch: (weapon, points, seed, age = 0) => {
      const a = points[0], b = points[1];
      if (d.reduced() || !a || !b) return;
      d.fx.emit("front", muzzleSmoke(a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x), seed), age);
      // 発射光（40.5）の光。砲口から 6 セル、140 ms
      d.fx.emit("back", lightBurst({ cx: a.x - 0.5, cy: a.y - 0.5, radius: MUZZLE_LIGHT_CELLS * ART_PER_CELL, duration: MUZZLE_LIGHT_MS, strength: 0.8, inner: PALETTE.fire1, outer: PALETTE.fire2 }), age);
      const trail = weaponTrail(weapon, points, seed);
      if (trail) d.fx.emit("back", trail, age);
    },
    dust: (x, y, facing, seed) => { if (!d.reduced()) d.fx.emit("back", trackDust(x, y, facing, d.soil.slice(0, 2), seed)); },
    wreck: (x, y, ramp, seed, delay = 0) => {
      if (d.reduced()) return;
      d.fx.emit("front", wreckDebris(x, y, [ramp.light, ramp.base, ramp.shadow, PALETTE.metal1, PALETTE.metal2], seed), -delay);
      d.fx.emit("back", wreckSmokeColumn(x, y, seed), -delay);
    },
    freeze: (ms) => { if (!d.reduced()) d.fx.freeze(ms); },
    particleCount: d.fx.count,
    clear: () => { d.fx.clear(); d.screenFx.clear(); lastFlash = -Infinity; },
    tick: () => d.screenFx.tick(d.fx.now(), d.screen()),
  };
};
