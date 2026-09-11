import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { TEST_ARENA } from "@game/maps";
import { createBattle, createBattleSession } from "@game/engine/multiplayer";
import { RoomSqlSnapshot } from "../src/cf/roomSqlSnapshot.js";
import { createRoomState } from "../src/rooms/core.js";
import { serializeRoom } from "../src/rooms/runtime.js";
it("appends terrain once, restores old/new formats, rolls back atomically and resets on rematch", () => {
  const db = new DatabaseSync(":memory:"), writes: string[] = [];
  const sql = { exec: <T extends Record<string, string | number | null>>(query: string, ...args: (string | number | null)[]) => {
    if (/^(INSERT|UPDATE|DELETE)/.test(query)) writes.push(query);
    const result = db.prepare(query).all(...args) as T[]; return { toArray: () => result };
  } };
  try {
    db.exec("CREATE TABLE room_state(id INTEGER PRIMARY KEY, snapshot TEXT)");
    const store = new RoomSqlSnapshot(sql);
    const battle = createBattleSession(createBattle([{ playerId: "a", teamId: "t0" }, { playerId: "b", teamId: "t1" }], 42, TEST_ARENA), "match", 0);
    let snapshot = serializeRoom({ ...createRoomState("ABCDEF"), battle: { ...battle, terrainOps: [{ cx: 10, cy: 20, radius: 5 }] } });
    const read = () => String(db.prepare("SELECT snapshot FROM room_state").get()!.snapshot);
    expect(store.read(JSON.stringify(snapshot))).toBe(JSON.stringify(snapshot));
    store.write(snapshot); expect(JSON.parse(store.read(read()))).toEqual(snapshot);
    writes.length = 0;
    snapshot = { ...snapshot, state: { ...snapshot.state, battle: { ...snapshot.state.battle!, state: { ...snapshot.state.battle!.state,
      movement: { ...snapshot.state.battle!.state.movement, x: snapshot.state.battle!.state.movement.x + 1, ackMoveSeq: 1 },
    } } } };
    store.write(snapshot);
    expect(JSON.parse(store.read(read()))).toEqual(snapshot);
    expect(writes).toHaveLength(1); expect(writes[0]).toContain("room_state");
    const original = read();
    db.exec("BEGIN");
    store.write({ ...snapshot, state: { ...snapshot.state, battle: { ...snapshot.state.battle!, state: { ...snapshot.state.battle!.state, terrainOps: [...snapshot.state.battle!.state.terrainOps, { cx: 30, cy: 40, radius: 5 }] } } } });
    db.exec("ROLLBACK");
    expect(read()).toBe(original); expect(JSON.parse(store.read(read()))).toEqual(snapshot);
    db.prepare("DELETE FROM room_terrain_ops WHERE seq=0").run();
    expect(() => store.read(read())).toThrow("room-unrecoverable");
    const rematch = { ...snapshot, state: { ...snapshot.state, battle: { ...snapshot.state.battle!, state: { ...snapshot.state.battle!.state, matchId: "next", terrainOps: [] } } } };
    store.write(rematch); expect(JSON.parse(store.read(read()))).toEqual(rematch);
  } finally { db.close(); }
});
