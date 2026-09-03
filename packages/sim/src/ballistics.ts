import type { CellPoint, Facing, Seat, ShotResult, TerrainOp, TrajectoryInput } from "@game/protocol";
import {
  BARREL_BASE_UP,
  BARREL_LENGTH,
  BLAST_RADIUS,
  DAMAGE_MAX,
  DAMAGE_PER_CELL,
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

// 弾道と着弾の処理。設計書 06 の 6.7 決定論の契約に従い、整数と固定小数点だけを使う。

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

type CellCheck = "free" | "impact" | "vanish";

const checkCell = (mask: TerrainMask, cell: CellPoint, centers: readonly CellPoint[]): CellCheck => {
  if (cell.x < 0 || cell.x >= mask.width || cell.y >= mask.height) return "vanish";
  if (cell.y < 0) return "free";
  if (isSolid(mask, cell.x, cell.y) || hitsTank(cell, centers)) return "impact";
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

export type Trace = {
  readonly impact: CellPoint | null;
  /** 各ステップの弾の位置（固定小数点）。着弾した場合、最後の点は着弾セルの中心。描画の補間に使う */
  readonly path: readonly FixedPoint[];
};

/** 弾道を追い、着弾セルか消失（null）を返す */
export const traceShot = (mask: TerrainMask, centers: readonly CellPoint[], input: TrajectoryInput): Trace => {
  const muzzle = muzzleOf(mask, input.x, input.facing, input.elevation);
  const speed = Math.trunc((MAX_SPEED * input.power) / POWER_MAX);
  let vx = mulFixed(speed, cosFixed(muzzle.angle));
  let vy = -mulFixed(speed, sinFixed(muzzle.angle));
  let px = muzzle.position.x;
  let py = muzzle.position.y;
  const path: FixedPoint[] = [{ x: px, y: py }];
  let prev: CellPoint = { x: cellOf(px), y: cellOf(py) };
  const first = checkCell(mask, prev, centers);
  if (first === "impact") return { impact: prev, path: [cellCenter(prev)] };
  if (first === "vanish") return { impact: null, path };
  const windAccel = WIND_ACCEL_PER_UNIT * input.wind;
  for (let step = 0; step < MAX_STEPS; step++) {
    vx += windAccel;
    vy += GRAVITY;
    px += vx;
    py += vy;
    const next: CellPoint = { x: cellOf(px), y: cellOf(py) };
    for (const cell of cellsBetween(prev, next)) {
      const check = checkCell(mask, cell, centers);
      if (check === "impact") {
        path.push(cellCenter(cell));
        return { impact: cell, path };
      }
      if (check === "vanish") return { impact: null, path };
    }
    path.push({ x: px, y: py });
    prev = next;
  }
  return { impact: null, path };
};

/** 着弾距離（爆心から判定円までのセル数）に対するダメージ */
export const damageAt = (impact: CellPoint, center: CellPoint): number => {
  const dx = impact.x - center.x;
  const dy = impact.y - center.y;
  const dist = Math.max(0, isqrt(dx * dx + dy * dy) - TANK_RADIUS);
  if (dist > BLAST_RADIUS) return 0;
  return DAMAGE_MAX - DAMAGE_PER_CELL * dist;
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
  readonly path: readonly FixedPoint[];
};

const ringOuts = (mask: TerrainMask, xs: readonly [number, number]): Seat[] => {
  const out: Seat[] = [];
  if (isRingOut(mask, xs[0])) out.push(0);
  if (isRingOut(mask, xs[1])) out.push(1);
  return out;
};

/**
 * 1 発を処理する。順序は弾道、着弾、地形の削り、ダメージ（落下前の位置）、落下、リングアウト、勝敗。
 * 同じ入力からは必ず同じ結果が出る。
 */
export const simulateShot = (
  mask: TerrainMask,
  players: readonly [Combatant, Combatant],
  input: TrajectoryInput,
): ShotOutcome => {
  // 撃つ側の位置は入力（移動後の x）を正とする。players には移動前の x が入っていてもよい
  const xs: readonly [number, number] = input.seat === 0 ? [input.x, players[1].x] : [players[0].x, input.x];
  const hp: readonly [number, number] = [players[0].hp, players[1].hp];
  // 奈落に落ちている機体は当たり判定を持たない
  const centers: CellPoint[] = [];
  for (const seat of [0, 1] as const) {
    if (!isRingOut(mask, xs[seat])) centers.push({ x: xs[seat], y: tankCenterY(mask, xs[seat]) });
  }
  const trace = traceShot(mask, centers, input);
  if (trace.impact === null) {
    const ringOut = ringOuts(mask, xs);
    return {
      mask,
      path: trace.path,
      result: { input, impact: null, terrainOp: null, damage: [0, 0], hpAfter: hp, xAfter: xs, ringOut, finished: judge(hp, ringOut) },
    };
  }
  const terrainOp: TerrainOp = { cx: trace.impact.x, cy: trace.impact.y, radius: BLAST_RADIUS };
  const next = carve(mask, terrainOp);
  const damageFor = (seat: Seat): number =>
    isRingOut(mask, xs[seat]) ? 0 : damageAt(trace.impact as CellPoint, { x: xs[seat], y: tankCenterY(mask, xs[seat]) });
  const damage: readonly [number, number] = [damageFor(0), damageFor(1)];
  const hpAfter: readonly [number, number] = [hp[0] - damage[0], hp[1] - damage[1]];
  const ringOut = ringOuts(next, xs);
  return {
    mask: next,
    path: trace.path,
    result: { input, impact: trace.impact, terrainOp, damage, hpAfter, xAfter: xs, ringOut, finished: judge(hpAfter, ringOut) },
  };
};
