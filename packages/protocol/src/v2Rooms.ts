import { clientBuildSchema } from "./build.js";
import { z } from "zod";
import { fireCommandSchema, lobbyCommandSchema, lobbyProfileSchema, moveCommandSchema } from "./v2.js";
import { labOutputSchema } from "./v2Lab.js";
export const roomModeSchema = z.enum(["custom", "1v1", "2v2"]);
export const roomRegionSchema = z.enum(["asia", "europe", "americas"]);
export type RoomMode = z.infer<typeof roomModeSchema>;
export type RoomRegion = z.infer<typeof roomRegionSchema>;
export const quickRequestSchema = z.object({ mode: z.enum(["1v1", "2v2"]), region: roomRegionSchema }).strict();
export const createRoomOptionsSchema = z.object({ name: z.string().trim().max(32).default(""), password: z.string().max(64).default(""), mapId: z.string().min(1).max(64).default("moss-valley"), region: roomRegionSchema.default("asia") }).strict();
export type CreateRoomOptions = z.infer<typeof createRoomOptionsSchema>;
export const reportReasonSchema = z.enum(["name", "abuse", "cheating"]);
export const reportResultSchema = z.object({ type: z.literal("room.reported"), status: z.enum(["saved", "duplicate"]) }).strict();
const roomId = z.string().regex(/^[A-F0-9]{6}$/);
export const roomInputSchema = z.union([
  z.object({ type: z.literal("room.ping"), nonce: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict(),
  z.object({ type: z.literal("room.report"), matchId: z.string().min(1).max(128), targetId: z.string().min(1).max(128), reason: reportReasonSchema }).strict(),
  quickRequestSchema.extend({ type: z.literal("room.quick"), build: clientBuildSchema.optional(), roomId, profile: lobbyProfileSchema }).strict(),
  z.object({ type: z.literal("room.spectate"), password: z.string().max(64).optional(), invite: z.string().uuid().optional(), build: clientBuildSchema.optional(), roomId }).strict(),
  z.object({ type: z.literal("room.create"), password: z.string().max(64).optional(), build: clientBuildSchema.optional(), profile: lobbyProfileSchema }).strict(),
  z.object({ type: z.literal("room.join"), password: z.string().max(64).optional(), invite: z.string().uuid().optional(), build: clientBuildSchema.optional(), roomId, profile: lobbyProfileSchema }).strict(),
  z.object({ type: z.literal("room.resume"), build: clientBuildSchema.optional(), token: z.string().uuid() }).strict(),
  z.object({ type: z.literal("room.leave") }).strict(),
  z.object({ type: z.literal("room.start"), version: z.literal(2), roomId, revision: z.number().int().positive() }).strict(),
  z.object({ type: z.literal("lab.rematch"), matchId: z.string() }).strict(),
  z.object({ type: z.literal("lab.surrender"), matchId: z.string() }).strict(),
  lobbyCommandSchema, fireCommandSchema, moveCommandSchema,
]);
export const roomSnapshotSchema = z.object({ type: z.literal("room.snapshot"), room: z.object({
  mode: roomModeSchema.default("custom"), region: roomRegionSchema.default("asia"),
  name: z.string().optional(), passwordProtected: z.boolean().optional(), roomId, ownerId: z.string().nullable(), revision: z.number().int(), phase: z.enum(["waiting", "started"]),
  members: z.array(lobbyProfileSchema.extend({ playerId: z.string(), teamId: z.string().nullable(), connected: z.boolean(), ready: z.boolean() })).max(8),
  randomMap: z.boolean().optional(),
  map: z.object({ id: z.string(), version: z.number(), width: z.number(), height: z.number() }),
}) });
export const roomOutputSchema = z.union([
  z.object({ type: z.literal("room.pong"), nonce: z.number().int().nonnegative() }).strict(),labOutputSchema, roomSnapshotSchema, reportResultSchema,
  z.object({ type: z.literal("room.welcome"), playerId: z.string(), token: z.string().uuid(), role: z.enum(["player", "spectator"]).default("player"), generation: z.number().int().positive().default(1) }),
  z.object({ type: z.literal("room.error"), reason: z.string() }),
]);
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>["room"];

export const roomSummarySchema = z.object({
  name: z.string().optional(), passwordProtected: z.boolean().optional(), mode: roomModeSchema, region: roomRegionSchema, roomId: z.string().regex(/^[A-F0-9]{6}$/),
  members: z.number().int().min(0).max(8), spectators: z.number().int().min(0).max(8),
  phase: z.enum(["waiting", "started"]), mapId: z.string().min(1).max(64), updatedAt: z.number().int().nonnegative(), createdAt: z.number().int().nonnegative().optional(),
});
export type RoomSummary = z.infer<typeof roomSummarySchema>;
export const roomPageCursorSchema = z.string().regex(/^(?:[0-9]{1,16}:[A-F0-9]{6})?$/);
export const roomPageSchema = z.object({ rooms: z.array(roomSummarySchema).max(20), nextCursor: z.string().regex(/^[0-9]{1,16}:[A-F0-9]{6}$/).nullable() });
export type RoomPage = z.infer<typeof roomPageSchema>;

export const roomListFilterSchema = z.object({
  code: z.string().regex(/^[A-F0-9]{0,6}$/).optional(),
  map: z.string().max(64).optional(),
  phase: z.enum(["", "waiting", "started"]).optional(),
  vacancy: z.enum(["", "available"]).optional(),
});
export type RoomListFilter = z.infer<typeof roomListFilterSchema>;

export const roomPageCursor = (room: RoomSummary): string => `${room.createdAt ?? 0}:${room.roomId}`;
