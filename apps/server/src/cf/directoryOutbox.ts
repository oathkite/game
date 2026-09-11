import type { RoomSummary } from "@game/protocol/v2-rooms";

type Sql = { exec<T extends Record<string, string | number | null>>(query: string, ...bindings: (string | number | null)[]): { toArray(): T[] } };
type Entry = { summary: string; next_at: number; pending: number };
/** One durable latest-value slot; newer summaries replace obsolete pending work. */
export class DirectoryOutbox {
  private sending = false;
  constructor(private readonly sql: Sql) {
    sql.exec("CREATE TABLE IF NOT EXISTS directory_outbox (id INTEGER PRIMARY KEY CHECK(id = 1), summary TEXT NOT NULL, next_at INTEGER NOT NULL, pending INTEGER NOT NULL)");
  }
  private read(): Entry | undefined { return this.sql.exec<Entry>("SELECT summary, next_at, pending FROM directory_outbox WHERE id = 1").toArray()[0]; }
  deadline(now: number): number | null {
    const entry = this.read();
    return entry?.pending ? Math.max(entry.next_at, this.sending ? now + 5000 : 0) : null;
  }
  withdraw(now: number): void {
    const entry = this.read();
    if (!entry) return;
    const { updatedAt: _updatedAt, ...summary } = JSON.parse(entry.summary) as RoomSummary;
    this.enqueue({ ...summary, members: 0, spectators: 0 }, now);
  }
  enqueue(summary: Omit<RoomSummary, "updatedAt">, now: number): void {
    const entry = this.read(), previous = entry && JSON.parse(entry.summary) as RoomSummary;
    if (previous) {
      const { updatedAt, ...old } = previous;
      if (JSON.stringify(old) === JSON.stringify(summary) && now - updatedAt < 240000) return;
    }
    const value = { ...summary, updatedAt: Math.max(now, (previous?.updatedAt ?? 0) + 1) };
    this.sql.exec("INSERT OR REPLACE INTO directory_outbox VALUES (1, ?, ?, 1)", JSON.stringify(value), now);
  }
  async flush(now: number, persistAlarm: () => Promise<void>, send: (summary: RoomSummary) => Promise<void>): Promise<void> {
    const entry = this.read();
    if (this.sending || !entry?.pending || entry.next_at > now) return;
    this.sending = true;
    try {
      this.sql.exec("UPDATE directory_outbox SET next_at = ? WHERE id = 1", now + 5000);
      // Commit the retry alarm before external I/O, including an interrupted request.
      await persistAlarm();
      await send(JSON.parse(entry.summary));
      this.sql.exec("UPDATE directory_outbox SET pending = 0 WHERE id = 1 AND summary = ?", entry.summary);
    } finally { this.sending = false; }
  }
}
