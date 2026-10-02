import type { TerrainOp, WeaponId } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { PALETTE, type Ramp } from "../palette";
import { ART_PER_CELL, type PixelGrid, type Rect } from "../pixelGrid";
import { craterFlames, flameGlow, surfaceLight, WRECK_SMOKE_COUNT, wreckSmokeBirth, wreckSmokeColumn } from "./aftermathFx";
import type { FxLayer } from "./fxLayer";
import { partitionBatch } from "./particles";
import { craterGlow, impactSmoke, impactSparks, lightBurst, muzzleSmoke, trackDust, wreckDebris } from "./impactFx";
import { FLOATER_TABLE, KILL_TABLE, LASER_TABLE, TINT_PRIORITY, WARM_TABLE, type GradeTable } from "./gradeTables";
import type { ScreenFx } from "./screenFx";
import type { ProjectileArt } from "../projectileSprite";
import { terrainDebris } from "./terrainDebris";
import { hash32 } from "./hash";
import { ARRIVE_BEAM, DEPART_BEAM, teleportBeam, teleportBloom, teleportBurst, teleportMotes, teleportRing, teleportShock, teleportStreak, teleportTwinkles } from "./teleportFx";
import { TELEPORT_ARRIVE_MS } from "../teleportMotion";
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

/** テレポート（設計書 42.3）。from は撃った位置、to は着地点の接地点、hit は弾が当たった点（セル）。age は着弾からの ms */
export type TeleportSpec = {
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly hit: { readonly x: number; readonly y: number };
  readonly seed: number;
  readonly age?: number;
  /** 着弾の瞬間の地形。着地点のまわりの地表を照らすのに使う */
  readonly mask?: TerrainMask;
};

export type RendererEffects = {
  /** 地形が削れた瞬間。削れた地形の破片（D1）、赤熱する縁（I3）、クレーターの底の炎と火の粉 */
  readonly crater: (before: TerrainMask, after: TerrainMask, op: TerrainOp, seed: number, age?: number, weapon?: WeaponId) => void;
  /** 着弾。火花（I1）、煙（I2）、光（I4）、地形の表面の光、空の色の寄せ。ダメージ段階 3 では暗転（I5）も出す */
  readonly impact: (spec: ImpactSpec) => void;
  /** 撃破の瞬間（delay ms 後）に 34 ms だけ画面全体を白くし、空を赤く寄せる。白の長さはヒットストップで延ばさない。1 秒に 1 回まで（I5） */
  readonly killFlash: (delay?: number) => void;
  /** 発射。砲口の煙の輪（段階 4）、発射光の光、武器の軌跡の粒（段階 5）。points は弾道の点（セル、発射からの ms） */
  /** 発射の煙と光と、弾の絵ごとの軌跡の粒（テレポートはロケットの噴射） */
  readonly launch: (weapon: ProjectileArt, points: readonly TrailPoint[], seed: number, age?: number) => void;
  /** テレポートの着弾。撃った位置と着地点に光の柱を立て、光の粒、地を走る光の輪、現れる瞬間の火花を出し、空を青へ寄せる */
  readonly teleport: (spec: TeleportSpec) => void;
  /** 走行の土煙。位置はセルで接地点 */
  readonly dust: (x: number, y: number, facing: 1 | -1, seed: number) => void;
  /** 撃破の破片と煙の柱。delay ms 後に機体の色で散らす。seat があれば、煙の柱をその機体の今の位置から出し続ける */
  readonly wreck: (x: number, y: number, ramp: Ramp, seed: number, delay?: number, seat?: number) => void;
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
const MUZZLE_LIGHT_CELLS = 6;
const MUZZLE_LIGHT_MS = 140;
/** クレーターの底に炎を置く爆風半径の下限（セル）。マルチ弾の 9 発では炎を出さない */
const FLAME_MIN_RADIUS = 6;
/** 空の色を寄せる長さ（設計書 41.13）。レーザー弾は短く、浮遊弾は長く */
const TINT_MS: Readonly<Record<"digger" | "laser" | "floater", number>> = { digger: 450, laser: 200, floater: 500 };
const KILL_TINT_MS = 500;
/** 武器ごとの空の色。ダメージ段階 3 は暗転だけで空を寄せない（赤は撃破だけに使う。評価の 3 回目） */
const tintOf = (weapon: WeaponId): { readonly table: GradeTable; readonly ms: number } | null => {
  if (weapon === "digger") return { table: WARM_TABLE, ms: TINT_MS.digger };
  if (weapon === "laser") return { table: LASER_TABLE, ms: TINT_MS.laser };
  if (weapon === "floater") return { table: FLOATER_TABLE, ms: TINT_MS.floater };
  return null;
};

type Deps = {
  readonly fx: FxLayer;
  readonly screenFx: ScreenFx;
  readonly texels: ((mask: TerrainMask, rect: Rect) => PixelGrid) | undefined;
  readonly screen: () => { readonly width: number; readonly height: number };
  readonly reduced: () => boolean;
  /** 走行の土煙の色。ステージの土の色（明るい順） */
  readonly soil: readonly number[];
  /** 機体 seat の今の接地点（セル）。見えていなければ null */
  readonly tankAt?: (seat: number) => { readonly x: number; readonly y: number } | null;
};

/** 煙の柱を出し直す粒の数。4 粒（350 ms）ごとに、その時の残骸の位置から出す（評価の 4 回目で、落ちた残骸から根元が離れた） */
const SMOKE_CHUNK = 4;

/** 出し終えていない煙の柱。start は柱の始まりの時刻（FX の時計）、next は次に出す粒 */
type SmokeSource = { readonly x: number; readonly y: number; readonly seed: number; readonly start: number; readonly seat: number | undefined; readonly next: number };

const emitImpact = (d: Deps, s: ImpactSpec): void => {
  const age = s.age ?? 0, weapon = s.weapon ?? "cannon", colors = impactPaletteOf(weapon), from = d.fx.now() - age;
  d.fx.emit("front", impactSparks(s.cx, s.cy, s.radius, s.seed, colors.sparks), age);
  d.fx.emit("back", impactSmoke(s.cx, s.cy, s.radius, s.seed), age);
  d.fx.emit("back", lightBurst({ cx: s.cx, cy: s.cy, radius: Math.min(s.radius * LIGHT_SCALE, LIGHT_MAX_CELLS) * ART_PER_CELL, duration: LIGHT_MS, strength: 1, inner: colors.lightInner, outer: colors.lightOuter }), age);
  if (s.mask) d.fx.emit("back", surfaceLight(s.mask, s.cx, s.cy, s.radius * ART_PER_CELL, colors.lightInner, colors.lightOuter), age);
  if (weapon === "laser") d.fx.emit("front", crossFlash(s.cx, s.cy, s.seed), age);
  if (d.reduced()) return;
  const tint = tintOf(weapon);
  if (tint !== null) d.screenFx.tintAt(tint.table, from, tint.ms);
  if (s.tier >= 3) d.screenFx.dimAt(s.cx, s.cy, Math.min(s.radius * LIGHT_SCALE, LIGHT_MAX_CELLS), from, DIM_MS);
};

/** 着地点の地表の照り返しの大きさ（セル） */
const TELEPORT_POOL_CELLS = 10;
const TELEPORT_TINT_MS = 600;

const emitTeleport = (d: Deps, s: TeleportSpec): void => {
  if (d.reduced()) return;
  const age = s.age ?? 0, arrive = age - TELEPORT_ARRIVE_MS;
  // 弾が当たった点の短い光と火花
  d.fx.emit("back", lightBurst({ cx: s.hit.x, cy: s.hit.y, radius: 2.5 * ART_PER_CELL, duration: 200, strength: 0.8, inner: PALETTE.energy0, outer: PALETTE.energy2 }), age);
  d.fx.emit("front", impactSparks(s.hit.x, s.hit.y, 3, s.seed, [PALETTE.white, PALETTE.energy0, PALETTE.energy1, PALETTE.energy2]), age);
  // 撃った位置。機体が白く光って消えるあいだの低い柱
  d.fx.emit("back", teleportBeam(s.from.x, s.from.y, DEPART_BEAM), age);
  d.fx.emit("front", teleportMotes(s.from.x, s.from.y, hash32(s.seed, 1), 14, DEPART_BEAM, 0), age);
  // 着地点。空から降りて閃く柱、地表の照り返し、立ちのぼる粒、現れる瞬間の光の筋と輪、地を走る光、火花
  d.fx.emit("back", teleportBloom(s.to.x, s.to.y, ARRIVE_BEAM.descend), age);
  d.fx.emit("back", teleportBeam(s.to.x, s.to.y, ARRIVE_BEAM), age);
  d.fx.emit("front", teleportTwinkles(s.to.x, s.to.y, hash32(s.seed, 5), 90, 60, 1000), age);
  d.fx.emit("front", teleportStreak(s.to.x, s.to.y, TELEPORT_ARRIVE_MS), age);
  d.fx.emit("front", teleportShock(s.to.x, s.to.y, TELEPORT_ARRIVE_MS), age);
  if (s.mask) d.fx.emit("back", surfaceLight(s.mask, s.to.x, s.to.y, TELEPORT_POOL_CELLS * ART_PER_CELL, PALETTE.energy0, PALETTE.energy2), arrive + 120);
  d.fx.emit("front", teleportMotes(s.to.x, s.to.y, hash32(s.seed, 2), 60, ARRIVE_BEAM, 80), age);
  d.fx.emit("front", teleportRing(s.to.x, s.to.y, hash32(s.seed, 3), TELEPORT_ARRIVE_MS), age);
  d.fx.emit("front", teleportBurst(s.to.x, s.to.y, hash32(s.seed, 4), TELEPORT_ARRIVE_MS), age);
  d.screenFx.tintAt(FLOATER_TABLE, d.fx.now() - age, TELEPORT_TINT_MS);
};

/** 時刻 now までに生まれる煙の柱の粒を出し、出し終えていない柱を返す。残骸が見えなくなったら（場外）柱を終える */
const emitSmoke = (d: Deps, sources: readonly SmokeSource[], now: number): readonly SmokeSource[] => sources.flatMap((s) => {
  let next = s.next;
  while (next < WRECK_SMOKE_COUNT && s.start + wreckSmokeBirth(next) <= now) {
    const at = s.seat !== undefined && d.tankAt ? d.tankAt(s.seat) : { x: s.x, y: s.y };
    if (at === null) return [];
    d.fx.emit("back", wreckSmokeColumn(at.x, at.y, s.seed, next, next + SMOKE_CHUNK), now - s.start);
    next += SMOKE_CHUNK;
  }
  return next < WRECK_SMOKE_COUNT ? [{ ...s, next }] : [];
});

export const createRendererEffects = (d: Deps): RendererEffects & { readonly tick: (deltaMs: number) => void } => {
  let lastFlash = -Infinity, smokes: readonly SmokeSource[] = [];
  return {
    crater: (before, after, op, seed, age = 0, weapon = "cannon") => {
      const texels = d.texels;
      if (texels) {
        // 地面で跳ねる破片は地形の手前に、落ちていく破片は地形の奥に描く（設計書 41.5）
        const debris = terrainDebris({ before, after, op, seed, power: debrisPowerOf(weapon), heat: debrisHeatOf(weapon), texels: (rect) => texels(before, rect) });
        const [bouncing, falling] = partitionBatch(debris, i => (debris.bounce?.hitAt[i] ?? Infinity) < Infinity);
        d.fx.emit("back", bouncing, age);
        d.fx.emit("under", falling, age);
      }
      d.fx.emit("back", craterGlow(before, after, op, seed), age);
      if (op.radius >= FLAME_MIN_RADIUS) {
        d.fx.emit("back", craterFlames(after, op, seed), age);
        d.fx.emit("back", flameGlow(after, op, seed), age);
      }
    },
    impact: (spec) => emitImpact(d, spec),
    killFlash: (delay = 0) => {
      const at = d.fx.now() + Math.max(0, delay);
      if (d.reduced() || at - lastFlash < FLASH_GAP_MS) return;
      lastFlash = at;
      d.screenFx.flashAt(at, FLASH_MS);
      d.screenFx.tintAt(KILL_TABLE, at, KILL_TINT_MS, false, TINT_PRIORITY.kill);
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
    teleport: (s) => emitTeleport(d, s),
    dust: (x, y, facing, seed) => { if (!d.reduced()) d.fx.emit("back", trackDust(x, y, facing, d.soil.slice(0, 2), seed)); },
    wreck: (x, y, ramp, seed, delay = 0, seat) => {
      if (d.reduced()) return;
      d.fx.emit("front", wreckDebris(x, y, [ramp.light, ramp.base, ramp.shadow, PALETTE.metal1, PALETTE.metal2], seed), -delay);
      smokes = [...smokes, { x, y, seed, start: d.fx.now() + delay, seat, next: 0 }];
    },
    freeze: (ms) => { if (!d.reduced()) d.fx.freeze(ms); },
    particleCount: d.fx.count,
    clear: () => { d.fx.clear(); d.screenFx.clear(); lastFlash = -Infinity; smokes = []; },
    tick: (deltaMs) => {
      smokes = emitSmoke(d, smokes, d.fx.now());
      d.screenFx.tick(d.fx.now(), d.screen(), deltaMs);
    },
  };
};
