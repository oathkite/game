type Sql = { exec<T extends Record<string, string | number | null>>(query: string, ...args: (string | number | null)[]): { toArray(): T[] } };
export class RoomInvites {
  constructor(private readonly sql: Sql) {
    sql.exec("CREATE TABLE IF NOT EXISTS room_invite (id INTEGER PRIMARY KEY CHECK(id=1), token TEXT NOT NULL, expires_at INTEGER NOT NULL)");
  }
  issue(now: number): { token: string; expiresAt: number } {
    const current = this.sql.exec<{ token: string; expires_at: number }>("SELECT token, expires_at FROM room_invite WHERE id=1").toArray()[0];
    if (current && current.expires_at > now) return { token: current.token, expiresAt: current.expires_at };
    const token = crypto.randomUUID(), expiresAt = now + 86400000;
    this.sql.exec("INSERT OR REPLACE INTO room_invite VALUES (1, ?, ?)", token, expiresAt);
    return { token, expiresAt };
  }
  valid(token: unknown, now: number): boolean {
    return typeof token === "string" && token.length === 36 && this.sql.exec("SELECT id FROM room_invite WHERE id=1 AND token=? AND expires_at>?", token, now).toArray().length > 0;
  }
}
