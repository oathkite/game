import type { RoomSnapshot } from "../rooms/runtime.js";
import { UnrecoverableRoom } from "../rooms/restoreFailure.js";
type Sql = { exec<T extends Record<string, string | number | null>>(query: string, ...args: (string | number | null)[]): { toArray(): T[] } };
/** Caller commits snapshot, appended terrain and deadlines in the same transaction. */
export class RoomSqlSnapshot {
  constructor(private readonly sql: Sql) {
    sql.exec("CREATE TABLE IF NOT EXISTS room_terrain_meta (id INTEGER PRIMARY KEY CHECK(id=1), match_id TEXT NOT NULL, op_count INTEGER NOT NULL)");
    sql.exec("CREATE TABLE IF NOT EXISTS room_terrain_ops (seq INTEGER PRIMARY KEY, op TEXT NOT NULL)");
  }
  write(snapshot: RoomSnapshot): void {
    const battle = snapshot.state.battle;
    if (!battle) {
      this.sql.exec("DELETE FROM room_terrain_meta"); this.sql.exec("DELETE FROM room_terrain_ops");
      this.save(snapshot); return;
    }
    const { terrainOps, ...state } = battle.state;
    const before = this.sql.exec<{ match_id: string; op_count: number }>("SELECT match_id, op_count FROM room_terrain_meta WHERE id=1").toArray()[0];
    const same = before?.match_id === state.matchId;
    const count = same ? before.op_count : 0;
    if (count > terrainOps.length) throw new Error("terrain history shrank");
    if (!same) this.sql.exec("DELETE FROM room_terrain_ops");
    for (let i = count; i < terrainOps.length; i++) this.sql.exec("INSERT INTO room_terrain_ops VALUES (?, ?)", i, JSON.stringify(terrainOps[i]));
    if (!same || count !== terrainOps.length) this.sql.exec("INSERT OR REPLACE INTO room_terrain_meta VALUES (1, ?, ?)", state.matchId, terrainOps.length);
    this.save({ version: 2, state: { ...snapshot.state, battle: { ...battle, state } }, terrainCount: terrainOps.length });
  }
  private save(value: unknown): void {
    this.sql.exec("INSERT OR REPLACE INTO room_state VALUES (1, ?)", JSON.stringify(value));
  }
  read(raw: string): string {
    let saved;
    try { saved = JSON.parse(raw); } catch { throw new UnrecoverableRoom(); }
    if (saved?.version !== 2) return raw;
    const count = saved.terrainCount, matchId = saved.state?.battle?.state?.matchId;
    if (!Number.isSafeInteger(count) || count < 0 || typeof matchId !== "string") throw new UnrecoverableRoom();
    const meta = this.sql.exec<{ match_id: string; op_count: number }>("SELECT match_id, op_count FROM room_terrain_meta WHERE id=1").toArray()[0];
    const rows = this.sql.exec<{ seq: number; op: string }>("SELECT seq, op FROM room_terrain_ops ORDER BY seq").toArray();
    if (meta?.match_id !== matchId || meta.op_count !== count || rows.length !== count || rows.some((row, i) => row.seq !== i)) throw new UnrecoverableRoom();
    try {
      const terrainOps = rows.map(row => JSON.parse(row.op));
      if (terrainOps.some(op => !op || ![op.cx, op.cy, op.radius].every(Number.isSafeInteger) || op.radius < 0)) throw new UnrecoverableRoom();
      return JSON.stringify({ version: 1, state: { ...saved.state, battle: { ...saved.state.battle, state: { ...saved.state.battle.state, terrainOps } } } });
    } catch { throw new UnrecoverableRoom(); }
  }
}
