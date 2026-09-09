import { z } from "zod";

const id = z.string().trim().min(1).max(128);
const sequence = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const moveCommandSchema = z.object({
  version: z.literal(2), type: z.literal("move.command"), matchId: id,
  turnId: sequence.min(1), commandId: id, moveSeq: sequence.min(1),
  direction: z.union([z.literal(-1), z.literal(1)]), steps: z.number().int().min(1).max(2),
}).strict();
export type MoveCommand = z.infer<typeof moveCommandSchema>;

export const moveSnapshotSchema = z.object({
  version: z.literal(2), type: z.literal("move.snapshot"), matchId: id, turnId: sequence.min(1),
  playerId: id, x: z.number().int(), y: z.number().int(), facing: z.union([z.literal(-1), z.literal(1)]),
  stepsLeft: z.number().int().min(0).max(30), ackMoveSeq: sequence, eventSeq: sequence,
  serverTime: z.number().finite(), stoppedByFall: z.boolean(), eliminated: z.boolean(),
}).strict();
export type MoveSnapshot = z.infer<typeof moveSnapshotSchema>;
