import { DurableObject } from "cloudflare:workers";
export type RoomSummary = { readonly roomId: string; readonly members: number; readonly phase: "waiting" | "started"; readonly mapId: string; readonly updatedAt: number };
export class RoomDirectory extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS room_codes (id TEXT PRIMARY KEY)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, summary TEXT NOT NULL, expires INTEGER NOT NULL)");
    ctx.storage.sql.exec("INSERT OR IGNORE INTO room_codes SELECT id FROM rooms");
  }
  allocate(): string {
    this.ctx.storage.sql.exec("DELETE FROM rooms WHERE expires < ?", Date.now());
    if (this.ctx.storage.sql.exec<{ total: number }>("SELECT COUNT(*) AS total FROM rooms").one().total >= 1000) throw new Error("directory capacity");
    let roomId: string;
    do { roomId = crypto.randomUUID().slice(0, 6).toUpperCase(); } while (this.ctx.storage.sql.exec("SELECT id FROM room_codes WHERE id = ?", roomId).toArray().length);
    this.ctx.storage.sql.exec("INSERT INTO room_codes VALUES (?)", roomId);
    const summary: RoomSummary = { roomId, members: 0, phase: "waiting", mapId: "moss-valley", updatedAt: Date.now() };
    this.ctx.storage.sql.exec("INSERT INTO rooms VALUES (?, ?, ?)", roomId, JSON.stringify(summary), Date.now() + 120000);
    return roomId;
  }
  exists(roomId: string): boolean { return this.ctx.storage.sql.exec("SELECT id FROM rooms WHERE id = ? AND expires >= ?", roomId, Date.now()).toArray().length > 0; }
  update(summary: RoomSummary): void {
    if (!summary.members) { this.ctx.storage.sql.exec("DELETE FROM rooms WHERE id = ?", summary.roomId); return; }
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO rooms VALUES (?, ?, ?)", summary.roomId, JSON.stringify(summary), Date.now() + 1800000);
  }
  list(): readonly RoomSummary[] {
    return this.ctx.storage.sql.exec<{ summary: string }>("SELECT summary FROM rooms WHERE expires >= ? ORDER BY expires DESC LIMIT 100", Date.now()).toArray().map(row => JSON.parse(row.summary));
  }
}
