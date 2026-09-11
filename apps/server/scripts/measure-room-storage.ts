import { DatabaseSync } from "node:sqlite";
import { RoomSqlSnapshot } from "../src/cf/roomSqlSnapshot.js";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { MULTIPLAYER_MAPS, columnsOfMask, encodeColumns } from "@game/maps";
import { CLIENT_BUILD } from "@game/protocol/build";
import { WEAPON_IDS, type Loadout } from "@game/protocol";
import { createBattle, createBattleSession, fireInSession, tickSession, serializeBattle, restoreBattle, type BattleSession } from "@game/engine/multiplayer";
import { createRoomState, reduceRoom } from "../src/rooms/core.js";
import { serializeRoom, restoreRoom } from "../src/rooms/runtime.js";
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const results = [];
for (const map of MULTIPLAYER_MAPS) {
  const members = Array.from({ length: 8 }, (_, i) => ({ playerId: `p${i}`, teamId: `t${i % 3}` }));
  const loadouts = Object.fromEntries(members.map((member, i) => [member.playerId, [WEAPON_IDS[i]!, WEAPON_IDS[(i + 1) % 8]!] as Loadout]));
  let room = createRoomState("ABCDEF");
  for (const [i, member] of members.entries()) {
    const result = reduceRoom(room, `socket-${i}`, { type: i ? "room.join" : "room.create", ...(i ? { roomId: "ABCDEF" } : {}),
      build: CLIENT_BUILD, profile: { nickname: `Pilot ${i}`, loadout: loadouts[member.playerId] } }, 0,
      { playerId: member.playerId, token: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, matchId: "storage-measurement", seed: 123 });
    assert.equal(result.reason, "accepted"); room = result.state;
  }
  room = { ...room, lobby: { ...room.lobby!, phase: "started", map } };
  let live = createBattleSession(createBattle(members, 123, map), "storage-measurement", 0, loadouts, 123);
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE room_state(id INTEGER PRIMARY KEY, snapshot TEXT)");
  let terrainInserts = 0;
  const sql = { exec: <T extends Record<string, string | number | null>>(query: string, ...args: (string | number | null)[]) => {
    if (query.startsWith("INSERT INTO room_terrain_ops")) terrainInserts++;
    const result = db.prepare(query).all(...args) as T[]; return { toArray: () => result };
  } };
  const store = new RoomSqlSnapshot(sql);
  let maxActingStoredBytes = 0, maxReplayStoredBytes = 0;
  let shots = 0, maxReplayBytes = 0, maxActingBytes = 0, maxOps = 0;
  const measure = (state: BattleSession) => {
    const snapshot = serializeRoom({ ...room, battle: state }), size = bytes(snapshot);
    store.write(snapshot);
    const raw = String(db.prepare("SELECT snapshot FROM room_state").get()!.snapshot);
    const restored = restoreRoom(JSON.parse(store.read(raw)));
    assert.deepEqual(serializeRoom(restored), snapshot);
    assert.deepEqual(restored.battle!.mask.cells, state.mask.cells);
    const inserts = terrainInserts;
    store.write(snapshot); assert.equal(terrainInserts, inserts);
    if (state.phase === "acting") maxActingStoredBytes = Math.max(maxActingStoredBytes, Buffer.byteLength(raw));
    else maxReplayStoredBytes = Math.max(maxReplayStoredBytes, Buffer.byteLength(raw));
    if (state.phase === "acting") maxActingBytes = Math.max(maxActingBytes, size);
    else maxReplayBytes = Math.max(maxReplayBytes, size);
    maxOps = Math.max(maxOps, state.terrainOps.length);
  };
  measure(live);
  while (live.phase !== "finished" && shots < 96) {
    const command = { version: 2, type: "turn.fire", matchId: live.matchId, turnId: live.roster.turnId,
      commandId: `shot-${shots}`, ackMoveSeq: live.movement.ackMoveSeq, slot: shots % 2,
      facing: live.movement.x < map.width / 2 ? 1 : -1, elevation: 25 + shots % 6 * 10, power: 15 + shots % 5 * 17 };
    const reply = fireInSession(live, live.movement.playerId, command, live.movement.startsAt + 300);
    assert.equal(reply.reason, "accepted");
    live = reply.state; measure(live);
    live = tickSession(live, live.replay!.endsAt); measure(live); shots++;
  }
  assert.equal(live.phase, "finished");
  const snapshot = JSON.stringify(serializeBattle(live)), times: number[] = [], sqlTimes: number[] = [];
  const persisted = String(db.prepare("SELECT snapshot FROM room_state").get()!.snapshot);
  const checkpoint = JSON.parse(String(db.prepare("SELECT checkpoint FROM room_terrain_checkpoint").get()!.checkpoint));
  for (let i = 0; i < 110; i++) {
    const start = performance.now(), restored = restoreBattle(JSON.parse(snapshot));
    const elapsed = performance.now() - start;
    assert.deepEqual(restored.mask.cells, live.mask.cells);
    const sqlStart = performance.now(), fromSql = restoreRoom(JSON.parse(store.read(persisted)));
    const sqlElapsed = performance.now() - sqlStart;
    assert.deepEqual(fromSql.battle!.mask.cells, live.mask.cells);
    if (i >= 10) { times.push(elapsed); sqlTimes.push(sqlElapsed); }
  }
  times.sort((a, b) => a - b); sqlTimes.sort((a, b) => a - b);
  results.push({ map: map.id, shots, maxOps, maxActingBytes, maxReplayBytes, maxActingStoredBytes, maxReplayStoredBytes, terrainInserts,
    finalTerrainOpsBytes: bytes(live.terrainOps), finalMapBytes: bytes(live.map),
    columnCheckpointBytes: Buffer.byteLength(encodeColumns(columnsOfMask(live.mask))), rawMaskBytes: live.mask.cells.byteLength,
    restoreP95Milliseconds: times[Math.ceil(times.length * .95) - 1],
    sqlCheckpointRestoreP95Milliseconds: sqlTimes[Math.ceil(sqlTimes.length * .95) - 1], checkpointOps: checkpoint.opCount, tailOps: live.terrainOps.length - checkpoint.opCount, samples: times.length });
  db.close();
}
const report = { runtime: process.version, scope: "Local Node; deterministic mixed-weapon eight-player fixtures, not maximum-damage or Cloudflare CPU/storage billing", results };
const output = process.argv[2];
if (output) await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
