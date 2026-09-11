import type { CellPoint, Facing, TrajectoryInput } from "@game/protocol";
import { BARREL_BASE_UP, BARREL_LENGTH, GRAVITY, MAX_SPEED, MAX_STEPS, ONE, POWER_MAX, TANK_RADIUS_SQ, WIND_ACCEL_PER_UNIT } from "./constants.js";
import { cellOf, cosFixed, mulFixed, sinFixed } from "./fixed.js";
import { tiltOf, type TankPos } from "./tank.js";
import { isSolid, type TerrainMask } from "./terrain.js";
import { scalePercent, type FanSpec, type WeaponSpec } from "./weapons.js";

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
export const muzzleOf = (mask: TerrainMask, pos: TankPos, facing: Facing, elevation: number): Muzzle => {
  const tilt = tiltOf(mask, pos);
  const contactX = pos.x * ONE + ONE / 2;
  const contactY = pos.y * ONE;
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

export const checkCell = (mask: TerrainMask, cell: CellPoint, centers: readonly CellPoint[]): CellCheck => {
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
export type Flight = {
  px: number;
  py: number;
  vx: number;
  vy: number;
  prev: CellPoint;
  steps: number;
};

export type Motion = {
  readonly gravity: number;
  readonly windAccel: number;
};

export const motionOf = (spec: WeaponSpec, wind: number): Motion => ({
  gravity: scalePercent(GRAVITY, spec.gravityPercent),
  windAccel: scalePercent(WIND_ACCEL_PER_UNIT, spec.windPercent) * wind,
});

/** 扇のずれを掛けて撃ち出す。角度のずれは砲を上げる向きが正で、左向きなら鏡像にする */
export const launch = (muzzle: Muzzle, spec: WeaponSpec, input: Omit<TrajectoryInput, "seat">, fan: FanSpec): Flight => {
  const speed = Math.trunc((scalePercent(scalePercent(MAX_SPEED, spec.speedPercent), fan.speedPercent) * input.power) / POWER_MAX);
  const angle = muzzle.angle + fan.deg * input.facing;
  const px = muzzle.position.x;
  const py = muzzle.position.y;
  return { px, py, vx: mulFixed(speed, cosFixed(angle)), vy: -mulFixed(speed, sinFixed(angle)), prev: { x: cellOf(px), y: cellOf(py) }, steps: 0 };
};

/** 着弾。何に当たったかを持つ。機体に当たった弾は食い込んで止まり、残りの段は同じセルで起きる */
export type Hit = {
  readonly cell: CellPoint;
  readonly tank: boolean;
};

/** 弾を着弾セルの中心に置く。地形に当たった貫通の続きはここから同じ速度で飛ぶ */
export const settle = (f: Flight, cell: CellPoint, tank: boolean, points: FixedPoint[]): Hit => {
  const c = cellCenter(cell);
  points.push(c);
  f.px = c.x;
  f.py = c.y;
  f.prev = cell;
  return { cell, tank };
};

/**
 * 物理を1tick進める。飛行継続は flying、着弾は Hit、消失は null。
 * 位置は points に足していく。着弾したら弾は着弾セルの中心に置かれる。
 */
export const stepFlight = (mask: TerrainMask, centers: readonly CellPoint[], f: Flight, m: Motion, points: FixedPoint[]): Hit | "flying" | null => {
  if (f.steps >= MAX_STEPS) return null;
  f.steps++; f.vx += m.windAccel; f.vy += m.gravity; f.px += f.vx; f.py += f.vy;
  const next: CellPoint = { x: cellOf(f.px), y: cellOf(f.py) };
  for (const cell of cellsBetween(f.prev, next)) {
    const check = checkCell(mask, cell, centers);
    if (check === "terrain" || check === "tank") return settle(f, cell, check === "tank", points);
    if (check === "vanish") return null;
  }
  points.push({ x: f.px, y: f.py }); f.prev = next;
  return "flying";
};
export const fly = (mask: TerrainMask, centers: readonly CellPoint[], f: Flight, m: Motion, points: FixedPoint[]): Hit | null => {
  while (true) {
    const result = stepFlight(mask, centers, f, m, points);
    if (result !== "flying") return result;
  }
};
