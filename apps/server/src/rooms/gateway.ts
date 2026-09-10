import { randomUUID, randomInt } from "node:crypto";
import { movementSnapshot } from "@game/engine/multiplayer";
import { roomInputSchema } from "@game/protocol/v2-rooms";
import type { WebSocket, WebSocketServer } from "ws";
import { createRoomState, reduceRoom, disconnectRoom, tickRoom, type RoomState, type RoomReply } from "./core.js";
import { RoomRuntime, type RoomSnapshot } from "./runtime.js";
import { roomFrame } from "./frame.js";
const send = (socket: WebSocket | undefined, message: unknown) => {
  if (!socket || socket.readyState !== socket.OPEN) return;
  if (socket.bufferedAmount > 262144) { socket.close(1008, "slow connection"); return; }
  socket.send(JSON.stringify(message));
};
type Options = { readonly initial?: readonly RoomState[]; readonly save?: (snapshot: RoomSnapshot) => Promise<void> };
/** Node transport for the same room reducer used by the persistent edge adapter. */
export const attachRooms = (wss: WebSocketServer, options: Options = {}) => {
  const save = options.save ?? (async () => {});
  const rooms = new Map((options.initial ?? []).map(state => [state.roomId, new RoomRuntime(state, save)]));
  const sockets = new Map<string, WebSocket>();
  const broadcast = (state: RoomState) => { const frame = roomFrame(state, Date.now()); for (const s of state.sessions) if (s.connectionId) send(sockets.get(s.connectionId), frame); };
  const timer = setInterval(() => {
    for (const [roomId, room] of rooms) {
      let before: RoomState;
      void room.update(state => { before = state; return { state: tickRoom(state, Date.now()), reason: "tick" }; }).then(result => {
        if (result.state !== before) broadcast(result.state);
        if (result.state.lobby && !result.state.sessions.length) rooms.delete(roomId);
      }).catch(error => console.error("room timer persistence failed", error));
    }
  }, 100);
  const effects = (socket: WebSocket, result: RoomReply) => {
    if (result.welcome) send(socket, { type: "room.welcome", playerId: result.welcome.playerId, token: result.welcome.token, generation: result.welcome.generation });
    if (result.ack && result.state.battle) send(socket, { type: "lab.ack", reason: result.reason, snapshot: movementSnapshot(result.state.battle.movement, Date.now()) });
    else if (!["accepted", "unchanged"].includes(result.reason)) send(socket, { type: "room.error", reason: result.reason });
    if (result.welcome && result.state.battle) send(socket, { type: "room.snapshot", room: result.state.lobby });
    broadcast(result.state);
    if (result.close) socket.close(1000, "left");
  };
  wss.on("connection", socket => {
    const connectionId = randomUUID(); sockets.set(connectionId, socket);
    let joinedRoom: string | null = null, windowAt = Date.now(), count = 0, pending = Promise.resolve();
    const error = (reason: string) => send(socket, { type: "room.error", reason });
    const handshake = setTimeout(() => socket.close(1008, "join required"), 10000);
    const message = async (raw: unknown) => {
      const parsed = roomInputSchema.safeParse(raw); if (!parsed.success) { error("invalid"); return; }
      const input = parsed.data;
      let roomId = joinedRoom;
      if (!roomId) {
        if (input.type === "room.create") {
          if ([...rooms.values()].reduce((n, r) => n + r.state.sessions.length, 0) >= 256 || rooms.size >= 128) { error("capacity"); return; }
          do { roomId = randomUUID().slice(0, 6).toUpperCase(); } while (rooms.has(roomId));
          rooms.set(roomId, new RoomRuntime(createRoomState(roomId), save));
        } else if (input.type === "room.join") roomId = input.roomId;
        else if (input.type === "room.resume") roomId = [...rooms.values()].find(r => r.state.sessions.some(s => s.token === input.token))?.state.roomId ?? null;
        else { error("join-required"); return; }
      }
      const room = roomId ? rooms.get(roomId) : undefined;
      if (!room) { error(input.type === "room.resume" ? "invalid-session" : "not-found"); return; }
      const result = await room.update(state => reduceRoom(state, connectionId, input, Date.now(), {
        playerId: `p${randomUUID()}`, token: randomUUID(), matchId: randomUUID(), seed: randomInt(0x100000000),
      }));
      if (result.welcome) { joinedRoom = result.state.roomId; clearTimeout(handshake); }
      effects(socket, result);
    };
    socket.on("message", data => {
      if (Date.now() - windowAt >= 1000) { windowAt = Date.now(); count = 0; }
      if (++count > 30 || data.toString().length > 4096) { socket.close(1008, "rate limit"); return; }
      let raw: unknown; try { raw = JSON.parse(data.toString()); } catch { error("invalid"); return; }
      pending = pending.then(() => message(raw)).catch(e => { console.error("room persistence failed", e); socket.close(1011, "storage unavailable"); });
    });
    socket.on("close", () => { clearTimeout(handshake); sockets.delete(connectionId);
      pending = pending.then(async () => {
        const room = joinedRoom ? rooms.get(joinedRoom) : null;
        if (!room) return;
        const result = await room.update(state => ({ state: disconnectRoom(state, connectionId, Date.now()), reason: "disconnected" }));
        broadcast(result.state);
      }).catch(e => console.error("room disconnect persistence failed", e));
    });
    socket.on("error", () => socket.close());
  });
  return { close: () => { clearInterval(timer); for (const socket of wss.clients) socket.close(); } };
};
