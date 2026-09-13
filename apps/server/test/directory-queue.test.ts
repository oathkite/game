import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { quickCandidateQuery } from "../src/cf/directoryQueries.js";

it("finds an older matching seat beyond 100 newer rooms, respecting reservations", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE rooms(id TEXT PRIMARY KEY, summary TEXT, expires INTEGER); CREATE TABLE reservations(room_id TEXT, expires INTEGER)");
    const add = (id: string, expires: number, mode = "1v1", region = "asia", members = 0, phase = "waiting") =>
      db.prepare("INSERT INTO rooms VALUES (?, ?, ?)").run(id, JSON.stringify({ mode, region, members, phase }), expires);
    add("older-seat", 200, "2v2", "europe", 2);
    for (let i = 0; i < 101; i++) add(`new-${i}`, 300 + i);
    add("full", 110, "2v2", "europe", 4);
    add("expired", 99, "2v2", "europe");
    add("started", 105, "2v2", "europe", 2, "started");
    const find = () => db.prepare(quickCandidateQuery).get(100, "2v2", "europe", 4)?.id;
    expect(find()).toBe("older-seat");
    db.prepare("INSERT INTO reservations VALUES (?, ?)").run("older-seat", 500);
    expect(find()).toBe("older-seat");
    db.prepare("INSERT INTO reservations VALUES (?, ?)").run("older-seat", 500);
    expect(find()).toBeUndefined();
  } finally { db.close(); }
});
