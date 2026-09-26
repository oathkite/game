import type { WeaponId } from "@game/protocol";
import { PALETTE, type Ramp } from "./palette";
import { ART_PER_CELL, createGrid, setPixel, type PixelGrid } from "./pixelGrid";

// 爆発の絵。設計書 40.9。着弾したセルの中心（画素の角）を原点とする art px で描く。
// 半径 r セルの爆風は、中心から r × 4 + 2 art px（これまでのセルの円の外周）の内側に収め、煙や破片をダメージ範囲として読ませない（8.6）。
// 時間の流れ（膨張、明滅、消失）は hitFeedback.ts のままで、ここは段階ごとの絵だけを決める。

/** 明滅の点灯（熱い火球）、消灯（冷えた火球）、消失の輪 */
export type BlastStage = "hot" | "cool" | "ring";

export const blastStage = (on: boolean, ring: boolean): BlastStage => (ring ? "ring" : on ? "hot" : "cool");

const limitOf = (r: number): number => r * ART_PER_CELL + 2;

/** 火球の縁の起伏。角度で決まる固定の形で、0.84〜1 の割合 */
const lobe = (theta: number): number => 0.84 + 0.16 * (0.5 + 0.5 * Math.sin(5 * theta + 1.3) * Math.cos(3 * theta - 0.4));

const FIRE_HOT: readonly (readonly [number, number])[] = [[0.34, PALETTE.white], [0.58, PALETTE.fire1], [0.8, PALETTE.fire2], [0.93, PALETTE.fire3], [1.01, PALETTE.fire4]];
const FIRE_COOL: readonly (readonly [number, number])[] = [[0.3, PALETTE.fire2], [0.55, PALETTE.fire3], [0.78, PALETTE.fire4], [1.01, PALETTE.fire5]];
const ENERGY_HOT: readonly (readonly [number, number])[] = [[0.35, PALETTE.white], [0.6, PALETTE.energy0], [0.85, PALETTE.energy1], [1.01, PALETTE.energy2]];
const ENERGY_COOL: readonly (readonly [number, number])[] = [[0.4, PALETTE.energy1], [0.75, PALETTE.energy2], [1.01, PALETTE.violet0]];

const energyOf = (weapon: WeaponId): boolean => weapon === "laser" || weapon === "floater";

/** 中心からの割合 t（0〜1）の色。境目は市松でずらし、冷えた火球の外側は煙の色と交互にする */
const rampColor = (weapon: WeaponId, stage: "hot" | "cool", t: number, x: number, y: number): number => {
  const checker = (x + y) % 2 === 0;
  const shifted = t + (checker ? 0.025 : -0.025);
  if (stage === "cool" && !energyOf(weapon) && shifted > 0.8 && checker) return PALETTE.smoke2;
  const ramp = energyOf(weapon) ? (stage === "hot" ? ENERGY_HOT : ENERGY_COOL) : stage === "hot" ? FIRE_HOT : FIRE_COOL;
  return (ramp.find(([edge]) => shifted < edge) ?? ramp[ramp.length - 1]!)[1];
};

/** 消失の輪の帯の色。外側から影、基準 2 px、光 */
const ringColor = (ramp: Ramp, fromOuter: number): number => (fromOuter < 1 ? ramp.shadow : fromOuter < 3 ? ramp.base : ramp.light);

type Shape = (dx: number, dy: number) => number | null;

/** 形ごとの、中心からの割合（0〜1、外なら null） */
const shapeOf = (weapon: WeaponId, r: number): Shape => {
  const limit = limitOf(r);
  if (weapon === "laser") {
    const arm = Math.ceil(r / 2) * ART_PER_CELL + 2;
    return (dx, dy) => {
      const half = 1 + 2 * (1 - Math.abs(dx) / limit);
      if (Math.abs(dx) <= limit && Math.abs(dy) < half) return Math.abs(dx) / limit;
      if (Math.abs(dx) < 2 && Math.abs(dy) <= arm) return Math.abs(dy) / arm;
      return null;
    };
  }
  if (weapon === "digger") {
    const rx = Math.max(1, Math.ceil(r * 0.6)), top = -Math.ceil(r * 0.6);
    const cy = ((r + top) / 2) * ART_PER_CELL, ry = ((r - top) / 2) * ART_PER_CELL + 2, sx = rx * ART_PER_CELL + 2;
    return (dx, dy) => {
      const t = Math.hypot(dx / sx, (dy - cy) / ry) / lobe(Math.atan2(dy - cy, dx));
      return t <= 1 ? t : null;
    };
  }
  return (dx, dy) => {
    const t = Math.hypot(dx, dy) / (limit * lobe(Math.atan2(dy, dx)));
    return t <= 1 ? t : null;
  };
};

/** 浮遊弾の二重の輪。外側の輪と、半径の半分の内側の輪（半径 4 未満は外側だけ） */
const floaterRings = (r: number) => {
  const outer = limitOf(r), inner = Math.ceil(r / 2) * ART_PER_CELL + 2;
  return (d: number): number | null => {
    if (d <= outer && d > outer - ART_PER_CELL) return (outer - d) / ART_PER_CELL;
    if (r >= 4 && d <= inner && d > inner - ART_PER_CELL) return (inner - d) / ART_PER_CELL;
    return null;
  };
};

/** 消失の輪の画素。外周から内へ何 px か（1 セル幅の帯の外なら null）。レーザー弾は両端だけ */
const ringDepth = (weapon: WeaponId, r: number, dx: number, dy: number): number | null => {
  const limit = limitOf(r);
  if (weapon === "laser") return Math.abs(dx) <= limit && Math.abs(dx) > limit - ART_PER_CELL && Math.abs(dy) < 3 ? limit - Math.abs(dx) : null;
  const d = Math.hypot(dx, dy);
  return d <= limit && d > limit - ART_PER_CELL ? limit - d : null;
};

const pixelColor = (weapon: WeaponId, r: number, stage: BlastStage, ramp: Ramp, x: number, y: number, shape: Shape): number | null => {
  const dx = x + 0.5, dy = y + 0.5;
  if (stage === "ring") {
    const depth = ringDepth(weapon, r, dx, dy);
    return depth === null ? null : ringColor(ramp, depth);
  }
  if (weapon === "floater") {
    const band = floaterRings(r)(Math.hypot(dx, dy));
    return band === null ? null : rampColor(weapon, stage, band, x, y);
  }
  const t = shape(dx, dy);
  return t === null ? null : rampColor(weapon, stage, t, x, y);
};

/** 半径 r セルの爆風の、段階 stage の絵。撃った側の主色の段 ramp は消失の輪に使う */
export const explosionPixels = (weapon: WeaponId, r: number, stage: BlastStage, ramp: Ramp): PixelGrid => {
  const limit = Math.ceil(limitOf(r));
  const grid = createGrid(-limit, -limit, limit * 2, limit * 2);
  const shape = shapeOf(weapon, r);
  for (let y = -limit; y < limit; y++) for (let x = -limit; x < limit; x++) {
    const color = pixelColor(weapon, r, stage, ramp, x, y, shape);
    if (color !== null) setPixel(grid, x, y, color);
  }
  return grid;
};
