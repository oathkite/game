export * from "./constants.js";
export { GOLDEN_CASES, goldenDump, runGolden, type GoldenCase, type GoldenRecord } from "./golden.js";
export { flatMask, islandMask, mirrorMask, mirrorX, shot, slabMask, slopedMask, valleyMask, wallMask } from "./fixtures.js";
export { cellOf, cosFixed, isqrt, mulFixed, normalizeDegrees, sinFixed, toFixed } from "./fixed.js";
export { SIN_TABLE, COS_TABLE, TILT_TABLE } from "./tables.js";
export { applyOps, carve, createMask, isSolid, maskFromHeights, surfaceY, type TerrainMask } from "./terrain.js";
export {
  isRingOut,
  stepOutcome,
  tankCenterY,
  tiltOf,
  validateMove,
  walk,
  type StepOutcome,
  type WalkResult,
} from "./tank.js";
export { initialWind, nextWind, type WindDraw, type WindRolls } from "./wind.js";
export {
  damageAt,
  fireAngle,
  muzzleOf,
  simulateShot,
  traceShot,
  type Combatant,
  type FixedPoint,
  type Muzzle,
  type ShotOutcome,
  type Trace,
} from "./ballistics.js";
