import { CLIENT_BUILD } from "@game/protocol/build";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { RoomSqlSnapshot } from "../src/cf/roomSqlSnapshot.js";
import { restoreRoom } from "../src/rooms/runtime.js";
import { fireInSession, tickSession, type BattleSession } from "@game/engine/multiplayer";
import { applyOps, maskFromHeights } from "@game/sim";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
const port = Number(process.env.EDGE_CHECKPOINT_PORT ?? 8805), endpoint = `http://127.0.0.1:${port}`;
const headers = { Origin: "http://127.0.0.1:5186" }, directory = await mkdtemp(join(tmpdir(), "keropod-checkpoint-restart-"));
const sockets: WebSocket[] = [];
let child: ChildProcess | null = null, logs = "";
const until = async (ready: () => unknown | Promise<unknown>, timeout = 20000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await ready()) return; await new Promise(r => setTimeout(r, 50)); }
  throw new Error(`Timed out. ${logs.slice(-4000)}`);
};
const stop = async (crash = false) => {
  const processToStop = child; child = null;
  if (!processToStop || processToStop.exitCode !== null) return;
  const done = new Promise<void>(r => processToStop.once("close", () => r()));
  process.kill(-processToStop.pid!, crash ? "SIGKILL" : "SIGTERM"); await done;
};
const start = async () => {
  child = spawn("pnpm", ["exec", "wrangler", "dev", "--config", "wrangler.v2.jsonc", "--port", String(port), "--local", "--persist-to", directory], { detached: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout!.on("data", data => { logs = (logs + data).slice(-10000); });
  child.stderr!.on("data", data => { logs = (logs + data).slice(-10000); });
  await until(async () => { try { return (await fetch(`${endpoint}/health`)).ok; } catch { return false; } });
};
const connect = async (roomId: string) => {
  const ws = new WebSocket(`${endpoint.replace("http", "ws")}/v2/rooms/${roomId}`, { headers }), messages: any[] = [];
  sockets.push(ws); ws.on("message", data => messages.push(JSON.parse(String(data))));
  await new Promise<void>((r, reject) => { ws.once("open", r); ws.once("error", reject); });
  return { ws, send: (value: unknown) => ws.send(JSON.stringify(value)), last: (type: string) => messages.filter(m => m.type === type).at(-1) };
};
try {
  const occupied = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(1000) }).catch(() => null);
  assert.equal(occupied, null, `Port ${port} is already in use`);
  await start();
  const { roomId } = await fetch(`${endpoint}/v2/rooms`, { method: "POST", headers }).then(r => r.json()) as { roomId: string };
  const a = await connect(roomId), b = await connect(roomId), profile = { nickname: "Restart", loadout: ["multiple", "laser"] };
  a.send({ type: "room.create", build: CLIENT_BUILD, profile }); await until(() => a.last("room.welcome"));
  b.send({ type: "room.join", build: CLIENT_BUILD, roomId, profile }); await until(() => a.last("room.snapshot").room.members.length === 2);
  const edit = (client: typeof a, type: string, extra: object) => client.send({ type, version: 2, roomId, revision: a.last("room.snapshot").room.revision, ...extra });
  edit(a, "room.assignTeam", { playerId: a.last("room.welcome").playerId, teamId: "t0" }); await until(() => a.last("room.snapshot").room.members[0].teamId === "t0");
  edit(b, "room.assignTeam", { playerId: b.last("room.welcome").playerId, teamId: "t1" }); await until(() => a.last("room.snapshot").room.members[1].teamId === "t1");
  edit(a, "room.ready", { ready: true }); edit(b, "room.ready", { ready: true }); await until(() => a.last("room.snapshot").room.members.every((p: any) => p.ready));
  edit(a, "room.start", {}); await until(() => a.last("lab.frame"));
  let frame = a.last("lab.frame"), actor = a, fire: any, committed: any;
  for (let shot = 0; shot < 12; shot++) {
    await until(() => a.last("lab.frame")?.phase === "acting");
    frame = a.last("lab.frame");
    actor = frame.actorId === a.last("room.welcome").playerId ? a : b;
    const player = frame.players.find((p: any) => p.playerId === frame.actorId);
    fire = { type: "turn.fire", version: 2, matchId: frame.matchId, turnId: frame.turnId,
      commandId: `checkpoint-shot-${shot}`, ackMoveSeq: frame.movement.ackMoveSeq, slot: 0,
      facing: player.x < frame.map.width / 2 ? 1 : -1, elevation: 45, power: 25 };
    actor.send(fire);
    await until(() => actor.last("lab.frame")?.phase === "replaying" && actor.last("lab.frame")?.turnId === frame.turnId);
    committed = actor.last("lab.frame");
    if (committed.terrainOps.length >= 40) break;
    await until(() => a.last("lab.frame")?.turnId > frame.turnId);
  }
  assert.ok(committed.terrainOps.length >= 40, "normal shots must create checkpoint plus tail");
  const welcome = actor.last("room.welcome");
  await stop(true);
  let checkpointOps = 0, tailOps = 0, storedBattle: BattleSession | null = null;
  for (const file of await readdir(directory, { recursive: true })) if (file.endsWith(".sqlite")) {
    const db = new DatabaseSync(join(directory, file));
    try {
      if (!db.prepare("SELECT name FROM sqlite_master WHERE name='room_state'").get()) continue;
      const row = db.prepare("SELECT snapshot FROM room_state WHERE id=1").get();
      if (!row || JSON.parse(String(row.snapshot)).state.roomId !== roomId) continue;
      const cp = JSON.parse(String(db.prepare("SELECT checkpoint FROM room_terrain_checkpoint WHERE id=1").get()!.checkpoint));
      checkpointOps = cp.opCount; tailOps = committed.terrainOps.length - checkpointOps;
      const sql = { exec: <T extends Record<string, string | number | null>>(query: string, ...args: (string | number | null)[]) => {
        const result = db.prepare(query).all(...args) as T[]; return { toArray: () => result };
      } };
      const stored = restoreRoom(JSON.parse(new RoomSqlSnapshot(sql).read(String(row.snapshot))));
      storedBattle = stored.battle;
      assert.deepEqual(stored.battle!.mask, applyOps(maskFromHeights(committed.map.surface, committed.map.height), committed.terrainOps));
    } finally { db.close(); }
  }
  assert.ok(checkpointOps >= 32); assert.ok(tailOps > 0 && tailOps < 32);
  await start();
  const resumed = await connect(roomId); resumed.send({ type: "room.resume", build: CLIENT_BUILD, token: welcome.token });
  await until(() => resumed.last("room.welcome"));
  assert.equal(resumed.last("room.welcome").generation, 2);
  assert.equal(resumed.last("lab.frame").matchId, frame.matchId);
  assert.deepEqual(resumed.last("lab.frame").terrainOps, committed.terrainOps);
  resumed.send(fire); await until(() => resumed.last("lab.ack"));
  assert.equal(resumed.last("lab.ack").reason, "duplicate");
  assert.deepEqual(resumed.last("lab.frame").terrainOps, committed.terrainOps);
  const otherWelcome = (actor === a ? b : a).last("room.welcome");
  const other = await connect(roomId); other.send({ type: "room.resume", build: CLIENT_BUILD, token: otherWelcome.token });
  await until(() => other.last("room.welcome"));
  await until(() => resumed.last("lab.frame")?.phase === "acting" && resumed.last("lab.frame")?.turnId > fire.turnId);
  const next = resumed.last("lab.frame");
  const nextActor = next.actorId === welcome.playerId ? resumed : other;
  const player = next.players.find((p: any) => p.playerId === next.actorId);
  const nextFire = { ...fire, commandId: "after-checkpoint-restart", turnId: next.turnId,
    ackMoveSeq: next.movement.ackMoveSeq, facing: player.x < next.map.width / 2 ? 1 : -1 };
  const expected = tickSession(storedBattle!, storedBattle!.replay!.endsAt);
  assert.equal(expected.roster.turnId, next.turnId);
  const shot = fireInSession(expected, next.actorId, nextFire, expected.movement.startsAt + 1);
  assert.equal(shot.reason, "accepted");
  nextActor.send(nextFire);
  await until(() => nextActor.last("lab.frame")?.phase === "replaying" && nextActor.last("lab.frame")?.turnId === next.turnId);
  assert.deepEqual(nextActor.last("lab.frame").terrainOps, shot.state.terrainOps);
  console.log(`PASS: normal multiple shots -> checkpoint ${checkpointOps} + tail ${tailOps} -> SIGKILL -> identical terrain -> generation 2 -> duplicate rejected -> next shot matches simulation`);
} finally {
  for (const socket of sockets) socket.terminate();
  await stop(); await rm(directory, { recursive: true, force: true });
}
