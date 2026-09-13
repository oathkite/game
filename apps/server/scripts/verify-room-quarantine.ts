import { CLIENT_BUILD } from "@game/protocol/build";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
const port = Number(process.env.EDGE_CORRUPT_PORT ?? 8804), endpoint = `http://127.0.0.1:${port}`;
const headers = { Origin: "http://127.0.0.1:5186" }, directory = await mkdtemp(join(tmpdir(), "keropod-corrupt-"));
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
  const a = await connect(roomId);
  a.send({ type: "room.create", build: CLIENT_BUILD, profile: { nickname: "Corrupt", loadout: ["cannon", "laser"] } });
  await until(() => a.last("room.welcome"));
  await until(() => a.last("room.snapshot"));
  await stop(true);
  let database = "", corrupted = "";
  for (const file of await readdir(directory, { recursive: true })) if (file.endsWith(".sqlite")) {
    const path = join(directory, file), db = new DatabaseSync(path);
    try {
      if (!db.prepare("SELECT name FROM sqlite_master WHERE name='room_state'").get()) continue;
      const row = db.prepare("SELECT snapshot FROM room_state WHERE id=1").get();
      if (!row) continue;
      const snapshot = JSON.parse(String(row.snapshot));
      if (snapshot.state.roomId !== roomId) continue;
      database = path; corrupted = JSON.stringify({ ...snapshot, version: 999 });
      db.prepare("UPDATE room_state SET snapshot=? WHERE id=1").run(corrupted);
    } finally { db.close(); }
  }
  assert.ok(database);
  await start();
  const resumed = await connect(roomId);
  await until(() => resumed.last("room.error"));
  assert.equal(resumed.last("room.error").reason, "room-unrecoverable");
  assert.equal(resumed.last("room.welcome"), undefined);
  await until(async () => {
    const page = await fetch(`${endpoint}/v2/rooms/page`, { headers }).then(r => r.json()) as { rooms: { roomId: string }[] };
    return !page.rooms.some(room => room.roomId === roomId);
  });
  await stop();
  const db = new DatabaseSync(database);
  try {
    assert.equal(db.prepare("SELECT snapshot FROM room_state WHERE id=1").get()!.snapshot, corrupted);
    assert.equal(db.prepare("SELECT outcome FROM room_failure WHERE id=1").get()!.outcome, "invalid");
  } finally { db.close(); }
  console.log("PASS: unsupported snapshot -> dedicated room error -> removed listing -> invalid record -> original snapshot unchanged");

} finally {
  for (const socket of sockets) socket.terminate();
  await stop(); await rm(directory, { recursive: true, force: true });
}
