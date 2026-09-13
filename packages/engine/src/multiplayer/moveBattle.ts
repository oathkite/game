import type { TerrainMask } from "@game/sim";
import type { BattlePlayer } from "./combat.js";
import { handleMove, type MovementState } from "./movement.js";
import { eliminatePlayers, outcome, type RosterState } from "./rules.js";

/** hostが保持する確定stateへ移動結果を反映する。認証と配信はtransport側の責務。 */
export const moveBattle = (
  roster: RosterState, players: readonly BattlePlayer[], mask: TerrainMask, movement: MovementState,
  authenticatedPlayerId: string, command: unknown, now: number,
) => {
  const actor = players.find(p => p.playerId === movement.playerId);
  if (roster.turnId !== movement.turnId || roster.turnRing[roster.cursor] !== movement.playerId ||
    (outcome(roster).type !== "ongoing" && !movement.eliminated) ||
    (roster.eliminated.includes(movement.playerId) && !movement.eliminated) ||
    !actor || actor.hp <= 0 || actor.x !== movement.x || actor.y !== movement.y) {
    throw new Error("movement must match the active battle state");
  }
  const reply = handleMove(movement, mask, authenticatedPlayerId, command, now);
  const after = players.map(p => p.playerId === movement.playerId ? { ...p, x: reply.state.x, y: reply.state.y } : p);
  const resolved = reply.state.eliminated ? eliminatePlayers(roster, [movement.playerId]) : roster;
  return { ...reply, players: after, roster: resolved, outcome: outcome(resolved) };
};
