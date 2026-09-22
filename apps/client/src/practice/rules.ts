import type { TerrainOp } from "@game/protocol";
import { groundBelow, TANK_RADIUS, type TerrainMask } from "@game/sim";

export const TARGET_HEIGHT = 8;
export type Target = { readonly id: string; readonly x: number; readonly y: number; readonly destroyed: boolean };
export type ChallengeStatus = "playing" | "clear" | "failed";

/** 的の中心は接地点から8セル上。爆風との接触か、足場を失った落下で壊れる。 */
export const resolveTargets = (mask: TerrainMask, targets: readonly Target[], blasts: readonly TerrainOp[]): readonly Target[] =>
  targets.map((target) => {
    if (target.destroyed) return target;
    const hit = blasts.some(({ cx, cy, radius }) => {
      const dx = target.x - cx;
      const dy = target.y - TARGET_HEIGHT - cy;
      return dx * dx + dy * dy <= (radius + TANK_RADIUS) ** 2;
    });
    const fell = groundBelow(mask, target.x, target.y) > target.y;
    return hit || fell ? { ...target, destroyed: true } : target;
  });

export const challengeStatus = (targets: readonly Target[], used: number, limit: number, ringOut: boolean): ChallengeStatus => {
  if (targets.every((target) => target.destroyed)) return "clear";
  return ringOut || used >= limit ? "failed" : "playing";
};
