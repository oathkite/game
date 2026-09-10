import { clientBuildSchema, matchBuildSchema } from "./build.js";
import { z } from "zod";
import { WEAPON_IDS } from "./weapons.js";
import { fireCommandSchema, moveCommandSchema, moveSnapshotSchema } from "./v2.js";

// 開発用の8接続移動試験。公開ロビー用のjoin/ready契約とは分離する。
export const labJoinSchema = z.object({ type: z.literal("lab.join"), build: clientBuildSchema.optional(), token: z.string().uuid().optional() }).strict();
export const labInputSchema = z.union([labJoinSchema, moveCommandSchema, fireCommandSchema,
  z.object({ type: z.literal("lab.rematch"), matchId: z.string() }).strict(),
  z.object({ type: z.literal("lab.surrender"), matchId: z.string() }).strict()]);
const labPlayerSchema = z.object({ playerId: z.string(), x: z.number(), y: z.number(), hp: z.number(), teamId: z.string(), eliminated: z.boolean(), nickname: z.string().optional(), loadout: z.tuple([z.enum(WEAPON_IDS), z.enum(WEAPON_IDS)]).optional() });
export const labFrameSchema = z.object({
  build: matchBuildSchema,
  type: z.literal("lab.frame"), serverTime: z.number(), eventSeq: z.number().int().nonnegative(),
  matchId: z.string(), turnId: z.number().int(), actorId: z.string(), deadlineAt: z.number(),
  stats: z.record(z.string(), z.object({ shots: z.number().int().nonnegative(), enemyDamage: z.number().int().nonnegative(), friendlyDamage: z.number().int().nonnegative(), selfDamage: z.number().int().nonnegative() })).optional(),
  upcomingPlayerIds: z.array(z.string()).max(3).optional(),
  players: z.array(labPlayerSchema).min(2).max(8),
  movement: moveSnapshotSchema,
  map: z.object({ id: z.string().min(1).max(128), version: z.number().int().positive(),
    width: z.number().int().min(1).max(500), height: z.number().int().min(1).max(225),
    surface: z.array(z.number().int().min(0).max(225)).max(500),
  }).refine(map => map.surface.length === map.width && map.surface.every(y => y <= map.height)),
  wind: z.number().int().min(-10).max(10),
  phase: z.enum(["acting", "replaying", "finished"]),
  result: z.union([z.object({ type: z.literal("ongoing") }), z.object({ type: z.literal("draw") }), z.object({ type: z.literal("win"), teamId: z.string() })]),
  terrainOps: z.array(z.object({ cx: z.number(), cy: z.number(), radius: z.number() })),
  replay: z.object({ startsAt: z.number(), endsAt: z.number(), terrainOpsBefore: z.number().int().nonnegative(), playersBefore: z.array(labPlayerSchema).min(2).max(8), ticks: z.number().int().nonnegative(),
    shooter: z.object({ playerId: z.string(), facing: z.union([z.literal(-1), z.literal(1)]), elevation: z.number(), weapon: z.enum(WEAPON_IDS) }),
    impacts: z.array(z.object({ tick: z.number().int().nonnegative(), damage: z.array(z.object({ playerId: z.string(), amount: z.number() })) })),
    paths: z.array(z.object({ launchTick: z.number().int().nonnegative(), endTick: z.number().int().nonnegative(), points: z.array(z.object({ x: z.number(), y: z.number(), tick: z.number().int().nonnegative() })) })) }).nullable(),
});
export const labOutputSchema = z.union([
  labFrameSchema,
  z.object({ type: z.literal("lab.welcome"), playerId: z.string(), token: z.string().uuid() }),
  z.object({ type: z.literal("lab.error"), reason: z.string() }),
  z.object({ type: z.literal("lab.ack"), reason: z.string(), snapshot: moveSnapshotSchema.nullable() }),
]);
export type LabFrame = z.infer<typeof labFrameSchema>;
export type LabOutput = z.infer<typeof labOutputSchema>;
