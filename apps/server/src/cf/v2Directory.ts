import type { RoomMode, RoomRegion, RoomSummary, RoomPage } from "@game/protocol/v2-rooms";
import { quickCandidateQuery } from "./directoryQueries.js";
import { DurableObject } from "cloudflare:workers";
export type { RoomSummary } from "@game/protocol/v2-rooms";
export class RoomDirectory extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS reservations (room_id TEXT NOT NULL, expires INTEGER NOT NULL)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS room_codes (id TEXT PRIMARY KEY)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, summary TEXT NOT NULL, expires INTEGER NOT NULL)");
    ctx.storage.sql.exec("INSERT OR IGNORE INTO room_codes SELECT id FROM rooms");
  }
  allocate(mode: RoomMode = "custom", region: RoomRegion = "asia"): string {
    this.ctx.storage.sql.exec("DELETE FROM rooms WHERE expires < ?", Date.now());
    if (this.ctx.storage.sql.exec<{ total: number }>("SELECT COUNT(*) AS total FROM rooms").one().total >= 1000) throw new Error("directory capacity");
    let roomId: string;
    do { roomId = crypto.randomUUID().slice(0, 6).toUpperCase(); } while (this.ctx.storage.sql.exec("SELECT id FROM room_codes WHERE id = ?", roomId).toArray().length);
    this.ctx.storage.sql.exec("INSERT INTO room_codes VALUES (?)", roomId);
    const summary: RoomSummary = { roomId, mode, region, members: 0, spectators: 0, phase: "waiting", mapId: "moss-valley", updatedAt: Date.now() };
    this.ctx.storage.sql.exec("INSERT INTO rooms VALUES (?, ?, ?)", roomId, JSON.stringify(summary), Date.now() + 120000);
    return roomId;
  }
  exists(roomId: string): boolean { return this.ctx.storage.sql.exec("SELECT id FROM rooms WHERE id = ? AND expires >= ?", roomId, Date.now()).toArray().length > 0; }
  quick(mode: Exclude<RoomMode, "custom">, region: RoomRegion): string {
    this.ctx.storage.sql.exec("DELETE FROM reservations WHERE expires < ?", Date.now());
    const capacity = mode === "1v1" ? 2 : 4;
    const candidate = this.ctx.storage.sql.exec<{ id: string }>(quickCandidateQuery, Date.now(), mode, region, capacity).toArray()[0];
    const roomId = candidate?.id ?? this.allocate(mode, region);
    this.ctx.storage.sql.exec("INSERT INTO reservations VALUES (?, ?)", roomId, Date.now() + 10000);
    return roomId;
  }
  update(summary: RoomSummary): void {
    const before = this.ctx.storage.sql.exec<{ summary: string }>("SELECT summary FROM rooms WHERE id = ?", summary.roomId).toArray()[0];
    if (before && JSON.parse(before.summary).updatedAt > summary.updatedAt) return;
    const added = Math.max(0, summary.members - (before ? JSON.parse(before.summary).members : 0));
    if (added) this.ctx.storage.sql.exec("DELETE FROM reservations WHERE rowid IN (SELECT rowid FROM reservations WHERE room_id = ? ORDER BY expires LIMIT ?)", summary.roomId, added);
    if (!summary.members && !summary.spectators) { this.ctx.storage.sql.exec("DELETE FROM rooms WHERE id = ?", summary.roomId); return; }
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO rooms VALUES (?, ?, ?)", summary.roomId, JSON.stringify(summary), Date.now() + 1800000);
  }
  page(after: string): RoomPage {
    const rows = this.ctx.storage.sql.exec<{ summary: string }>(
      "SELECT summary FROM rooms WHERE id > ? AND expires >= ? AND json_extract(summary, '$.members') > 0 AND json_extract(summary, '$.mode') = 'custom' ORDER BY id LIMIT 21", after, Date.now(),
    ).toArray().map(row => JSON.parse(row.summary) as RoomSummary);
    const rooms = rows.slice(0, 20);
    return { rooms, nextCursor: rows.length > 20 ? rooms.at(-1)!.roomId : null };
  }
  list(): readonly RoomSummary[] {
    return this.ctx.storage.sql.exec<{ summary: string }>("SELECT summary FROM rooms WHERE expires >= ? ORDER BY expires DESC LIMIT 100", Date.now()).toArray().map(row => JSON.parse(row.summary));
  }
}
