import { expect, it } from "vitest";
import { WebSocket } from "ws";
const endpoint = process.env.EDGE_TEST_URL;
it.skipIf(!endpoint)("reserves concurrent quick seats by mode and region and starts four ready players", async () => {
  const headers = { Origin: "http://127.0.0.1:5186", "Content-Type": "application/json" }, sockets: WebSocket[] = [];
  const allocate = async (mode = "2v2", region = "europe") => fetch(`${endpoint}/v2/quick`, { method: "POST", headers, body: JSON.stringify({ mode, region }) }).then(r => r.json()) as Promise<{ roomId: string }>;
  const allocations = await Promise.all(Array.from({ length: 4 }, () => allocate()));
  const roomId = allocations[0]!.roomId;
  expect(new Set(allocations.map(a => a.roomId)).size).toBe(1);
  expect((await allocate()).roomId).not.toBe(roomId);
  expect((await allocate("1v1")).roomId).not.toBe(roomId);
  expect((await allocate("2v2", "americas")).roomId).not.toBe(roomId);
  try {
    const clients = await Promise.all(allocations.map(async () => {
      const ws = new WebSocket(`${endpoint!.replace("http", "ws")}/v2/rooms/${roomId}`, { headers }), messages: any[] = [];
      sockets.push(ws); ws.on("message", data => messages.push(JSON.parse(String(data))));
      await new Promise<void>((r, reject) => { ws.once("open", r); ws.once("error", reject); });
      ws.send(JSON.stringify({ type: "room.quick", roomId, mode: "2v2", region: "europe", profile: { nickname: "Quick", loadout: ["cannon", "laser"] } }));
      return { ws, last: (type: string) => messages.filter(m => m.type === type).at(-1) };
    }));
    await expect.poll(() => clients.every(c => c.last("room.snapshot")?.room.members.length === 4)).toBe(true);
    expect(clients[0]!.last("room.snapshot").room.mode).toBe("2v2");
    const revision = clients[0]!.last("room.snapshot").room.revision;
    for (const c of clients) c.ws.send(JSON.stringify({ type: "room.ready", version: 2, roomId, revision, ready: true }));
    await expect.poll(() => clients.every(c => c.last("lab.frame")?.phase === "acting")).toBe(true);
    const players = clients[0]!.last("lab.frame").players;
    expect(players.filter((p: any) => p.teamId === "t0")).toHaveLength(2);
    expect(players.filter((p: any) => p.teamId === "t1")).toHaveLength(2);
  } finally { for (const ws of sockets) ws.close(); }
}, 20000);
