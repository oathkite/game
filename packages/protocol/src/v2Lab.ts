import { z } from "zod";
import { moveCommandSchema, moveSnapshotSchema } from "./v2.js";

// 開発用の8接続移動試験。公開ロビー用のjoin/ready契約とは分離する。
export const labJoinSchema = z.object({ type: z.literal("lab.join"), token: z.string().uuid().optional() }).strict();
export const labInputSchema = z.union([labJoinSchema, moveCommandSchema]);
export const labFrameSchema = z.object({
  type: z.literal("lab.frame"), serverTime: z.number(), eventSeq: z.number().int().nonnegative(),
  matchId: z.string(), turnId: z.number().int(), actorId: z.string(), deadlineAt: z.number(),
  players: z.array(z.object({ playerId: z.string(), x: z.number(), y: z.number(), eliminated: z.boolean() })).length(8),
  movement: moveSnapshotSchema,
});
export const labOutputSchema = z.union([
  labFrameSchema,
  z.object({ type: z.literal("lab.welcome"), playerId: z.string(), token: z.string().uuid() }),
  z.object({ type: z.literal("lab.error"), reason: z.string() }),
  z.object({ type: z.literal("lab.ack"), reason: z.string(), snapshot: moveSnapshotSchema.nullable() }),
]);
export type LabFrame = z.infer<typeof labFrameSchema>;
export type LabOutput = z.infer<typeof labOutputSchema>;
