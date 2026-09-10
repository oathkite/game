import { CLIENT_BUILD } from "@game/protocol/build";
import { roomOutputSchema } from "@game/protocol/v2-rooms";
import { expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { attachRooms } from "../src/rooms/gateway";
type Output = ReturnType<typeof roomOutputSchema.parse>;
const profile = { nickname: "Concurrent", loadout: ["triple", "laser"] };
it("keeps four simultaneous eight-player battles isolated through firing and abrupt reconnects", async () => {
  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise<void>(resolve => wss.once("listening", resolve));
  const service = attachRooms(wss), sockets: WebSocket[] = [];
  const connect = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${(wss.address() as { port: number }).port}`);
    const messages: Output[] = []; sockets.push(ws);
    ws.on("message", data => messages.push(roomOutputSchema.parse(JSON.parse(String(data)))));
    await new Promise<void>((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
    return { ws, messages, send: (message: unknown) => ws.send(JSON.stringify(message)),
      last: <T extends Output["type"]>(type: T) => [...messages].reverse().find(message => message.type === type) as Extract<Output, { type: T }> | undefined };
  };
  try {
    const battles = await Promise.all(Array.from({ length: 4 }, async () => {
      const clients = await Promise.all(Array.from({ length: 8 }, connect));
      const owner = clients[0]!;
      owner.send({ type: "room.create", build: CLIENT_BUILD, profile });
      await expect.poll(() => owner.last("room.snapshot")).toBeTruthy();
      const roomId = owner.last("room.snapshot")!.room.roomId;
      for (const guest of clients.slice(1)) guest.send({ type: "room.join", build: CLIENT_BUILD, roomId, profile });
      await expect.poll(() => owner.last("room.snapshot")?.room.members.length).toBe(8);
      const edit = (client: typeof owner, type: string, values: object) => client.send({ type, version: 2, roomId, revision: owner.last("room.snapshot")!.room.revision, ...values });
      for (let i = 0; i < clients.length; i++) {
        const playerId = clients[i]!.last("room.welcome")!.playerId;
        edit(owner, "room.assignTeam", { playerId, teamId: `t${i % 2}` });
        await expect.poll(() => owner.last("room.snapshot")!.room.members.find(p => p.playerId === playerId)?.teamId).toBe(`t${i % 2}`);
      }
      for (const client of clients) edit(client, "room.ready", { ready: true });
      await expect.poll(() => owner.last("room.snapshot")!.room.members.every(p => p.ready)).toBe(true);
      edit(owner, "room.start", {});
      await expect.poll(() => clients.every(client => client.last("lab.frame"))).toBe(true);
      return { clients, roomId, matchId: owner.last("lab.frame")!.matchId };
    }));
    expect(new Set(battles.map(b => b.matchId)).size).toBe(4);
    await Promise.all(battles.map(async battle => {
      const frame = battle.clients[0]!.last("lab.frame")!;
      const actor = battle.clients.find(client => client.last("room.welcome")!.playerId === frame.actorId)!;
      const shot = { type: "turn.fire", version: 2, matchId: frame.matchId, turnId: frame.turnId,
        commandId: "same-command-id-in-each-room", ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power: 40 };
      actor.send(shot);
      await expect.poll(() => battle.clients.every(client => client.last("lab.frame")?.phase === "replaying")).toBe(true);
      const welcome = actor.last("room.welcome")!;
      actor.ws.terminate();
      await new Promise<void>(resolve => actor.ws.once("close", resolve));
      const resumed = await connect(); resumed.send({ type: "room.resume", build: CLIENT_BUILD, token: welcome.token });
      await expect.poll(() => resumed.last("room.welcome")?.generation).toBe(2);
      expect(resumed.last("room.welcome")!.playerId).toBe(welcome.playerId);
      resumed.send(shot);
      await expect.poll(() => resumed.last("lab.ack")?.reason).toBe("duplicate");
      await expect.poll(() => resumed.last("lab.frame")?.turnId, { timeout: 12000 }).toBe(2);
      for (const client of [...battle.clients, resumed]) {
        const frames = client.messages.filter(message => message.type === "lab.frame");
        expect(frames.length).toBeGreaterThan(0);
        expect(frames.every(frame => frame.matchId === battle.matchId && frame.players.length === 8)).toBe(true);
      }
    }));
  } finally { sockets.forEach(socket => socket.terminate()); service.close(); await new Promise<void>(resolve => wss.close(() => resolve())); }
}, 30000);
