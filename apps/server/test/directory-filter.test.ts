import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { roomPageQuery } from "../src/cf/directoryQueries.js";
import { roomListFilterSchema } from "@game/protocol/v2-rooms";
it("filters before pagination and retains code order regardless of update time", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE rooms(id TEXT PRIMARY KEY, summary TEXT, expires INTEGER)");
    for (let i = 1; i <= 65; i++) db.prepare("INSERT INTO rooms VALUES (?, ?, ?)").run(i.toString(16).toUpperCase().padStart(6, "0"), JSON.stringify({ mode: "custom", members: i === 64 ? 8 : 1, phase: i === 63 ? "started" : "waiting", mapId: i > 30 ? "target" : "other", updatedAt: 1000 - i }), 200);
    const query = (after = "", extra = {}) => { const q = roomPageQuery(after, 100, { map: "target", ...extra }); return db.prepare(q.sql).all(...q.bindings); };
    expect(query()).toHaveLength(21);
    expect(query()[0]?.id).toBe("00001F");
    expect(query("0:000032")).toHaveLength(15);
    expect(query("", { code: "000040", vacancy: "available" })).toHaveLength(0);
    expect(query("", { code: "00003F", phase: "started" })).toHaveLength(1);
    expect(query("", { map: "' OR 1=1 --" })).toHaveLength(0);
  } finally { db.close(); }
});
it("rejects invalid filter values", () => {
  expect(roomListFilterSchema.safeParse({ code: "%" }).success).toBe(false);
  expect(roomListFilterSchema.safeParse({ phase: "unknown" }).success).toBe(false);
  expect(roomListFilterSchema.safeParse({ vacancy: "false" }).success).toBe(false);
});

it("orders newest creation first with a stable code tie-breaker", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE rooms(id TEXT PRIMARY KEY, summary TEXT, expires INTEGER)");
    for (const [id, createdAt, updatedAt] of [["AAAAAA", 10, 999], ["BBBBBB", 20, 21], ["CCCCCC", 20, 22]] as const)
      db.prepare("INSERT INTO rooms VALUES (?, ?, ?)").run(id, JSON.stringify({ mode: "custom", members: 1, createdAt, updatedAt }), 200);
    const run = (after: string) => { const q = roomPageQuery(after, 100, {}); return db.prepare(q.sql).all(...q.bindings).map(row => row.id); };
    expect(run("")).toEqual(["BBBBBB", "CCCCCC", "AAAAAA"]);
    expect(run("20:BBBBBB")).toEqual(["CCCCCC", "AAAAAA"]);
  } finally { db.close(); }
});
