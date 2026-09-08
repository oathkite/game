import type { TrajectoryInput } from "@game/protocol";
import { simulateShot, spawnPos, type Combatant, type ShotOutcome, type TerrainMask } from "../src/index.js";

// テスト補助は src/fixtures に移した。ブラウザでも同じケースを走らせるため
export { flatMask, islandMask, mirrorMask, mirrorX, shot, slabMask, slopedMask, valleyMask, wallMask } from "../src/fixtures.js";

/** x と HP だけの機体。y はマスクの上から見た地表で埋める */
export type Standing = Omit<Combatant, "y">;

/** 上から見た地表に立つ 2 機と、撃つ側の y を埋めた入力で 1 発撃つ。テストは y を書かずに済む */
export const fire = (mask: TerrainMask, players: readonly [Standing, Standing], input: Omit<TrajectoryInput, "y"> & { readonly y?: number }): ShotOutcome => {
  const at = (p: Standing): Combatant => ({ ...p, ...spawnPos(mask, p.x) });
  return simulateShot(mask, [at(players[0]), at(players[1])], { ...input, y: spawnPos(mask, input.x).y });
};
