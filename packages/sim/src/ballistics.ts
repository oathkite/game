import type { CellPoint, Impact, Seat, ShotResult, TerrainOp, TrajectoryInput } from "@game/protocol";
import { TANK_RADIUS } from "./constants.js";
import { isqrt } from "./fixed.js";
import { isRingOut, settle as settleTank, tankCenterY, type TankPos } from "./tank.js";
import { carve, type TerrainMask } from "./terrain.js";
import { firstStage, weaponSpec, type StageSpec, type WeaponSpec } from "./weapons.js";
import { checkCell, fly, launch, motionOf, muzzleOf, settle, type FixedPoint, type Flight, type Hit, type Motion, type ProjectilePath } from "./flight.js";
export { fireAngle, muzzleOf, type FixedPoint, type Muzzle, type ProjectilePath } from "./flight.js";

// 弾道と着弾の処理。設計書 06 の 6.7 決定論の契約に従い、整数と固定小数点だけを使う。
// 爆風半径、ダメージ、初速と重力と風の倍率、弾道の本数と着弾の段数は武器ごとに違う（設計書 10）。入力の weapon から引く。
// 1 発の射撃は「弾道が N 本、弾道ごとに着弾が最大 K 段」で、結果は着弾の列（Impact[]）として返す。

/** 射撃前の機体。x と接地している地表の y（設計書 02 の 2.5）と HP */
export type Combatant = {
  readonly x: number;
  readonly y: number;
  readonly hp: number;
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

const ringOuts = (mask: TerrainMask, ps: readonly [TankPos, TankPos]): Seat[] => {
  const out: Seat[] = [];
  if (isRingOut(mask, ps[0])) out.push(0);
  if (isRingOut(mask, ps[1])) out.push(1);
  return out;
};

/** 射撃の間だけ持つ可変状態。地形は着弾のたびに削られ、HP は着弾のたびに減る */
type Volley = {
  mask: TerrainMask;
  hp: number[];
  readonly impacts: CombatImpact[];
  readonly removeDefeated: boolean;
  readonly paths: ProjectilePath[];
  /** 判定円の中心。射撃の間は動かないので、射撃前の地形から一度だけ求める。奈落の機体は null */
  readonly centers: readonly (CellPoint | null)[];
};

const damageOf = (v: Volley, cell: CellPoint, stage: StageSpec): number[] =>
  v.centers.map((c, i) => c && (!v.removeDefeated || v.hp[i]! > 0) ? damageAt(cell, c, stage) : 0);

/**
 * 弾道 1 本を最後の段まで飛ばし、着弾を v に足す。
 * 地形に当たった弾は削った穴を抜けて次の段へ飛び、機体に当たった弾は食い込んで残りの段を同じセルで起こす。
 */
const flyProjectile = (v: Volley, index: number, f: Flight, m: Motion, spec: WeaponSpec): void => {
  const points: FixedPoint[] = [{ x: f.px, y: f.py }];
  const impactAt: number[] = [];
  const centers = v.centers.filter((c, i): c is CellPoint => c !== null && (!v.removeDefeated || v.hp[i]! > 0));
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
    v.hp = v.hp.map((hp, i) => hp - damage[i]!);
    if (stage + 1 >= spec.stages.length) break;
    if (!hit.tank) hit = fly(v.mask, v.centers.filter((c, i): c is CellPoint => c !== null && (!v.removeDefeated || v.hp[i]! > 0)), f, m, points);
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
  // 撃つ側の位置は入力（移動後の x と y）を正とする。players には移動前の位置が入っていてもよい
  const shooter: TankPos = { x: input.x, y: input.y };
  const other: TankPos = input.seat === 0 ? players[1] : players[0];
  const before: readonly [TankPos, TankPos] = input.seat === 0 ? [shooter, other] : [other, shooter];
  const v = simulateCombat(mask, before.map((pos, i) => ({ ...pos, hp: players[i]!.hp })), input, false);
  // 落下は削り終わった地形に対して、真下の次の地面まで。地面がなければ奈落
  const after: readonly [TankPos, TankPos] = [v.positions[0]!, v.positions[1]!];
  const ringOut = ringOuts(v.mask, after);
  return {
    mask: v.mask,
    paths: v.paths,
    result: { input, impacts: v.impacts.map(i => ({ ...i, damage: [i.damage[0]!, i.damage[1]!] })), hpAfter: [v.hpAfter[0]!, v.hpAfter[1]!], xAfter: [after[0].x, after[1].x], yAfter: [after[0].y, after[1].y], ringOut, finished: judge([v.hpAfter[0]!, v.hpAfter[1]!], ringOut) },
  };
};

export type CombatImpact = Omit<Impact, "damage"> & { readonly damage: readonly number[] };
export type CombatOutcome = {
  readonly mask: TerrainMask;
  readonly paths: readonly ProjectilePath[];
  readonly impacts: readonly CombatImpact[];
  readonly hpAfter: readonly number[];
  readonly positions: readonly TankPos[];
  readonly ringOut: readonly number[];
};

/** 内部用の可変人数物理。全員の確定位置を渡す。勝敗は呼び出し側でチームから判定する。 */
export const simulateCombat = (
  mask: TerrainMask, players: readonly Combatant[], input: Omit<TrajectoryInput, "seat">, removeDefeated = true,
): CombatOutcome => {
  const centers = players.map(p => isRingOut(mask, p) ? null : { x: p.x, y: tankCenterY(p) });
  const v: Volley = { mask, hp: players.map(p => p.hp), impacts: [], paths: [], centers, removeDefeated };
  const spec = weaponSpec(input.weapon);
  const muzzle = muzzleOf(mask, input, input.facing, input.elevation);
  const m = motionOf(spec, input.wind);
  for (let volley = 0; volley < spec.volleys; volley++) {
    spec.fan.forEach((f, fan) => flyProjectile(v, volley * spec.fan.length + fan, launch(muzzle, spec, input, f), m, spec));
  }
  const positions = players.map(p => settleTank(v.mask, p));
  return { mask: v.mask, paths: v.paths, impacts: v.impacts, hpAfter: v.hp, positions,
    ringOut: positions.flatMap((p, i) => isRingOut(v.mask, p) ? [i] : []) };
};
