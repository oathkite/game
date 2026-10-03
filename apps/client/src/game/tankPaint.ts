import { PALETTE, type Ramp } from "./palette";
import type { Edges } from "./pixelGrid";
import { MATERIAL as M } from "./tankShape";

// 機体の材質を色に塗る。設計書 40.5 と 43。主色（カラー 2）は車体、副色（カラー 1）は砲塔と砲身を塗り、
// 金属、発光、木、石などの材質はチームの色によらない固定パレットの色にする。

export type BarrelRim = "none" | "charge" | "hot";

export type PaintInput = {
  readonly hull: Ramp;
  readonly turret: Ramp;
  readonly white: boolean;
  readonly wrecked: boolean;
  readonly rim: BarrelRim;
};

/** チームの色によらない材質の色 */
const FIXED: ReadonlyMap<number, number> = new Map([
  [M.linkA, PALETTE.metal1], [M.wheelRim, PALETTE.metal1], [M.hatch, PALETTE.metal1], [M.antenna, PALETTE.metal1], [M.brakeLight, PALETTE.metal1], [M.metalBase, PALETTE.metal1],
  [M.linkB, PALETTE.metal2], [M.hubB, PALETTE.metal2], [M.brakeShadow, PALETTE.metal2], [M.metalShadow, PALETTE.metal2],
  [M.treadInner, PALETTE.metal3], [M.metalDeep, PALETTE.metal3],
  [M.hubA, PALETTE.metal0], [M.rivet, PALETTE.metal0], [M.metalLight, PALETTE.metal0],
  [M.lamp, PALETTE.fire1], [M.shine, PALETTE.white],
  [M.energyHot, PALETTE.energy0], [M.energyCore, PALETTE.energy1], [M.energyDeep, PALETTE.energy2],
  [M.bomb, PALETTE.smoke3], [M.bombShine, PALETTE.smoke1], [M.fuse, PALETTE.loam0],
  [M.spark, PALETTE.fire2], [M.brassLight, PALETTE.fire2], [M.brass, PALETTE.ochre0], [M.brassShadow, PALETTE.ochre1],
  [M.hole, PALETTE.outline], [M.warhead, PALETTE.fire4], [M.warheadShadow, PALETTE.fire5],
  [M.woodLight, PALETTE.loam0], [M.wood, PALETTE.loam1], [M.woodDark, PALETTE.loam2],
  [M.stoneLight, PALETTE.stone0], [M.stone, PALETTE.stone1], [M.stoneShadow, PALETTE.stone2], [M.stoneDeep, PALETTE.stone3],
  [M.bone, PALETTE.moon],
]);

const rimColor = (rim: BarrelRim): number => (rim === "hot" ? PALETTE.fire2 : PALETTE.greenLight);

/** チームの色の材質。溜めの間は砲身の上側を光らせる */
const teamColor = (m: number, input: PaintInput): number | null => {
  const { hull, turret } = input;
  switch (m) {
    case M.hullLight: return hull.light;
    case M.hullBase: return hull.base;
    case M.hullShadow: return hull.shadow;
    case M.skirt: return hull.deep;
    case M.turretLight: case M.antennaTip: return turret.light;
    case M.turretBase: return turret.base;
    case M.barrelLight: return input.rim === "none" ? turret.base : rimColor(input.rim);
    case M.turretShadow: case M.barrelShadow: return turret.shadow;
    case M.turretDeep: return turret.deep;
    default: return null;
  }
};

const wreckColor = (m: number): number => {
  switch (m) {
    case M.hullLight: case M.turretLight: return PALETTE.smoke1;
    case M.hullBase: case M.turretBase: case M.barrelLight: return PALETTE.smoke2;
    case M.ember: return PALETTE.fire5;
    default: return PALETTE.smoke3;
  }
};

/** 材質と縁から色を決める。回した後の画面の上の縁は、車体と砲塔の基準色を光の色にして輪郭を立てる */
export const tankPainter = (input: PaintInput) => (m: number, edges: Edges): number => {
  if (input.white) return PALETTE.white;
  if (input.wrecked) return wreckColor(m);
  if (edges.top && m === M.hullBase) return input.hull.light;
  if (edges.top && m === M.turretBase) return input.turret.light;
  return teamColor(m, input) ?? FIXED.get(m) ?? PALETTE.smoke2;
};

/** 砲身の塗り。溜めの間は、材質によらず画面で上の縁に当たる画素を光らせる（金属のレールの砲身でも光る） */
export const barrelPainter = (input: PaintInput) => {
  const paint = tankPainter(input);
  const lit = input.rim !== "none" && !input.wrecked && !input.white;
  return (m: number, edges: Edges): number => (lit && edges.top ? rimColor(input.rim) : paint(m, edges));
};
