import { randomUUID, randomInt } from "node:crypto";
import { MULTIPLAYER_MAPS } from "@game/maps";
import { createLobby, joinLobby, leaveLobby, setLobbyConnection, editLobby, startLobby, createPreparedSession, fireInSession, moveInSession, surrenderInSession, forfeitInSession, tickSession, movementSnapshot, type LobbyState, type BattleSession } from "@game/engine/multiplayer";
import { roomInputSchema } from "@game/protocol/v2-rooms";
import type { LabFrame } from "@game/protocol/v2-lab";
import type { WebSocket, WebSocketServer } from "ws";
import { replayFrame } from "../lab/replay.js";

type Room = { lobby: LobbyState; battle: BattleSession | null };
type Session = { playerId: string; roomId: string; socket: WebSocket | null; disconnectedAt: number };
const send = (socket: WebSocket | null, message: unknown) => {
  if (!socket || socket.readyState !== socket.OPEN) return;
  if (socket.bufferedAmount > 262144) { socket.close(1008, "slow connection"); return; }
  socket.send(JSON.stringify(message));
};
const battleFrame = (room: Room): LabFrame => {
  const state = room.battle!, now = Date.now();
  return { type: "lab.frame", serverTime: now, eventSeq: state.movement.eventSeq, matchId: state.matchId,
    turnId: state.roster.turnId, actorId: state.movement.playerId, deadlineAt: state.movement.deadlineAt,
    players: state.players.map(p => { const member = room.lobby.members.find(m => m.playerId === p.playerId)!;
      return { ...p, teamId: member.teamId!, nickname: member.nickname, loadout: [...state.loadouts[p.playerId]!], eliminated: state.roster.eliminated.includes(p.playerId) }; }),
    movement: movementSnapshot(state.movement, now), phase: state.phase, result: state.result,
    terrainOps: [...state.terrainOps], wind: state.windState.value, map: state.map, replay: replayFrame(state) };
};
/** DEV room gateway. Tokens stay server-private; every command uses the socket's identity. */
export const attachRooms = (wss: WebSocketServer) => {
  const rooms = new Map<string, Room>(), sessions = new Map<string, Session>();
  const members = (roomId: string) => [...sessions.values()].filter(s => s.roomId === roomId);
  const snapshot = (room: Room) => ({ type: "room.snapshot", room: room.lobby });
  const broadcast = (room: Room) => { const message = room.battle ? battleFrame(room) : snapshot(room); for (const s of members(room.lobby.roomId)) send(s.socket, message); };
  const release = (token: string, session: Session) => {
    const room = rooms.get(session.roomId); sessions.delete(token);
    if (!room) return;
    if (room.battle) room.battle = surrenderInSession(room.battle, session.playerId, Date.now());
    else room.lobby = leaveLobby(room.lobby, session.playerId);
    if (room.battle && room.lobby.ownerId === session.playerId) room.lobby = { ...room.lobby, ownerId: members(session.roomId).find(s => s.socket)?.playerId ?? null };
    if (!members(session.roomId).length) rooms.delete(session.roomId); else broadcast(room);
  };
  const timer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      const expired = [...sessions.entries()].filter(([, s]) => s.roomId === room.lobby.roomId && !s.socket && now - s.disconnectedAt >= 60000);
      const before = room.battle;
      if (room.battle) room.battle = tickSession(forfeitInSession(room.battle, expired.map(([, s]) => s.playerId), now), now);
      for (const [token, s] of expired) release(token, s);
      if (room.battle !== before && rooms.has(room.lobby.roomId)) broadcast(room);
    }
  }, 100);
  wss.on("connection", socket => {
    let token: string | null = null, session: Session | null = null, windowAt = Date.now(), count = 0;
    const error = (reason: string) => send(socket, { type: "room.error", reason });
    const handshake = setTimeout(() => socket.close(1008, "join required"), 10000);
    socket.on("message", data => {
      if (Date.now() - windowAt >= 1000) { windowAt = Date.now(); count = 0; }
      if (++count > 30 || data.toString().length > 4096) { socket.close(1008, "rate limit"); return; }
      let raw: unknown; try { raw = JSON.parse(data.toString()); } catch { error("invalid"); return; }
      const parsed = roomInputSchema.safeParse(raw); if (!parsed.success) { error("invalid"); return; }
      const message = parsed.data;
      if (message.type === "room.create" || message.type === "room.join" || message.type === "room.resume") {
        if (session) { error("already-joined"); return; }
        if (message.type === "room.resume") {
          const saved = sessions.get(message.token);
          if (!saved || saved.socket || Date.now() - saved.disconnectedAt >= 60000) { error("invalid-session"); return; }
          token = message.token; session = saved; session.socket = socket;
          const room = rooms.get(session.roomId)!;
          if (!room.battle) room.lobby = setLobbyConnection(room.lobby, session.playerId, true);
          else if (!room.lobby.ownerId) room.lobby = { ...room.lobby, ownerId: session.playerId };
        } else {
          if (sessions.size >= 256) { error("capacity"); return; }
          let roomId = message.type === "room.join" ? message.roomId : randomUUID().slice(0, 6).toUpperCase();
          while (message.type === "room.create" && rooms.has(roomId)) roomId = randomUUID().slice(0, 6).toUpperCase();
          const room = rooms.get(roomId), playerId = `p${randomUUID()}`;
          if (message.type === "room.join" && !room) { error("not-found"); return; }
          if (room?.battle) { error("locked"); return; }
          if (room && room.lobby.members.length >= 8) { error("full"); return; }
          if (room) room.lobby = joinLobby(room.lobby, playerId, message.profile);
          else rooms.set(roomId, { lobby: createLobby(roomId, playerId, message.profile, MULTIPLAYER_MAPS[0]!), battle: null });
          token = randomUUID(); session = { roomId, playerId, socket, disconnectedAt: 0 }; sessions.set(token, session);
        }
        clearTimeout(handshake); send(socket, { type: "room.welcome", playerId: session.playerId, token });
        const room = rooms.get(session.roomId)!; send(socket, snapshot(room)); broadcast(room); return;
      }
      if (!session || !token) { error("join-required"); return; }
      const room = rooms.get(session.roomId); if (!room) { error("not-found"); return; }
      if (message.type === "room.leave") { release(token, session); session = null; token = null; socket.close(1000, "left"); return; }
      if ("roomId" in message && message.roomId !== session.roomId) { error("wrong-room"); return; }
      if (message.type === "room.start") {
        const result = startLobby(room.lobby, session.playerId, message.revision);
        if (!result.setup) { error(result.reason); return; }
        room.lobby = result.room; room.battle = createPreparedSession(result.setup, randomUUID(), randomInt(0x100000000), Date.now());
        for (const s of members(session.roomId)) send(s.socket, snapshot(room)); broadcast(room); return;
      }
      if (message.type.startsWith("room.")) {
        const result = editLobby(room.lobby, session.playerId, message); room.lobby = result.room;
        if (result.reason !== "accepted" && result.reason !== "unchanged") error(result.reason); else broadcast(room); return;
      }
      const battle = room.battle; if (!battle) { error("not-started"); return; }
      if (message.type === "lab.rematch") {
        if (battle.phase !== "finished" || message.matchId !== battle.matchId || room.lobby.ownerId !== session.playerId) { error("not-owner-or-not-finished"); return; }
        const present = members(session.roomId);
        room.lobby = { ...room.lobby, phase: "waiting", revision: room.lobby.revision + 1,
          members: room.lobby.members.filter(p => present.some(s => s.playerId === p.playerId)).map(p => ({ ...p, ready: false })) };
        room.battle = null;
        for (const s of present) room.lobby = setLobbyConnection(room.lobby, s.playerId, s.socket !== null);
      } else if (message.type === "lab.surrender") {
        if (message.matchId !== battle.matchId) { error("wrong-match"); return; }
        room.battle = surrenderInSession(battle, session.playerId, Date.now());
      } else if (message.type === "turn.fire" || message.type === "move.command") {
        const result = message.type === "turn.fire" ? fireInSession(battle, session.playerId, message, Date.now()) : moveInSession(battle, session.playerId, message, Date.now());
        room.battle = result.state; send(socket, { type: "lab.ack", reason: result.reason, snapshot: movementSnapshot(room.battle.movement, Date.now()) });
      }
      broadcast(room);
    });
    socket.on("close", () => { clearTimeout(handshake); if (!session || session.socket !== socket) return;
      session.socket = null; session.disconnectedAt = Date.now(); const room = rooms.get(session.roomId);
      if (room && !room.battle) { room.lobby = setLobbyConnection(room.lobby, session.playerId, false); broadcast(room); }
      else if (room?.lobby.ownerId === session.playerId) room.lobby = { ...room.lobby, ownerId: members(session.roomId).find(s => s.socket)?.playerId ?? null }; });
    socket.on("error", () => socket.close());
  });
  return { close: () => { clearInterval(timer); for (const socket of wss.clients) socket.close(); } };
};
