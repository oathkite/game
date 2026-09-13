import { CLIENT_BUILD } from "@game/protocol/build";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
const port = Number(process.env.EDGE_OUTBOX_PORT ?? 8796), endpoint = `http://127.0.0.1:${port}`;
const headers = { Origin: "http://127.0.0.1:5186" }, directory = await mkdtemp(join(tmpdir(), "keropod-outbox-restart-"));
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
const start = async (fail: boolean) => {
  logs = "";
  child = spawn("pnpm", ["exec", "wrangler", "dev", "--config", join(directory, "wrangler.json"), "--var", `OUTBOX_TEST_FAIL:${fail}`, "--port", String(port), "--local", "--persist-to", directory], { detached: true, stdio: ["ignore", "pipe", "pipe"] });
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
  const source = resolve("src/cf/v2.ts");
  await writeFile(join(directory, "worker.ts"), `
    import worker, { RoomObject, RoomDirectory as BaseDirectory } from ${JSON.stringify(source)};
    export { RoomObject };
    export class RoomDirectory extends BaseDirectory {
      constructor(ctx, env) { super(ctx, env); this.fail = env.OUTBOX_TEST_FAIL === "true"; }
      update(summary) { if (this.fail) throw new Error("injected directory outage"); return super.update(summary); }
    }
    export default worker;
  `);
  const config = JSON.parse(await readFile("wrangler.v2.jsonc", "utf8"));
  await writeFile(join(directory, "wrangler.json"), JSON.stringify({ ...config, name: "keropod-outbox-test", main: "worker.ts" }));
  await start(true);
  const { roomId } = await fetch(`${endpoint}/v2/rooms`, { method: "POST", headers }).then(r => r.json()) as { roomId: string };
  const a = await connect(roomId);
  a.send({ type: "room.create", build: CLIENT_BUILD, profile: { nickname: "Outbox", loadout: ["cannon", "laser"] } });
  await until(() => a.last("room.welcome"));
  await until(() => logs.includes("injected directory outage"));
  const listed = async () => {
    const page = await fetch(`${endpoint}/v2/rooms/page`, { headers }).then(r => r.json()) as { rooms: { roomId: string; members: number }[] };
    return page.rooms.find(room => room.roomId === roomId);
  };
  assert.equal(await listed(), undefined);
  const token = a.last("room.welcome").token;
  await stop(true);
  await start(false);
  // No room request after restart: only the persisted alarm may deliver the summary.
  await until(async () => (await listed())?.members === 1);
  const resumed = await connect(roomId);
  resumed.send({ type: "room.resume", build: CLIENT_BUILD, token });
  await until(() => resumed.last("room.welcome"));
  assert.equal(resumed.last("room.welcome").generation, 2);
  console.log("PASS: injected Directory failure -> absent listing -> SIGKILL -> persisted alarm delivers without room traffic -> generation 2 resume");

} finally {
  for (const socket of sockets) socket.terminate();
  await stop(); await rm(directory, { recursive: true, force: true });
}
