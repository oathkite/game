import { roomPageCursor } from "@game/protocol/v2-rooms";
import type { RoomMode, RoomRegion, RoomSummary, RoomPage, RoomListFilter } from "@game/protocol/v2-rooms";
import { quickCandidateQuery, roomPageQuery } from "./directoryQueries.js";

// 部屋一覧（RoomDirectory）の中身。時刻は呼び出し側が now として渡し、ここでは時計を読まない。
// Durable Object は入口で時計を 1 回読み、ctx.storage.sql とともに渡すだけにする。
// 期限は「expires ちょうどまでは有効」で、SQL の expires >= ? と expires < ? がこの境目を表す。

type SqlValue = string | number | null;
/** Durable Object の ctx.storage.sql のうち、ここで使う部分 */
export type DirectorySql = {
  readonly exec: <T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]) => { toArray(): T[]; one(): T };
};

/** quick で割り当てた席の予約。この間に入室しなければ席を戻す */
export const RESERVATION_TTL_MS = 10_000;
/** 作ったまま要約の更新が来ない部屋を、一覧に残す長さ */
export const NEW_ROOM_TTL_MS = 120_000;
/** 要約の更新を受けた部屋を、一覧に残す長さ。更新のたびに延びる */
export const UPDATED_ROOM_TTL_MS = 30 * 60_000;
/** 1 つの Directory が持てる、期限内の部屋の数 */
export const DIRECTORY_ROOM_LIMIT = 1_000;

export const createDirectoryTables = (sql: DirectorySql): void => {
  sql.exec("CREATE TABLE IF NOT EXISTS reservations (room_id TEXT NOT NULL, expires INTEGER NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS room_codes (id TEXT PRIMARY KEY)");
  sql.exec("CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, summary TEXT NOT NULL, expires INTEGER NOT NULL)");
  sql.exec("CREATE INDEX IF NOT EXISTS rooms_created ON rooms(COALESCE(json_extract(summary, '$.createdAt'), 0) DESC, id ASC)");
  sql.exec("INSERT OR IGNORE INTO room_codes SELECT id FROM rooms");
};

/** 新しい部屋の要約。まだ誰も入っていない */
export const newRoomSummary = (roomId: string, mode: RoomMode, region: RoomRegion, now: number): RoomSummary =>
  ({ roomId, mode, region, members: 0, spectators: 0, phase: "waiting", mapId: "moss-valley", createdAt: now, updatedAt: now });

/** 部屋を一覧に登録する。期限の切れた部屋は数えず、上限に達していれば断る */
export const createRoomEntry = async (sql: DirectorySql, now: number, mode: RoomMode, region: RoomRegion, reserveCode: () => Promise<string>): Promise<string> => {
  sql.exec("DELETE FROM rooms WHERE expires < ?", now);
  if (sql.exec<{ total: number }>("SELECT COUNT(*) AS total FROM rooms").one().total >= DIRECTORY_ROOM_LIMIT) throw new Error("directory capacity");
  const roomId = await reserveCode();
  sql.exec("INSERT INTO rooms VALUES (?, ?, ?)", roomId, JSON.stringify(newRoomSummary(roomId, mode, region, now)), now + NEW_ROOM_TTL_MS);
  return roomId;
};

export const roomExists = (sql: DirectorySql, now: number, roomId: string): boolean =>
  sql.exec("SELECT id FROM rooms WHERE id = ? AND expires >= ?", roomId, now).toArray().length > 0;

/** 同じ mode と region の待機部屋から空席を探して予約する。空きがなければ部屋を作る */
export const quickRoom = async (sql: DirectorySql, now: number, mode: Exclude<RoomMode, "custom">, region: RoomRegion, reserveCode: () => Promise<string>): Promise<string> => {
  sql.exec("DELETE FROM reservations WHERE expires < ?", now);
  const capacity = mode === "1v1" ? 2 : 4;
  const candidate = sql.exec<{ id: string }>(quickCandidateQuery, now, mode, region, capacity).toArray()[0];
  const roomId = candidate?.id ?? await createRoomEntry(sql, now, mode, region, reserveCode);
  sql.exec("INSERT INTO reservations VALUES (?, ?)", roomId, now + RESERVATION_TTL_MS);
  return roomId;
};

/** 部屋から届いた要約を反映する。古い要約は無視し、入室した人数だけ予約を戻す。誰もいなくなった部屋は消す */
export const updateRoomEntry = (sql: DirectorySql, now: number, summary: RoomSummary): void => {
  const row = sql.exec<{ summary: string }>("SELECT summary FROM rooms WHERE id = ?", summary.roomId).toArray()[0];
  const before = row ? JSON.parse(row.summary) as RoomSummary : undefined;
  if (before && before.updatedAt > summary.updatedAt) return;
  const added = Math.max(0, summary.members - (before?.members ?? 0));
  if (added) sql.exec("DELETE FROM reservations WHERE rowid IN (SELECT rowid FROM reservations WHERE room_id = ? ORDER BY expires LIMIT ?)", summary.roomId, added);
  if (!summary.members && !summary.spectators) { sql.exec("DELETE FROM rooms WHERE id = ?", summary.roomId); return; }
  const createdAt = before ? before.createdAt ?? 0 : summary.createdAt ?? now;
  sql.exec("INSERT OR REPLACE INTO rooms VALUES (?, ?, ?)", summary.roomId, JSON.stringify({ ...summary, createdAt }), now + UPDATED_ROOM_TTL_MS);
};

export const roomPage = (sql: DirectorySql, now: number, after: string, filter: RoomListFilter = {}): RoomPage => {
  const query = roomPageQuery(after, now, filter);
  const rooms = sql.exec<{ summary: string }>(query.sql, ...query.bindings).toArray().map(row => JSON.parse(row.summary) as RoomSummary);
  const page = rooms.slice(0, 20);
  return { rooms: page, nextCursor: rooms.length > 20 ? roomPageCursor(page.at(-1)!) : null };
};

export const listRooms = (sql: DirectorySql, now: number): readonly RoomSummary[] =>
  sql.exec<{ summary: string }>("SELECT summary FROM rooms WHERE expires >= ? ORDER BY expires DESC LIMIT 100", now).toArray().map(row => JSON.parse(row.summary) as RoomSummary);
