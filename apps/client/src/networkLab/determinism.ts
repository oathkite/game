import { flatMask, simulateConcurrentCombat, type Combatant } from "@game/sim";
import type { TrajectoryInput } from "@game/protocol";
// DEV-only Node/browser parity harness, loaded by the network E2E suite.
export const simulateCases = (players: readonly Combatant[], inputs: readonly TrajectoryInput[]) => inputs.map(input => {
  const result = simulateConcurrentCombat(flatMask(), players, input);
  return { impacts: result.impacts, hpAfter: result.hpAfter, positions: result.positions, paths: result.paths, terrain: Array.from(result.mask.cells) };
});
