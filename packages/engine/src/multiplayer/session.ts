import { fireCommandSchema, type FireCommand } from "@game/protocol/v2";
import type { TerrainOp } from "@game/protocol";
import { COMBAT_TICK_MS, type TerrainMask } from "@game/sim";
import { resolveBattleShot, type BattlePlayer } from "./combat.js";
import type { createBattle } from "./create.js";
import { createMovement, type MovementState } from "./movement.js";
import { moveBattle } from "./moveBattle.js";
import { eliminatePlayers, nextTurn, outcome, type RosterState, type TeamOutcome } from "./rules.js";

type ResolvedShot = ReturnType<typeof resolveBattleShot>;
export type BattleSession = {
  readonly matchId: string; readonly roster: RosterState; readonly players: readonly BattlePlayer[];
  readonly mask: TerrainMask; readonly movement: MovementState; readonly startedAt: number;
  readonly phase: "acting" | "replaying" | "finished"; readonly result: TeamOutcome;
  readonly terrainOps: readonly TerrainOp[];
  readonly replay: { readonly startsAt: number; readonly endsAt: number; readonly shot: ResolvedShot; readonly playersBefore: readonly BattlePlayer[]; readonly eliminatedBefore: readonly string[]; readonly origin: { readonly x: number; readonly y: number } } | null;
  readonly lastFire: { readonly playerId: string; readonly command: FireCommand } | null;
};
const movementFor = (state: Pick<BattleSession, "matchId" | "roster" | "players">, now: number, eventSeq: number): MovementState => {
  const player = state.players.find(p => p.playerId === state.roster.turnRing[state.roster.cursor])!;
  return createMovement({ matchId: state.matchId, turnId: state.roster.turnId, ...player, facing: 1, startsAt: now, deadlineAt: now + 20000 }, eventSeq);
};
export const createBattleSession = (battle: ReturnType<typeof createBattle>, matchId: string, now: number): BattleSession => ({
  ...battle, matchId, startedAt: now, phase: "acting", result: { type: "ongoing" }, terrainOps: [], replay: null, lastFire: null,
  movement: movementFor({ ...battle, matchId }, now, 1),
});
const advance = (state: BattleSession, now: number): BattleSession => {
  const result = outcome(state.roster), roster = nextTurn(state.roster);
  if (result.type !== "ongoing" || roster.round > 12 || now - state.startedAt >= 1200000) {
    return { ...state, phase: "finished", result: result.type === "ongoing" ? { type: "draw" } : result,
      movement: { ...state.movement, locked: true, eventSeq: state.movement.eventSeq + 1 } };
  }
  const next = { ...state, roster, phase: "acting" as const, replay: null };
  return { ...next, movement: movementFor(next, now, state.movement.eventSeq + 1) };
};
export const tickSession = (state: BattleSession, now: number): BattleSession => {
  if (state.phase === "replaying" && now >= state.replay!.endsAt) return advance(state, now);
  if (state.phase === "acting" && now >= state.movement.deadlineAt) return advance(state, now);
  return state;
};
export const moveInSession = (state: BattleSession, playerId: string, raw: unknown, now: number) => {
  if (state.phase !== "acting") return { state, reason: "not-acting", snapshot: null };
  const moved = moveBattle(state.roster, state.players, state.mask, state.movement, playerId, raw, now);
  if (moved.state === state.movement) return { state, reason: moved.reason, snapshot: moved.snapshot };
  const next = { ...state, roster: moved.roster, players: moved.players, movement: moved.state };
  return { state: moved.state.eliminated ? advance(next, now) : next, reason: moved.reason, snapshot: moved.snapshot };
};
export const fireInSession = (state: BattleSession, playerId: string, raw: unknown, now: number) => {
  const reject = (reason: string) => ({ state, reason });
  const parsed = fireCommandSchema.safeParse(raw);
  if (!parsed.success || !Number.isFinite(now)) return reject("invalid");
  const command = parsed.data, previous = state.lastFire;
  if (previous?.command.commandId === command.commandId && previous.playerId === playerId) {
    return reject(JSON.stringify(previous.command) === JSON.stringify(command) ? "duplicate" : "command-conflict");
  }
  if (playerId !== state.movement.playerId) return reject("not-actor");
  if (command.matchId !== state.matchId || command.turnId !== state.roster.turnId) return reject("wrong-turn");
  if (state.phase !== "acting") return reject("not-acting");
  if (now < state.movement.startsAt || now >= state.movement.deadlineAt) return reject("outside-turn");
  if (command.ackMoveSeq !== state.movement.ackMoveSeq) return reject("move-sync-required");
  // 試験用固定loadout。正式ロビー接続時は開始時に固定した各人のloadoutを参照する。
  const weapon = command.slot === 0 ? "cannon" : "digger";
  const shot = resolveBattleShot(state.roster, state.mask, state.players, { playerId, weapon, wind: 0,
    facing: command.facing, elevation: command.elevation, power: command.power });
  const duration = Math.min(8000, Math.max(1000, shot.ticks * COMBAT_TICK_MS + 300));
  const next: BattleSession = { ...state, roster: shot.roster, players: shot.players, mask: shot.mask, phase: "replaying",
    movement: { ...state.movement, locked: true, eventSeq: state.movement.eventSeq + 1 },
    terrainOps: [...state.terrainOps, ...shot.impacts.map(i => i.terrainOp)],
    replay: { startsAt: now, endsAt: now + duration, shot, playersBefore: state.players, eliminatedBefore: state.roster.eliminated, origin: { x: state.movement.x, y: state.movement.y } },
    lastFire: { playerId, command } };
  return { state: next, reason: "accepted" };
};

export const forfeitInSession = (state: BattleSession, playerIds: readonly string[], now: number): BattleSession => {
  if (state.phase === "finished") return state;
  const ids = playerIds.filter(id => state.roster.members.some(p => p.playerId === id) && !state.roster.eliminated.includes(id));
  if (!ids.length) return state;
  const roster = eliminatePlayers(state.roster, ids);
  const next = { ...state, roster, movement: { ...state.movement, eventSeq: state.movement.eventSeq + 1 } };
  if (state.phase === "replaying") return next;
  return ids.includes(state.movement.playerId) || outcome(roster).type !== "ongoing" ? advance(next, now) : next;
};
export const surrenderInSession = (state: BattleSession, playerId: string, now: number): BattleSession => forfeitInSession(state, [playerId], now);
