import { tickRoom } from "../src/rooms/core";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileRoomStore } from "../src/rooms/fileStore";
import { restoreRoom, type RoomSnapshot } from "../src/rooms/runtime";
import { serializeBattle } from "@game/engine/multiplayer";
import { CLIENT_BUILD } from "@game/protocol/build";
import { roomOutputSchema } from "@game/protocol/v2-rooms";
import { expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { attachRooms } from "../src/rooms/gateway";
type Output = ReturnType<typeof roomOutputSchema.parse>;
const profile = { nickname: "Concurrent", loadout: ["triple", "laser"] };
const roomCount = Number(process.env.ROOM_LOAD_COUNT ?? 4);
if (!Number.isInteger(roomCount) || roomCount < 1 || roomCount > 100) throw new Error("ROOM_LOAD_COUNT must be 1..100");
const delayMs = Number(process.env.ROOM_LOAD_DELAY_MS ?? 0);
if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 500) throw new Error("ROOM_LOAD_DELAY_MS must be 0..500");
const soakSeconds = Number(process.env.ROOM_SOAK_SECONDS ?? 0);
if (!Number.isInteger(soakSeconds) || soakSeconds < 0 || soakSeconds > 3600) throw new Error("ROOM_SOAK_SECONDS must be 0..3600");
it(`keeps ${roomCount} simultaneous eight-player battles isolated through firing and abrupt reconnects`, async () => {
  // expect.poll retains an onFinished closure per call in Vitest 3; avoid it in soak loops.
  const poll = <T>(read: () => T, options = { timeout: 15000 }) => {
    const wait = async (matches: (value: T) => boolean) => {
      const deadline = performance.now() + options.timeout;
      let value = read();
      while (!matches(value) && performance.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
        value = read();
      }
      return value;
    };
    return {
      toBe: async (expected: T) => { expect(await wait(value => Object.is(value, expected))).toBe(expected); },
      toBeTruthy: async () => { expect(await wait(Boolean)).toBeTruthy(); },
    };
  };
  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise<void>(resolve => wss.once("listening", resolve));
  const directory = process.env.ROOM_LOAD_PERSIST === "1" ? await mkdtemp(join(tmpdir(), "keropod-load-")) : null;
  const store = directory ? fileRoomStore(directory) : null;
  const saved = new Map<string, RoomSnapshot>();
  const service = attachRooms(wss, store ? { save: async snapshot => { await store.save(snapshot); saved.set(snapshot.state.roomId, snapshot); } } : {}), sockets: WebSocket[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const deliver = (action: () => void) => {
    if (!delayMs) { action(); return; }
    const timer = setTimeout(() => { timers.delete(timer); action(); }, delayMs);
    timers.add(timer);
  };
  const connect = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${(wss.address() as { port: number }).port}`);
    const messages: Output[] = []; sockets.push(ws);
    ws.on("message", data => deliver(() => messages.push(roomOutputSchema.parse(JSON.parse(String(data))))));
    await new Promise<void>((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
    return { ws, messages, send: (message: unknown) => deliver(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); }),
      last: <T extends Output["type"]>(type: T) => [...messages].reverse().find(message => message.type === type) as Extract<Output, { type: T }> | undefined };
  };
  try {
    const battles = await Promise.all(Array.from({ length: roomCount }, async () => {
      const clients = await Promise.all(Array.from({ length: 8 }, connect));
      const owner = clients[0]!;
      owner.send({ type: "room.create", build: CLIENT_BUILD, profile });
      await poll(() => owner.last("room.snapshot") ?? owner.last("room.error")).toBeTruthy();
      expect(owner.last("room.error")).toBeUndefined();
      const roomId = owner.last("room.snapshot")!.room.roomId;
      for (const guest of clients.slice(1)) guest.send({ type: "room.join", build: CLIENT_BUILD, roomId, profile });
      await poll(() => owner.last("room.snapshot")?.room.members.length).toBe(8);
      const edit = (client: typeof owner, type: string, values: object) => client.send({ type, version: 2, roomId, revision: owner.last("room.snapshot")!.room.revision, ...values });
      for (let i = 0; i < clients.length; i++) {
        const playerId = clients[i]!.last("room.welcome")!.playerId;
        edit(owner, "room.assignTeam", { playerId, teamId: `t${i % 2}` });
        await poll(() => owner.last("room.snapshot")!.room.members.find(p => p.playerId === playerId)?.teamId).toBe(`t${i % 2}`);
      }
      for (const client of clients) edit(client, "room.ready", { ready: true });
      await poll(() => owner.last("room.snapshot")!.room.members.every(p => p.ready)).toBe(true);
      edit(owner, "room.start", {});
      await poll(() => clients.every(client => client.last("lab.frame"))).toBe(true);
      return { clients, roomId, matchId: owner.last("lab.frame")!.matchId };
    }));
    expect(new Set(battles.map(b => b.matchId)).size).toBe(roomCount);
    let pingNonce = 0;
    const exerciseShot = async (battle: typeof battles[number]) => {
      const probeAt = performance.now(), probeNonce = ++pingNonce;
      battle.clients[0]!.send({ type: "room.ping", nonce: probeNonce });
      await poll(() => battle.clients[0]!.last("room.pong")?.nonce).toBe(probeNonce);
      expect(performance.now() - probeAt).toBeGreaterThanOrEqual(delayMs * 2 - 2);
      const frame = battle.clients[0]!.last("lab.frame")!;
      const actor = battle.clients.find(client => client.last("room.welcome")!.playerId === frame.actorId)!;
      actor.send({ version: 2, type: "move.command", matchId: frame.matchId, turnId: frame.turnId, commandId: "same-move-in-each-room", moveSeq: 1, direction: 1, steps: 1 });
      await poll(() => battle.clients.every(client => client.last("lab.frame")?.movement.ackMoveSeq === 1)).toBe(true);
      const shot = { type: "turn.fire", version: 2, matchId: frame.matchId, turnId: frame.turnId,
        commandId: "same-command-id-in-each-room", ackMoveSeq: 1, slot: 0, facing: 1, elevation: 45, power: 40 };
      actor.send(shot);
      await poll(() => battle.clients.every(client => client.last("lab.frame")?.phase === "replaying")).toBe(true);
      const welcome = actor.last("room.welcome")!;
      actor.ws.terminate();
      await new Promise<void>(resolve => actor.ws.once("close", resolve));
      const resumed = await connect(); resumed.send({ type: "room.resume", build: CLIENT_BUILD, token: welcome.token });
      await poll(() => resumed.last("room.welcome")?.generation).toBe(welcome.generation + 1);
      expect(resumed.last("room.welcome")!.playerId).toBe(welcome.playerId);
      resumed.send(shot);
      await poll(() => resumed.last("lab.ack")?.reason).toBe("duplicate");
      await poll(() => resumed.last("lab.frame")?.turnId, { timeout: 12000 }).toBe(2);
      for (const client of [...battle.clients, resumed]) {
        const frames = client.messages.filter(message => message.type === "lab.frame");
        expect(frames.length).toBeGreaterThan(0);
        expect(frames.every(frame => frame.matchId === battle.matchId && frame.players.length === 8)).toBe(true);
      }
      battle.clients[battle.clients.indexOf(actor)] = resumed;
      await poll(() => battle.clients.every(client => client.last("room.snapshot")?.room.ownerId === resumed.last("room.snapshot")?.room.ownerId)).toBe(true);
    };
    await Promise.all(battles.map(exerciseShot));
    const soakStart = performance.now();
    let iteration = 1, soakMoves = 0, rematches = 0;
    const restart = async (battle: typeof battles[number]) => {
      const snapshot = battle.clients[0]!.last("room.snapshot")!.room;
      for (const client of battle.clients) {
        const member = snapshot.members.find(member => member.playerId === client.last("room.welcome")!.playerId)!;
        if (member.teamId === "t0") client.send({ type: "lab.surrender", matchId: battle.matchId });
      }
      await poll(() => battle.clients.every(client => client.last("lab.frame")?.phase === "finished")).toBe(true);
      const owner = battle.clients.find(client => client.last("room.welcome")!.playerId === snapshot.ownerId)!;
      owner.send({ type: "lab.rematch", matchId: battle.matchId });
      await poll(() => battle.clients.every(client => client.last("room.snapshot")?.room.phase === "waiting")).toBe(true).catch(() => {
        throw new Error(`Rematch refused: ${JSON.stringify({ error: owner.last("room.error"), match: battle.matchId, frames: battle.clients.map(client => ({ match: client.last("lab.frame")?.matchId, phase: client.last("lab.frame")?.phase, owner: client.last("room.snapshot")?.room.ownerId })) })}`);
      });
      const edit = (client: typeof owner, type: string, values: object) => client.send({ type, version: 2, roomId: battle.roomId, revision: owner.last("room.snapshot")!.room.revision, ...values });
      for (const client of battle.clients) edit(client, "room.ready", { ready: true });
      await poll(() => owner.last("room.snapshot")!.room.members.every(member => member.ready)).toBe(true);
      edit(owner, "room.start", {});
      await poll(() => battle.clients.every(client => client.last("lab.frame")?.matchId !== battle.matchId)).toBe(true);
      battle.matchId = owner.last("lab.frame")!.matchId;
      for (const client of battle.clients) {
        const latest = new Map(client.messages.map(message => [message.type, message]));
        client.messages.splice(0, client.messages.length, ...latest.values());
      }
      await exerciseShot(battle);
      rematches++;
    };
    // Exercise result/rematch even in short runs; then repeat throughout the hour.
    if (soakSeconds > 0) await Promise.all(battles.map(restart));
    while (performance.now() - soakStart < soakSeconds * 1000) {
      iteration++;
      const nonce = ++pingNonce;
      if (iteration % 60 === 0) await Promise.all(battles.map(restart));
      await Promise.all(battles.map(async battle => {
        for (const client of battle.clients) {
          expect(client.ws.readyState).toBe(WebSocket.OPEN);
          client.send({ type: "room.ping", nonce });
        }
        await poll(() => battle.clients.every(client => client.last("room.pong")?.nonce === nonce)).toBe(true);
        const frame = battle.clients[0]!.last("lab.frame")!;
        expect(frame.phase).toBe("acting");
        if (frame.movement.stepsLeft > 0 && frame.deadlineAt - Date.now() > 2000) {
          const actor = battle.clients.find(client => client.last("room.welcome")!.playerId === frame.actorId)!;
          const seq = frame.movement.ackMoveSeq + 1;
          soakMoves++;
          actor.send({ version: 2, type: "move.command", matchId: frame.matchId, turnId: frame.turnId, commandId: `soak-${nonce}`, moveSeq: seq, direction: nonce % 2 ? -1 : 1, steps: 1 });
          await poll(() => battle.clients.every(client => client.last("lab.frame")!.movement.ackMoveSeq === seq || client.last("lab.frame")!.turnId > frame.turnId)).toBe(true);
        }
        for (const client of battle.clients) {
          expect(client.messages.filter(message => message.type === "lab.frame").every(frame => frame.matchId === battle.matchId && frame.players.length === 8)).toBe(true);
          const latestByType = new Map(client.messages.map(message => [message.type, message]));
          client.messages.splice(0, client.messages.length, ...latestByType.values());
        }
      }));
      if (iteration % 30 === 0) console.log(`soak elapsed=${Math.round((performance.now() - soakStart) / 1000)}s rooms=${roomCount} rssMB=${Math.round(process.memoryUsage().rss / 1048576)} heapMB=${Math.round(process.memoryUsage().heapUsed / 1048576)}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (soakSeconds > 0) {
      expect(soakMoves).toBeGreaterThan(0);
      expect(rematches).toBeGreaterThanOrEqual(roomCount);
      for (const battle of battles) expect(battle.clients[0]!.last("lab.frame")!.turnId).toBeGreaterThanOrEqual(2);
      console.log(`soak complete seconds=${soakSeconds} rematches=${rematches} moves=${soakMoves}`);
    }
    if (store) {
      expect(saved.size).toBe(roomCount);
      for (const battle of battles) {
        const snapshot = saved.get(battle.roomId)!;
        expect(snapshot.state.battle?.state.matchId).toBe(battle.matchId);
      }
    }
  } finally {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    sockets.forEach(socket => socket.terminate()); service.close();
    await new Promise<void>(resolve => wss.close(() => resolve()));
    if (store && directory) {
      try {
        await poll(() => [...saved.values()].every(snapshot => snapshot.state.sessions.every(session => session.connectionId === null))).toBe(true);
        const restoredAt = Date.now();
        const restored = await store.load(restoredAt);
        expect(restored.length).toBe(saved.size);
        expect(restored.every(room => (room.battle?.roster.turnId ?? 0) >= 2 && room.sessions.length === 8)).toBe(true);
        for (const room of restored) expect(serializeBattle(room.battle!)).toEqual(serializeBattle(tickRoom(restoreRoom(saved.get(room.roomId)!), restoredAt).battle!));
      } finally { await rm(directory, { recursive: true, force: true }); }
    }
  }
}, 120000 + soakSeconds * 1000);
