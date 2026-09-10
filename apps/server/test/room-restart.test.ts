import { expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { attachRooms } from "../src/rooms/gateway";
import { restoreRoom, type RoomSnapshot } from "../src/rooms/runtime";
it("resumes the same lobby after restarting the gateway from durable snapshots", async () => {
  const stored = new Map<string, RoomSnapshot>();
  const save = async (snapshot: RoomSnapshot) => { stored.set(snapshot.state.roomId, JSON.parse(JSON.stringify(snapshot))); };
  const server = async () => {
    const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await new Promise<void>(resolve => wss.once("listening", resolve));
    const service = attachRooms(wss, { initial: [...stored.values()].map(restoreRoom), save });
    return { port: (wss.address() as { port: number }).port, stop: async () => { service.close(); await new Promise<void>(r => wss.close(() => r())); } };
  };
  const connect = async (port: number) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`), messages: any[] = [];
    ws.on("message", data => messages.push(JSON.parse(String(data))));
    await new Promise<void>(r => ws.once("open", r));
    return { ws, send: (value: unknown) => ws.send(JSON.stringify(value)), last: (type: string) => messages.filter(m => m.type === type).at(-1) };
  };
  let running = await server();
  try {
    const a = await connect(running.port);
    a.send({ type: "room.create", profile: { nickname: "Kero", loadout: ["cannon", "laser"] } });
    await expect.poll(() => a.last("room.welcome")).toBeTruthy();
    const welcome = a.last("room.welcome"), roomId = a.last("room.snapshot").room.roomId;
    a.ws.close();
    await expect.poll(() => stored.get(roomId)?.state.sessions[0]?.connectionId).toBeNull();
    await running.stop(); running = await server();
    const b = await connect(running.port);
    b.send({ type: "room.resume", token: welcome.token });
    await expect.poll(() => b.last("room.welcome")).toBeTruthy();
    expect(b.last("room.welcome")).toMatchObject({ playerId: welcome.playerId, generation: 2 });
    expect(b.last("room.snapshot").room.roomId).toBe(roomId);
    expect(b.last("room.snapshot").room.members[0].loadout).toEqual(["cannon", "laser"]);
    b.ws.close();
  } finally { await running.stop(); }
});
