import type { TrajectoryInput } from "@game/protocol";
import { simulateConcurrentCombat, type Combatant, type TerrainMask } from "@game/sim";
import { eliminatePlayers, outcome, type PlayerId, type RosterState } from "./rules.js";

export type BattlePlayer = Combatant & { readonly playerId: PlayerId };
export type BattleShot = Omit<TrajectoryInput, "seat" | "x" | "y"> & { readonly playerId: PlayerId };

/** 位置は確定stateから取得し、射撃リクエストの座標を信用しない。 */
export const resolveBattleShot = (roster: RosterState, mask: TerrainMask, players: readonly BattlePlayer[], input: BattleShot) => {
  const ids = new Set(players.map(p => p.playerId));
  if (ids.size !== players.length || ids.size !== roster.members.length || roster.members.some(p => !ids.has(p.playerId))) {
    throw new Error("combatants must match roster");
  }
  if (outcome(roster).type !== "ongoing" || roster.turnRing[roster.cursor] !== input.playerId || roster.eliminated.includes(input.playerId)) {
    throw new Error("shooter must be the active survivor");
  }
  const ordered = roster.members.map(member => players.find(p => p.playerId === member.playerId)!);
  const shooter = ordered.find(p => p.playerId === input.playerId)!;
  if (shooter.hp <= 0 || shooter.y >= mask.height) throw new Error("shooter is defeated");
  const result = simulateConcurrentCombat(mask, ordered.map(p => roster.eliminated.includes(p.playerId) ? { ...p, hp: 0 } : p),
    { ...input, x: shooter.x, y: shooter.y });
  const after = ordered.map((p, i) => ({ ...p, ...result.positions[i]!, hp: result.hpAfter[i]! }));
  const resolved = eliminatePlayers(roster, after.filter((p, i) => p.hp <= 0 || result.ringOut.includes(i)).map(p => p.playerId));
  return { roster: resolved, players: after, mask: result.mask, paths: result.paths, outcome: outcome(resolved),
    ticks: result.ticks, impacts: result.impacts.map(impact => ({ ...impact,
      damage: ordered.map((p, i) => ({ playerId: p.playerId, amount: impact.damage[i]! })) })) };
};
