import { CLIENT_BUILD } from "@game/protocol/build";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
const port = Number(process.env.EDGE_RESTART_PORT ?? 8797), endpoint = `http://127.0.0.1:${port}`;
const headers = { Origin: "http://127.0.0.1:5186" }, directory = await mkdtemp(join(tmpdir(), "keropod-edge-restart-"));
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
  const a = await connect(roomId), b = await connect(roomId), profile = { nickname: "Restart", loadout: ["cannon", "laser"] };
  a.send({ type: "room.create", build: CLIENT_BUILD, profile }); await until(() => a.last("room.welcome"));
  b.send({ type: "room.join", build: CLIENT_BUILD, roomId, profile }); await until(() => a.last("room.snapshot").room.members.length === 2);
  const edit = (client: typeof a, type: string, extra: object) => client.send({ type, version: 2, roomId, revision: a.last("room.snapshot").room.revision, ...extra });
  edit(a, "room.assignTeam", { playerId: a.last("room.welcome").playerId, teamId: "t0" }); await until(() => a.last("room.snapshot").room.members[0].teamId === "t0");
  edit(b, "room.assignTeam", { playerId: b.last("room.welcome").playerId, teamId: "t1" }); await until(() => a.last("room.snapshot").room.members[1].teamId === "t1");
  edit(a, "room.ready", { ready: true }); edit(b, "room.ready", { ready: true }); await until(() => a.last("room.snapshot").room.members.every((p: any) => p.ready));
  edit(a, "room.start", {}); await until(() => a.last("lab.frame"));
  const frame = a.last("lab.frame"), actor = frame.actorId === a.last("room.welcome").playerId ? a : b;
  const welcome = actor.last("room.welcome");
  const fire = { type: "turn.fire", version: 2, matchId: frame.matchId, turnId: 1, commandId: "crash-shot", ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power: 20 };
  actor.send(fire); await until(() => actor.last("lab.ack")?.reason === "accepted");
  await until(() => actor.last("lab.frame")?.phase === "replaying");
  const committed = actor.last("lab.frame");
  await stop(true); await start();
  const resumed = await connect(roomId); resumed.send({ type: "room.resume", build: CLIENT_BUILD, token: welcome.token });
  await until(() => resumed.last("room.welcome"));
  assert.equal(resumed.last("room.welcome").generation, 2);
  assert.equal(resumed.last("lab.frame").matchId, frame.matchId);
  assert.deepEqual(resumed.last("lab.frame").terrainOps, committed.terrainOps);
  resumed.send(fire); await until(() => resumed.last("lab.ack"));
  assert.equal(resumed.last("lab.ack").reason, "duplicate");
  assert.deepEqual(resumed.last("lab.frame").terrainOps, committed.terrainOps);
  console.log("PASS: SIGKILL -> SQLite restore -> same match/terrain -> generation 2 -> duplicate shot rejected");
} finally {
  for (const socket of sockets) socket.terminate();
  await stop(); await rm(directory, { recursive: true, force: true });
}
