import type { CellPoint, TrajectoryInput } from "@game/protocol";
import { MAX_STEPS } from "./constants.js";
import { damageAt, fireSecond, type Combatant, type CombatImpact, type CombatOutcome, type TeamCombatant } from "./ballistics.js";
import { checkCell, launch, motionOf, muzzleOf, settle, stepFlight, type FixedPoint, type Flight, type Hit, type Motion, type ProjectilePath } from "./flight.js";
import { carve, type TerrainMask } from "./terrain.js";
import { isRingOut, settle as settleTank, tankCenterY, type TankPos } from "./tank.js";
import { flyTeleport } from "./teleport.js";
import { weaponSpec, type WeaponSpec } from "./weapons.js";

export const COMBAT_TICK_MS = 1000 / 60;
export const VOLLEY_GAP_TICKS = 11;
export const IMPACT_HOLD_TICKS = 4;
/** ダブルシュートで 1 発目の最後の tick から 2 発目を撃つまでの間（設計書 42.2、TBD-46）。0.5 秒 */
export const DOUBLE_GAP_TICKS = 30;
export type TimedProjectilePath = ProjectilePath & { readonly pointTicks: readonly number[]; readonly launchTick: number };
export type TimedCombatImpact = CombatImpact & { readonly tick: number };
export type ConcurrentOutcome = Omit<CombatOutcome, "paths" | "impacts"> & {
  readonly paths: readonly TimedProjectilePath[]; readonly impacts: readonly TimedCombatImpact[]; readonly ticks: number;
};
type Projectile = {
  readonly index: number; readonly launchTick: number; readonly flight: Flight;
  readonly points: FixedPoint[]; readonly pointTicks: number[]; readonly impactAt: number[];
  stage: number; nextTick: number; started: boolean; done: boolean; stuck: Hit | null;
};
const advanceProjectile = (p: Projectile, mask: TerrainMask, centers: readonly CellPoint[], motion: Motion, tick: number): Hit | null => {
  if (!p.started) {
    p.started = true;
    const check = checkCell(mask, p.flight.prev, centers);
    if (check === "vanish") { p.done = true; return null; }
    if (check === "terrain" || check === "tank") {
      p.points.length = 0; p.pointTicks.length = 0;
      const hit = settle(p.flight, p.flight.prev, check === "tank", p.points); p.pointTicks.push(tick); return hit;
    }
    p.nextTick = tick + 1; return null;
  }
  if (p.stuck) return p.stuck;
  const length = p.points.length;
  const result = stepFlight(mask, centers, p.flight, motion, p.points);
  if (p.points.length > length) p.pointTicks.push(tick);
  if (result === null) p.done = true;
  p.nextTick = tick + 1;
  return result === "flying" ? null : result;
};
const projectilesOf = (mask: TerrainMask, input: Omit<TrajectoryInput, "seat">, spec: WeaponSpec): Projectile[] => {
  const muzzle = muzzleOf(mask, input, input.facing, input.elevation);
  return Array.from({ length: spec.volleys }, (_, volley) => spec.fan.map((fan, i) => {
    const flight = launch(muzzle, spec, input, fan), launchTick = volley * VOLLEY_GAP_TICKS;
    return { index: volley * spec.fan.length + i, launchTick, flight, points: [{ x: flight.px, y: flight.py }], pointTicks: [launchTick], impactAt: [], stage: 0, nextTick: launchTick, started: false, done: false, stuck: null };
  })).flat();
};
/** v2: all projectiles inspect one tick's terrain/HP, then apply impacts as a batch. */
export const simulateConcurrentCombat = (initial: TerrainMask, players: readonly Combatant[], input: Omit<TrajectoryInput, "seat">): ConcurrentOutcome => {
  const spec = weaponSpec(input.weapon), motion = motionOf(spec, input.wind), projectiles = projectilesOf(initial, input, spec);
  const centers = players.map(p => isRingOut(initial, p) ? null : { x: p.x, y: tankCenterY(p) });
  let mask = initial, hp = players.map(p => p.hp), ticks = 0;
  const impacts: TimedCombatImpact[] = [];
  const limit = MAX_STEPS + spec.volleys * VOLLEY_GAP_TICKS + spec.stages.length * IMPACT_HOLD_TICKS + 1;
  for (let tick = 0; tick <= limit; tick++) {
    ticks = tick;
    const alive = centers.filter((c, i): c is CellPoint => c !== null && hp[i]! > 0);
    const batch: TimedCombatImpact[] = [];
    for (const p of projectiles) {
      if (p.done || tick < p.nextTick) continue;
      const hit = advanceProjectile(p, mask, alive, motion, tick); if (!hit) continue;
      const stage = spec.stages[p.stage]!;
      p.impactAt.push(p.points.length - 1);
      batch.push({ projectile: p.index, stage: p.stage, tick, cell: hit.cell,
        terrainOp: { cx: hit.cell.x, cy: hit.cell.y, radius: stage.blastRadius },
        damage: centers.map((c, i) => c && hp[i]! > 0 ? damageAt(hit.cell, c, stage) : 0) });
      p.stage++; p.done = p.stage === spec.stages.length;
      p.stuck = hit.tank ? hit : null; p.nextTick = tick + IMPACT_HOLD_TICKS;
    }
    for (const impact of batch) mask = carve(mask, impact.terrainOp);
    if (batch.length) hp = hp.map((value, i) => value - batch.reduce((sum, impact) => sum + impact.damage[i]!, 0));
    impacts.push(...batch);
    if (projectiles.every(p => p.done)) break;
  }
  const positions = players.map(p => settleTank(mask, p));
  return { mask, hpAfter: hp, positions, impacts, ticks,
    ringOut: positions.flatMap((p, i) => isRingOut(mask, p) ? [i] : []),
    paths: projectiles.map(p => ({ points: p.points, impactAt: p.impactAt, pointTicks: p.pointTicks, launchTick: p.launchTick })) };
};

/** テレポートの射撃。弾は 1 tick に 1 点ずつ進み、地形も HP も変えない */
const teleportConcurrent = (mask: TerrainMask, players: readonly Combatant[], shooter: number, input: Omit<TrajectoryInput, "seat">): ConcurrentOutcome => {
  const centers = players.flatMap(p => !isRingOut(mask, p) && p.hp > 0 ? [{ x: p.x, y: tankCenterY(p) }] : []);
  const flight = flyTeleport(mask, centers, input);
  const positions: TankPos[] = players.map((p, i) => i === shooter && flight.landing ? flight.landing : { x: p.x, y: p.y });
  return { mask, hpAfter: players.map(p => p.hp), positions, impacts: [], ticks: flight.points.length - 1, teleport: flight.landing,
    ringOut: positions.flatMap((p, i) => isRingOut(mask, p) ? [i] : []),
    paths: [{ points: flight.points, impactAt: [], pointTicks: flight.points.map((_, i) => i), launchTick: 0 }] };
};

/** ダブルシュートの射撃。試合が続くなら、1 発目の最後の tick から DOUBLE_GAP_TICKS 置いて、落ちた後の位置から 2 発目を撃つ */
const doubleConcurrent = (mask: TerrainMask, players: readonly TeamCombatant[], shooter: number, input: Omit<TrajectoryInput, "seat">): ConcurrentOutcome => {
  const first = simulateConcurrentCombat(mask, players, input);
  if (!fireSecond(players, shooter, first)) return first;
  const at = first.positions[shooter]!;
  const after = players.map((_, i) => ({ ...first.positions[i]!, hp: first.hpAfter[i]! }));
  const second = simulateConcurrentCombat(first.mask, after, { ...input, x: at.x, y: at.y });
  const ticks = first.ticks + DOUBLE_GAP_TICKS, count = first.paths.length;
  return { ...second, ticks: ticks + second.ticks,
    paths: [...first.paths, ...second.paths.map(p => ({ ...p, launchTick: p.launchTick + ticks, pointTicks: p.pointTicks.map(t => t + ticks) }))],
    impacts: [...first.impacts, ...second.impacts.map(i => ({ ...i, projectile: i.projectile + count, tick: i.tick + ticks }))] };
};

/** アイテム（設計書 42）を含めた v2 の 1 手番の射撃。shooter は players の中の撃つ側の添字で、players にはチームを持たせる。アイテムを使わなければ simulateConcurrentCombat と同じ */
export const simulateConcurrentCombatWithItem = (initial: TerrainMask, players: readonly TeamCombatant[], shooter: number, input: Omit<TrajectoryInput, "seat">): ConcurrentOutcome => {
  if (input.item === "double") return doubleConcurrent(initial, players, shooter, input);
  if (input.item === "teleport") return teleportConcurrent(initial, players, shooter, input);
  return simulateConcurrentCombat(initial, players, input);
};
