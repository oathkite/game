import { z } from "zod";
import { MAP_NAMES, NICKNAME_MAX, PLAYER_COLORS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, ROOM_TITLE_MAX } from "./constants.js";

// クライアントからサーバーへ届くメッセージの Zod スキーマ。設計書 05 の 5.2。
// サーバーは受信したすべてのメッセージをこれで検証する。

export const seatSchema = z.union([z.literal(0), z.literal(1)]);
export const facingSchema = z.union([z.literal(-1), z.literal(1)]);
export const playerColorSchema = z.enum(PLAYER_COLORS);
export const mapNameSchema = z.enum(MAP_NAMES);

export const tankColorsSchema = z.object({
  primary: playerColorSchema,
  secondary: playerColorSchema,
});

/** 1 文字以上 12 文字以下。空白のみは不可 */
export const nicknameSchema = z
  .string()
  .max(NICKNAME_MAX)
  .refine((s) => s.trim().length > 0, "空白のみの名前は使えない");

export const roomCodeSchema = z
  .string()
  .length(ROOM_CODE_LENGTH)
  .refine((s) => [...s].every((c) => ROOM_CODE_ALPHABET.includes(c)), "使えない文字を含む");

/** 端末ごとの匿名 ID。形式は UUID に限らないが長さだけ縛る */
export const playerIdSchema = z.string().min(8).max(64);

export const roomTitleSchema = z.string().max(ROOM_TITLE_MAX);

export const lobbyQuerySchema = z.object({
  type: z.literal("lobby.query"),
  search: z.string().max(ROOM_TITLE_MAX),
  phase: z.enum(["all", "open", "inMatch"]),
  mapName: mapNameSchema.nullable(),
  page: z.number().int().min(0),
});

export const roomCreateSchema = z.object({
  type: z.literal("room.create"),
  playerId: playerIdSchema,
  nickname: nicknameSchema,
  colors: tankColorsSchema,
  title: roomTitleSchema,
  isPublic: z.boolean(),
  mapName: mapNameSchema,
});

export const roomJoinSchema = z.object({
  type: z.literal("room.join"),
  code: roomCodeSchema,
  playerId: playerIdSchema,
  nickname: nicknameSchema,
  colors: tankColorsSchema,
});

export const roomSpectateSchema = z.object({
  type: z.literal("room.spectate"),
  code: roomCodeSchema,
  playerId: playerIdSchema,
  nickname: nicknameSchema,
});

export const turnFireSchema = z.object({
  type: z.literal("turn.fire"),
  facing: facingSchema,
  elevation: z.number().int().min(10).max(90),
  power: z.number().int().min(0).max(100),
  x: z.number().int().min(0).max(399),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("lobby.subscribe") }),
  lobbyQuerySchema,
  z.object({ type: z.literal("lobby.unsubscribe") }),
  roomCreateSchema,
  roomJoinSchema,
  roomSpectateSchema,
  z.object({ type: z.literal("room.takeSeat"), colors: tankColorsSchema }),
  z.object({ type: z.literal("room.ready"), ready: z.boolean() }),
  z.object({ type: z.literal("room.profile"), nickname: nicknameSchema, colors: tankColorsSchema }),
  z.object({ type: z.literal("room.setMap"), mapName: mapNameSchema }),
  z.object({ type: z.literal("room.kick"), seat: seatSchema }),
  z.object({ type: z.literal("room.start") }),
  z.object({ type: z.literal("room.leave") }),
  z.object({ type: z.literal("room.dissolve") }),
  z.object({ type: z.literal("match.ready") }),
  turnFireSchema,
  z.object({ type: z.literal("turn.replayDone") }),
  z.object({ type: z.literal("match.surrender") }),
  z.object({ type: z.literal("result.close") }),
  z.object({ type: z.literal("conn.resume"), token: z.string().min(8).max(128) }),
  z.object({ type: z.literal("time.ping"), sentAt: z.number() }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ClientMessageType = ClientMessage["type"];
export type ClientMessageOf<T extends ClientMessageType> = Extract<ClientMessage, { type: T }>;

export type ParseResult = { readonly ok: true; readonly message: ClientMessage } | { readonly ok: false; readonly error: string };

/** 生の文字列を検証する。JSON でないものや未知の type は ok: false */
export const parseClientMessage = (raw: string): ParseResult => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid json" };
  }
  const parsed = clientMessageSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  return { ok: true, message: parsed.data };
};
