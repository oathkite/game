export * from "./constants.js";
export { GOLDEN_CASES, goldenDump, runGolden, type GoldenCase, type GoldenRecord } from "./golden.js";
export { flatMask, islandMask, mirrorMask, mirrorX, shot, slabMask, slopedMask, valleyMask, wallMask } from "./fixtures.js";
export { cellOf, cosFixed, isqrt, mulFixed, normalizeDegrees, sinFixed, toFixed } from "./fixed.js";
export { SIN_TABLE, COS_TABLE, TILT_TABLE } from "./tables.js";
export { applyOps, carve, createMask, groundBelow, isSolid, maskFromHeights, surfaceY, type TerrainMask } from "./terrain.js";
export {
  hasClearance,
  isRingOut,
  settle,
  spawnPos,
  stepOutcome,
  TANK_HEIGHT,
  tankCenterY,
  tiltOf,
  validateMove,
  walk,
  type StepKind,
  type StepOutcome,
  type TankPos,
  type WalkResult,
} from "./tank.js";
export { initialWind, nextWind, type WindDraw, type WindRolls } from "./wind.js";
export {
  damageAt,
  damageDealtTo,
  fireAngle,
  muzzleOf,
  simulateShot,
  simulateCombat,
  type CombatOutcome,
  type CombatImpact,
  type Combatant,
  type FixedPoint,
  type Muzzle,
  type ProjectilePath,
  type ShotOutcome,
} from "./ballistics.js";
export { WEAPON_SPECS, firstStage, fullHitDamage, projectileCount, scalePercent, weaponSpec, type FanSpec, type StageSpec, type WeaponSpec } from "./weapons.js";

export { simulateConcurrentCombat, COMBAT_TICK_MS, VOLLEY_GAP_TICKS, IMPACT_HOLD_TICKS, type TimedProjectilePath, type TimedCombatImpact, type ConcurrentOutcome } from "./concurrent.js";
