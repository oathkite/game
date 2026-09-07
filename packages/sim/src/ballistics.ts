import type { CellPoint, Facing, Impact, Seat, ShotResult, TerrainOp, TrajectoryInput } from "@game/protocol";
import {
  BARREL_BASE_UP,
  BARREL_LENGTH,
  GRAVITY,
  MAX_SPEED,
  MAX_STEPS,
  ONE,
  POWER_MAX,
  TANK_RADIUS,
  TANK_RADIUS_SQ,
  WIND_ACCEL_PER_UNIT,
} from "./constants.js";
import { cellOf, cosFixed, isqrt, mulFixed, sinFixed } from "./fixed.js";
import { isRingOut, tankCenterY, tiltOf } from "./tank.js";
import { carve, isSolid, surfaceY, type TerrainMask } from "./terrain.js";
import { firstStage, scalePercent, weaponSpec, type StageSpec, type WeaponSpec } from "./weapons.js";

// 弾道と着弾の処理。設計書 06 の 6.7 決定論の契約に従い、整数と固定小数点だけを使う。
// 爆風半径、ダメージ、初速と重力と風の倍率、弾道の本数と着弾の段数は武器ごとに違う（設計書 10）。入力の weapon から引く。
// 1 発の射撃は「弾道が N 本、弾道ごとに着弾が最大 K 段」で、結果は着弾の列（Impact[]）として返す。

export type Combatant = {
  readonly x: number;
  readonly hp: number;
};

export type FixedPoint = {
  readonly x: number;
  readonly y: number;
};

/** 発射角（度）。右向きは 傾き + 仰角、左向きは 180 + 傾き − 仰角 */
export const fireAngle = (tilt: number, elevation: number, facing: Facing): number =>
  facing === 1 ? tilt + elevation : 180 + tilt - elevation;

export type Muzzle = {
  readonly position: FixedPoint;
  readonly angle: number;
};

/**
 * 主砲の先端（固定小数点）。付け根は接地点から車体基準で真上 4 セルの点を傾きで回したもの。
 * 上向きの単位ベクトルを傾き t で回すと、画面座標（y 下向き）で (−sin t, −cos t) になる。
 */
export const muzzleOf = (mask: TerrainMask, x: number, facing: Facing, elevation: number): Muzzle => {
  const tilt = tiltOf(mask, x);
  const contactX = x * ONE + ONE / 2;
  const contactY = surfaceY(mask, x) * ONE;
  const up = BARREL_BASE_UP * ONE;
  const baseX = contactX - mulFixed(up, sinFixed(tilt));
  const baseY = contactY - mulFixed(up, cosFixed(tilt));
  const angle = fireAngle(tilt, elevation, facing);
  const len = BARREL_LENGTH * ONE;
  return {
    position: { x: baseX + mulFixed(len, cosFixed(angle)), y: baseY - mulFixed(len, sinFixed(angle)) },
    angle,
  };
};

const hitsTank = (cell: CellPoint, centers: readonly CellPoint[]): boolean =>
  centers.some((c) => {
    const dx = cell.x - c.x;
    const dy = cell.y - c.y;
    return dx * dx + dy * dy <= TANK_RADIUS_SQ;
  });

type CellCheck = "free" | "terrain" | "tank" | "vanish";

const checkCell = (mask: TerrainMask, cell: CellPoint, centers: readonly CellPoint[]): CellCheck => {
  if (cell.x < 0 || cell.x >= mask.width || cell.y >= mask.height) return "vanish";
  if (cell.y < 0) return "free";
  if (isSolid(mask, cell.x, cell.y)) return "terrain";
  if (hitsTank(cell, centers)) return "tank";
  return "free";
};

/**
 * from の次のセルから to までを、縦か横に 1 セルずつ進む 4 連結の整数直線で順に返す。
 * 斜めに抜けると 1 セル幅の斜めの壁をすり抜けるので、対角には進まない。
 */
const cellsBetween = (from: CellPoint, to: CellPoint): CellPoint[] => {
  const out: CellPoint[] = [];
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = to.x > from.x ? 1 : -1;
  const sy = to.y > from.y ? 1 : -1;
  let err = dx - dy;
  let x = from.x;
  let y = from.y;
  for (let i = 0; i < dx + dy; i++) {
    if (err > 0) {
      x += sx;
      err -= 2 * dy;
    } else {
      y += sy;
      err += 2 * dx;
    }
    out.push({ x, y });
  }
  return out;
};

const cellCenter = (cell: CellPoint): FixedPoint => ({ x: cell.x * ONE + ONE / 2, y: cell.y * ONE + ONE / 2 });

/** 弾道 1 本の位置列。着弾した段があれば、その位置は points の impactAt[段] 番目（着弾セルの中心） */
export type ProjectilePath = {
  readonly points: readonly FixedPoint[];
  readonly impactAt: readonly number[];
};

/** 飛行中の弾の可変状態 */
type Flight = {
  px: number;
  py: number;
  vx: number;
  vy: number;
  prev: CellPoint;
  steps: number;
};

type Motion = {
  readonly gravity: number;
  readonly windAccel: number;
};

const motionOf = (spec: WeaponSpec, wind: number): Motion => ({
  gravity: scalePercent(GRAVITY, spec.gravityPercent),
  windAccel: scalePercent(WIND_ACCEL_PER_UNIT, spec.windPercent) * wind,
});

const launch = (muzzle: Muzzle, spec: WeaponSpec, input: TrajectoryInput, fanDeg: number): Flight => {
  const speed = Math.trunc((scalePercent(MAX_SPEED, spec.speedPercent) * input.power) / POWER_MAX);
  const angle = muzzle.angle + fanDeg;
  const px = muzzle.position.x;
  const py = muzzle.position.y;
  return { px, py, vx: mulFixed(speed, cosFixed(angle)), vy: -mulFixed(speed, sinFixed(angle)), prev: { x: cellOf(px), y: cellOf(py) }, steps: 0 };
};

/** 着弾。何に当たったかを持つ。機体に当たった弾は食い込んで止まり、残りの段は同じセルで起きる */
type Hit = {
  readonly cell: CellPoint;
  readonly tank: boolean;
};

/** 弾を着弾セルの中心に置く。地形に当たった貫通の続きはここから同じ速度で飛ぶ */
const settle = (f: Flight, cell: CellPoint, tank: boolean, points: FixedPoint[]): Hit => {
  const c = cellCenter(cell);
  points.push(c);
  f.px = c.x;
  f.py = c.y;
  f.prev = cell;
  return { cell, tank };
};

/**
 * 次の衝突まで飛ぶ。着弾を返し、消失（画面の外か歩数の上限）なら null。
 * 位置は points に足していく。着弾したら弾は着弾セルの中心に置かれる。
 */
const fly = (mask: TerrainMask, centers: readonly CellPoint[], f: Flight, m: Motion, points: FixedPoint[]): Hit | null => {
  while (f.steps < MAX_STEPS) {
    f.steps++;
    f.vx += m.windAccel;
    f.vy += m.gravity;
    f.px += f.vx;
    f.py += f.vy;
    const next: CellPoint = { x: cellOf(f.px), y: cellOf(f.py) };
    for (const cell of cellsBetween(f.prev, next)) {
      const check = checkCell(mask, cell, centers);
      if (check === "terrain" || check === "tank") return settle(f, cell, check === "tank", points);
      if (check === "vanish") return null;
    }
    points.push({ x: f.px, y: f.py });
    f.prev = next;
  }
  return null;
};

/** 1 発の射撃が seat に与えたダメージの合計（全弾道、全段） */
export const damageDealtTo = (result: ShotResult, seat: Seat): number => result.impacts.reduce((sum, i) => sum + i.damage[seat], 0);

/** 着弾距離（爆心から判定円までのセル数）に対するダメージ。段を省けば標準砲 */
export const damageAt = (impact: CellPoint, center: CellPoint, stage: StageSpec = firstStage("cannon")): number => {
  const dx = impact.x - center.x;
  const dy = impact.y - center.y;
  const dist = Math.max(0, isqrt(dx * dx + dy * dy) - TANK_RADIUS);
  if (dist > stage.blastRadius) return 0;
  return Math.max(0, stage.damageMax - stage.damagePerCell * dist);
};

type Finish = ShotResult["finished"];

/** 設計書 01 の 1.2 の同時決着の順で勝敗を決める */
const judge = (hp: readonly [number, number], ringOut: readonly Seat[]): Finish => {
  const out = [ringOut.includes(0), ringOut.includes(1)] as const;
  const dead = [hp[0] <= 0 || out[0], hp[1] <= 0 || out[1]] as const;
  if (!dead[0] && !dead[1]) return null;
  const reason = out[0] || out[1] ? "ringOut" : "hp";
  if (out[0] !== out[1]) return { winner: out[0] ? 1 : 0, reason };
  if (dead[0] && dead[1]) {
    if (hp[0] === hp[1]) return { winner: null, reason };
    return { winner: hp[0] > hp[1] ? 0 : 1, reason };
  }
  return { winner: dead[0] ? 1 : 0, reason };
};

export type ShotOutcome = {
  readonly result: ShotResult;
  readonly mask: TerrainMask;
  /** 弾道ごとの位置列。添字は Impact.projectile と対応する */
  readonly paths: readonly ProjectilePath[];
};

const ringOuts = (mask: TerrainMask, xs: readonly [number, number]): Seat[] => {
  const out: Seat[] = [];
  if (isRingOut(mask, xs[0])) out.push(0);
  if (isRingOut(mask, xs[1])) out.push(1);
  return out;
};

/** 射撃の間だけ持つ可変状態。地形は着弾のたびに削られ、HP は着弾のたびに減る */
type Volley = {
  mask: TerrainMask;
  hp: [number, number];
  readonly impacts: Impact[];
  readonly paths: ProjectilePath[];
  /** 判定円の中心。射撃の間は動かないので、射撃前の地形から一度だけ求める。奈落の機体は null */
  readonly centers: readonly (CellPoint | null)[];
  /** 当たり判定を持つ機体の中心だけ */
  readonly hitCenters: readonly CellPoint[];
};

const damageOf = (v: Volley, cell: CellPoint, stage: StageSpec): [number, number] => {
  const at = (seat: Seat): number => {
    const c = v.centers[seat];
    return c ? damageAt(cell, c, stage) : 0;
  };
  return [at(0), at(1)];
};

/**
 * 弾道 1 本を最後の段まで飛ばし、着弾を v に足す。
 * 地形に当たった弾は削った穴を抜けて次の段へ飛び、機体に当たった弾は食い込んで残りの段を同じセルで起こす。
 */
const flyProjectile = (v: Volley, index: number, f: Flight, m: Motion, spec: WeaponSpec): void => {
  const points: FixedPoint[] = [{ x: f.px, y: f.py }];
  const impactAt: number[] = [];
  const centers = v.hitCenters;
  // 砲口のセル自体が壁や機体の中なら、その場で最初の段が着弾する
  const first = checkCell(v.mask, f.prev, centers);
  let hit: Hit | null = null;
  if (first === "terrain" || first === "tank") {
    points.length = 0;
    hit = settle(f, f.prev, first === "tank", points);
  } else if (first === "free") {
    hit = fly(v.mask, centers, f, m, points);
  }
  for (let stage = 0; stage < spec.stages.length && hit; stage++) {
    const s = spec.stages[stage] as StageSpec;
    impactAt.push(points.length - 1);
    const terrainOp: TerrainOp = { cx: hit.cell.x, cy: hit.cell.y, radius: s.blastRadius };
    const damage = damageOf(v, hit.cell, s);
    v.impacts.push({ projectile: index, stage, cell: hit.cell, terrainOp, damage });
    v.mask = carve(v.mask, terrainOp);
    v.hp = [v.hp[0] - damage[0], v.hp[1] - damage[1]];
    if (stage + 1 >= spec.stages.length) break;
    if (!hit.tank) hit = fly(v.mask, centers, f, m, points);
  }
  v.paths.push({ points, impactAt });
};

/**
 * 1 発を処理する。順序は弾道（扇の本数 × 発数）、弾道ごとの着弾（段）、地形の削り、ダメージ（落下前の位置）、落下、リングアウト、勝敗。
 * 同じ入力からは必ず同じ結果が出る。弾道の順は発数の外側、扇の内側で、添字は 発 × 扇の本数 + 扇の番号。
 */
export const simulateShot = (
  mask: TerrainMask,
  players: readonly [Combatant, Combatant],
  input: TrajectoryInput,
): ShotOutcome => {
  // 撃つ側の位置は入力（移動後の x）を正とする。players には移動前の x が入っていてもよい
  const xs: readonly [number, number] = input.seat === 0 ? [input.x, players[1].x] : [players[0].x, input.x];
  // 奈落に落ちている機体は当たり判定を持たず、ダメージも受けない
  const centerOf = (seat: Seat): CellPoint | null => (isRingOut(mask, xs[seat]) ? null : { x: xs[seat], y: tankCenterY(mask, xs[seat]) });
  const centers = [centerOf(0), centerOf(1)];
  const v: Volley = { mask, hp: [players[0].hp, players[1].hp], impacts: [], paths: [], centers, hitCenters: centers.filter((c): c is CellPoint => c !== null) };
  const spec = weaponSpec(input.weapon);
  const muzzle = muzzleOf(mask, input.x, input.facing, input.elevation);
  const m = motionOf(spec, input.wind);
  for (let volley = 0; volley < spec.volleys; volley++) {
    spec.fanDeg.forEach((deg, fan) => flyProjectile(v, volley * spec.fanDeg.length + fan, launch(muzzle, spec, input, deg), m, spec));
  }
  const ringOut = ringOuts(v.mask, xs);
  return {
    mask: v.mask,
    paths: v.paths,
    result: { input, impacts: v.impacts, hpAfter: v.hp, xAfter: xs, ringOut, finished: judge(v.hp, ringOut) },
  };
};
