import { z } from "zod";
import { fireCommandSchema, lobbyCommandSchema, lobbyProfileSchema, moveCommandSchema } from "./v2.js";
import { labOutputSchema } from "./v2Lab.js";
const roomId = z.string().regex(/^[A-F0-9]{6}$/);
export const roomInputSchema = z.union([
  z.object({ type: z.literal("room.spectate"), roomId }).strict(),
  z.object({ type: z.literal("room.create"), profile: lobbyProfileSchema }).strict(),
  z.object({ type: z.literal("room.join"), roomId, profile: lobbyProfileSchema }).strict(),
  z.object({ type: z.literal("room.resume"), token: z.string().uuid() }).strict(),
  z.object({ type: z.literal("room.leave") }).strict(),
  z.object({ type: z.literal("room.start"), version: z.literal(2), roomId, revision: z.number().int().positive() }).strict(),
  z.object({ type: z.literal("lab.rematch"), matchId: z.string() }).strict(),
  z.object({ type: z.literal("lab.surrender"), matchId: z.string() }).strict(),
  lobbyCommandSchema, fireCommandSchema, moveCommandSchema,
]);
export const roomSnapshotSchema = z.object({ type: z.literal("room.snapshot"), room: z.object({
  roomId, ownerId: z.string().nullable(), revision: z.number().int(), phase: z.enum(["waiting", "started"]),
  members: z.array(lobbyProfileSchema.extend({ playerId: z.string(), teamId: z.string().nullable(), connected: z.boolean(), ready: z.boolean() })).max(8),
  map: z.object({ id: z.string(), version: z.number(), width: z.number(), height: z.number() }),
}) });
export const roomOutputSchema = z.union([labOutputSchema, roomSnapshotSchema,
  z.object({ type: z.literal("room.welcome"), playerId: z.string(), token: z.string().uuid(), role: z.enum(["player", "spectator"]).default("player"), generation: z.number().int().positive().default(1) }),
  z.object({ type: z.literal("room.error"), reason: z.string() }),
]);
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>["room"];
