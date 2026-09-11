import { expect, it } from "vitest";
import { WebSocket } from "ws";
import { CLIENT_BUILD } from "@game/protocol/build";
const endpoint = process.env.EDGE_TEST_URL;
it.skipIf(!endpoint)("lists occupied custom rooms in stable bounded pages", async () => {
  const headers = { Origin: "http://127.0.0.1:5186" }, sockets: WebSocket[] = [], ids: string[] = [];
  try {
    expect((await fetch(`${endpoint}/v2/rooms/page`, { headers })).status).toBe(200);
    for (let i = 0; i < 21; i++) {
      const { roomId } = await fetch(`${endpoint}/v2/rooms`, { method: "POST", headers }).then(response => response.json()) as { roomId: string };
      ids.push(roomId);
      const probe = await fetch(`${endpoint}/v2/rooms/${roomId}/probe`, { headers });
      expect(probe.status).toBe(200);
      expect(await probe.json()).toEqual({ roomId });
      const before = await fetch(`${endpoint}/v2/rooms`, { headers }).then(response => response.json()) as { roomId: string; members: number }[];
      expect(before.find(room => room.roomId === roomId)?.members).toBe(0);
      const ws = new WebSocket(`${endpoint!.replace("http", "ws")}/v2/rooms/${roomId}`, { headers }); sockets.push(ws);
      await new Promise<void>((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
      let joined = false;
      ws.on("message", data => { if (JSON.parse(String(data)).type === "room.snapshot") joined = true; });
      ws.send(JSON.stringify({ type: "room.create", build: CLIENT_BUILD, profile: { nickname: "Directory", loadout: ["cannon", "laser"] } }));
      await expect.poll(() => joined).toBe(true);
    }
    const found: string[] = []; let after = "", pages = 0;
    do {
      const page = await fetch(`${endpoint}/v2/rooms/page?after=${after}`, { headers }).then(response => response.json()) as { rooms: { roomId: string; members: number; mode: string }[]; nextCursor: string | null };
      expect(page.rooms.length).toBeLessThanOrEqual(20);
      for (const room of page.rooms) { expect(room.members).toBeGreaterThan(0); expect(room.mode).toBe("custom"); found.push(room.roomId); }
      after = page.nextCursor ?? "";
      expect(++pages).toBeLessThan(10);
    } while (after);
    expect(pages).toBeGreaterThan(1);
    expect(new Set(found).size).toBe(found.length);
    expect(found).toEqual([...found].sort());
    for (const id of ids) expect(found).toContain(id);
    expect((await fetch(`${endpoint}/v2/rooms/page?after=invalid`, { headers })).status).toBe(400);
    expect((await fetch(`${endpoint}/v2/rooms/page`)).status).toBe(403);
  } finally { for (const ws of sockets) ws.close(); }
}, 30000);
