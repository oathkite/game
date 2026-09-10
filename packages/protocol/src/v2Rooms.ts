import { clientBuildSchema } from "./build.js";
import { z } from "zod";
import { fireCommandSchema, lobbyCommandSchema, lobbyProfileSchema, moveCommandSchema } from "./v2.js";
import { labOutputSchema } from "./v2Lab.js";
export const roomModeSchema = z.enum(["custom", "1v1", "2v2"]);
export const roomRegionSchema = z.enum(["asia", "europe", "americas"]);
export type RoomMode = z.infer<typeof roomModeSchema>;
export type RoomRegion = z.infer<typeof roomRegionSchema>;
export const quickRequestSchema = z.object({ mode: z.enum(["1v1", "2v2"]), region: roomRegionSchema }).strict();
export const reportReasonSchema = z.enum(["name", "abuse", "cheating"]);
export const reportResultSchema = z.object({ type: z.literal("room.reported"), status: z.enum(["saved", "duplicate"]) }).strict();
const roomId = z.string().regex(/^[A-F0-9]{6}$/);
export const roomInputSchema = z.union([
  z.object({ type: z.literal("room.ping"), nonce: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict(),
  z.object({ type: z.literal("room.report"), matchId: z.string().min(1).max(128), targetId: z.string().min(1).max(128), reason: reportReasonSchema }).strict(),
  quickRequestSchema.extend({ type: z.literal("room.quick"), build: clientBuildSchema.optional(), roomId, profile: lobbyProfileSchema }).strict(),
  z.object({ type: z.literal("room.spectate"), build: clientBuildSchema.optional(), roomId }).strict(),
  z.object({ type: z.literal("room.create"), build: clientBuildSchema.optional(), profile: lobbyProfileSchema }).strict(),
  z.object({ type: z.literal("room.join"), build: clientBuildSchema.optional(), roomId, profile: lobbyProfileSchema }).strict(),
  z.object({ type: z.literal("room.resume"), build: clientBuildSchema.optional(), token: z.string().uuid() }).strict(),
  z.object({ type: z.literal("room.leave") }).strict(),
  z.object({ type: z.literal("room.start"), version: z.literal(2), roomId, revision: z.number().int().positive() }).strict(),
  z.object({ type: z.literal("lab.rematch"), matchId: z.string() }).strict(),
  z.object({ type: z.literal("lab.surrender"), matchId: z.string() }).strict(),
  lobbyCommandSchema, fireCommandSchema, moveCommandSchema,
]);
export const roomSnapshotSchema = z.object({ type: z.literal("room.snapshot"), room: z.object({
  mode: roomModeSchema.default("custom"), region: roomRegionSchema.default("asia"),
  roomId, ownerId: z.string().nullable(), revision: z.number().int(), phase: z.enum(["waiting", "started"]),
  members: z.array(lobbyProfileSchema.extend({ playerId: z.string(), teamId: z.string().nullable(), connected: z.boolean(), ready: z.boolean() })).max(8),
  map: z.object({ id: z.string(), version: z.number(), width: z.number(), height: z.number() }),
}) });
export const roomOutputSchema = z.union([
  z.object({ type: z.literal("room.pong"), nonce: z.number().int().nonnegative() }).strict(),labOutputSchema, roomSnapshotSchema, reportResultSchema,
  z.object({ type: z.literal("room.welcome"), playerId: z.string(), token: z.string().uuid(), role: z.enum(["player", "spectator"]).default("player"), generation: z.number().int().positive().default(1) }),
  z.object({ type: z.literal("room.error"), reason: z.string() }),
]);
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>["room"];
