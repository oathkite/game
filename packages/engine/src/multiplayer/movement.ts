import { moveCommandSchema, type MoveCommand, type MoveSnapshot } from "@game/protocol/v2";
import { isRingOut, walk, type TerrainMask } from "@game/sim";

type Receipt = { readonly command: MoveCommand; readonly snapshot: MoveSnapshot; readonly reason: MoveReason };
export type MovementState = {
  readonly matchId: string; readonly turnId: number; readonly playerId: string;
  readonly x: number; readonly y: number; readonly facing: -1 | 1;
  readonly startsAt: number; readonly deadlineAt: number;
  readonly stepsLeft: number; readonly credit: number; readonly creditAt: number;
  readonly ackMoveSeq: number; readonly eventSeq: number;
  readonly stoppedByFall: boolean; readonly eliminated: boolean; readonly locked: boolean;
  readonly receipts: readonly Receipt[];
};
export type MoveReason = "accepted" | "partial" | "blocked" | "rate-limited" | "no-budget" | "stopped" |
  "invalid" | "wrong-turn" | "not-actor" | "outside-turn" | "sync-required" | "command-conflict" | "command-limit";
export type MoveReply = { readonly state: MovementState; readonly reason: MoveReason; readonly snapshot: MoveSnapshot | null };
export type MovementStart = Pick<MovementState, "matchId" | "turnId" | "playerId" | "x" | "y" | "facing" | "startsAt" | "deadlineAt">;
export const createMovement = (start: MovementStart, eventSeq = 0): MovementState => ({
  ...start, stepsLeft: 30, credit: 2, creditAt: start.startsAt, ackMoveSeq: 0, eventSeq,
  stoppedByFall: false, eliminated: false, locked: false, receipts: [],
});
export const movementSnapshot = (state: MovementState, now: number): MoveSnapshot => ({
  version: 2, type: "move.snapshot", matchId: state.matchId, turnId: state.turnId, playerId: state.playerId,
  x: state.x, y: state.y, facing: state.facing, stepsLeft: state.stepsLeft, ackMoveSeq: state.ackMoveSeq,
  eventSeq: state.eventSeq, serverTime: now, stoppedByFall: state.stoppedByFall, eliminated: state.eliminated,
});
const applyMove = (state: MovementState, mask: TerrainMask, command: MoveCommand, now: number): MoveReply => {
  const creditAt = Math.max(state.creditAt, now);
  const credit = Math.min(2, state.credit + (creditAt - state.creditAt) / 100);
  const allowed = Math.min(command.steps, state.stepsLeft, Math.floor(credit));
  const stopped = state.locked || state.stoppedByFall || state.eliminated;
  const moved = walk(mask, state, command.direction, stopped ? 0 : allowed);
  const reason: MoveReason = stopped ? "stopped" : state.stepsLeft === 0 ? "no-budget" : allowed === 0 ? "rate-limited" :
    moved.stepsUsed === 0 ? "blocked" : moved.stepsUsed < command.steps ? "partial" : "accepted";
  const next: MovementState = { ...state, x: moved.x, y: moved.y,
    facing: moved.stepsUsed > 0 ? command.direction : state.facing,
    stepsLeft: state.stepsLeft - moved.stepsUsed, credit: credit - moved.stepsUsed, creditAt,
    stoppedByFall: state.stoppedByFall || moved.fell, eliminated: state.eliminated || isRingOut(mask, moved),
    ackMoveSeq: command.moveSeq, eventSeq: state.eventSeq + 1 };
  const snapshot = movementSnapshot(next, now);
  return { state: { ...next, receipts: [...state.receipts, { command, snapshot, reason }] }, reason, snapshot };
};

/** authenticatedPlayerIdは接続sessionから渡す。payloadの本人申告を採用しない。 */
export const handleMove = (state: MovementState, mask: TerrainMask, authenticatedPlayerId: string, raw: unknown, now: number): MoveReply => {
  const reject = (reason: MoveReason): MoveReply => ({ state, reason, snapshot: null });
  const parsed = moveCommandSchema.safeParse(raw);
  if (!parsed.success || !Number.isFinite(now)) return reject("invalid");
  const command = parsed.data;
  if (authenticatedPlayerId !== state.playerId) return reject("not-actor");
  if (command.matchId !== state.matchId || command.turnId !== state.turnId) return reject("wrong-turn");
  const receipt = state.receipts.find(r => r.command.moveSeq === command.moveSeq || r.command.commandId === command.commandId);
  if (receipt) return JSON.stringify(receipt.command) === JSON.stringify(command)
    ? { state, reason: receipt.reason, snapshot: receipt.snapshot } : reject("command-conflict");
  if (command.moveSeq !== state.ackMoveSeq + 1) return reject("sync-required");
  if (now < state.startsAt || now >= state.deadlineAt) return reject("outside-turn");
  // 20秒×10Hzの通常入力を収め、拒否commandの無制限な履歴増加を防ぐ。
  if (state.receipts.length >= 256) return reject("command-limit");
  return applyMove(state, mask, command, now);
};
