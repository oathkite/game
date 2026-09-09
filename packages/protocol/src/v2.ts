import { z } from "zod";
import { WEAPON_IDS } from "./weapons.js";

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

export const fireCommandSchema = z.object({
  version: z.literal(2), type: z.literal("turn.fire"), matchId: id, turnId: sequence.min(1), commandId: id,
  ackMoveSeq: sequence, slot: z.union([z.literal(0), z.literal(1)]),
  facing: z.union([z.literal(-1), z.literal(1)]), elevation: z.number().int().min(10).max(90), power: z.number().int().min(0).max(100),
}).strict();
export type FireCommand = z.infer<typeof fireCommandSchema>;

// Match preparation commands carry the composition revision acknowledged by the member.
const lobbyBase = { version: z.literal(2), roomId: id, revision: sequence.min(1) };
const lobbyLoadout = z.tuple([z.enum(WEAPON_IDS), z.enum(WEAPON_IDS)]).refine(pair => pair[0] !== pair[1]);
export const lobbyProfileSchema = z.object({ nickname: z.string().trim().min(1).max(12), loadout: lobbyLoadout }).strict();
export const lobbyCommandSchema = z.discriminatedUnion("type", [
  z.object({ ...lobbyBase, type: z.literal("room.ready"), ready: z.boolean() }).strict(),
  z.object({ ...lobbyBase, type: z.literal("room.assignTeam"), playerId: id, teamId: z.enum(["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"]).nullable() }).strict(),
  z.object({ ...lobbyBase, type: z.literal("room.profile"), nickname: z.string().trim().min(1).max(12) }).strict(),
  z.object({ ...lobbyBase, type: z.literal("room.loadout"), loadout: lobbyLoadout }).strict(),
]);
