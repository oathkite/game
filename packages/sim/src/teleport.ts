import type { CellPoint, TrajectoryInput } from "@game/protocol";
import { TANK_RADIUS_SQ } from "./constants.js";
import { cellOf } from "./fixed.js";
import { cellsBetween, checkCell, launch, motionOf, muzzleOf, stepFlight, type FixedPoint, type Flight } from "./flight.js";
import { hasClearance, type TankPos } from "./tank.js";
import { groundBelow, type TerrainMask } from "./terrain.js";
import { weaponSpec } from "./weapons.js";

// テレポートの弾（設計書 42.3）。扇も貫通もせず 1 本だけ飛び、地形も機体も削らない。
// 弾道は入力の武器の初速、重力、風で決まる。標準砲で飛ばすのは呼び出し側（protocol の shotWeapon）の責務。
// 機体との当たりは芯ではなく体の半径で見る。芯で見ると相手の車体を素通りして、重なる位置に着地してしまう。

const STRAIGHT = { deg: 0, speedPercent: 100 } as const;

/**
 * 当たる直前の空きセルから着地点を決める。その列の、空きセルから下の最初の地面に立つ。
 * 下に地面が無い（奈落）か、地表の上に機体の高さぶんの空きが無い（低い天井の下）なら null
 */
export const teleportLanding = (mask: TerrainMask, free: CellPoint): TankPos | null => {
  const ground = groundBelow(mask, free.x, free.y);
  if (ground >= mask.height || !hasClearance(mask, free.x, ground)) return null;
  return { x: free.x, y: ground };
};

/** 1 tick 進めて当たったとき、当たったセルの直前に通った空きセル。before は進める前の弾、after は進めた後の弾 */
const freeCellBefore = (before: Pick<Flight, "px" | "py" | "prev">, after: Flight, hit: CellPoint): CellPoint => {
  const next = { x: cellOf(before.px + after.vx), y: cellOf(before.py + after.vy) };
  const cells = [before.prev, ...cellsBetween(before.prev, next)];
  const at = cells.findIndex(c => c.x === hit.x && c.y === hit.y);
  return cells[Math.max(0, at - 1)]!;
};

export type TeleportFlight = {
  /** 弾道の位置列。1 tick に 1 点で、points[0] が砲口 */
  readonly points: readonly FixedPoint[];
  /** 着地点。移れなければ null */
  readonly landing: TankPos | null;
};

/** テレポートの弾を飛ばす。砲口が壁や機体の中、またはマップの外へ消えたら移れない */
export const flyTeleport = (mask: TerrainMask, centers: readonly CellPoint[], input: Omit<TrajectoryInput, "seat">): TeleportFlight => {
  const spec = weaponSpec(input.weapon);
  const f = launch(muzzleOf(mask, input, input.facing, input.elevation), spec, input, STRAIGHT);
  const m = motionOf(spec, input.wind);
  const points: FixedPoint[] = [{ x: f.px, y: f.py }];
  const bodies = centers.map((c) => ({ ...c, radiusSq: TANK_RADIUS_SQ }));
  if (checkCell(mask, f.prev, bodies) !== "free") return { points, landing: null };
  while (true) {
    const before = { px: f.px, py: f.py, prev: f.prev };
    const result = stepFlight(mask, bodies, f, m, points);
    if (result === null) return { points, landing: null };
    if (result !== "flying") return { points, landing: teleportLanding(mask, freeCellBefore(before, f, result.cell)) };
  }
};
