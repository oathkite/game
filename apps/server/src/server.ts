import type { ClientMessage } from "@game/protocol";
import { lobbyPage } from "./lobby.js";
import * as rooms from "./room/commands.js";
import { dispatchEngine, engineWakeAt, reopenRoom } from "./room/match.js";
import * as match from "./room/matchCommands.js";
import { findRoomOfConn, memberByConn, send } from "./room/view.js";
import type { Command, ConnId, Outgoing, Result, RoomRecord, ServerState } from "./state.js";

// 命令を 1 つ受け取り、状態を進めて送るべきメッセージと次に起こす時刻を返す。

const onMessage = (state: ServerState, connId: ConnId, m: ClientMessage, now: number): readonly Outgoing[] => {
  switch (m.type) {
    case "lobby.subscribe": {
      const c = state.connections.get(connId);
      state.connections.set(connId, { roomCode: c?.roomCode ?? null, lobbySubscribed: true, lobbyQuery: c?.lobbyQuery ?? null });
      return [];
    }
    case "lobby.unsubscribe": {
      const c = state.connections.get(connId);
      state.connections.set(connId, { roomCode: c?.roomCode ?? null, lobbySubscribed: false, lobbyQuery: null });
      return [];
    }
    case "lobby.query": {
      const c = state.connections.get(connId);
      const query = { search: m.search, phase: m.phase, mapName: m.mapName, page: m.page };
      state.connections.set(connId, { roomCode: c?.roomCode ?? null, lobbySubscribed: c?.lobbySubscribed ?? false, lobbyQuery: query });
      return [send(connId, lobbyPage(state.rooms.values(), query))];
    }
    case "room.create":
      return rooms.create(state, connId, m, now);
    case "room.join":
      return rooms.join(state, connId, m, now);
    case "room.spectate":
      return rooms.spectate(state, connId, m, now);
    case "room.takeSeat":
      return rooms.takeSeat(state, connId, m, now);
    case "room.ready":
      return rooms.ready(state, connId, m, now);
    case "room.profile":
      return rooms.profile(state, connId, m, now);
    case "room.setMap":
      return rooms.setMap(state, connId, m, now);
    case "room.kick":
      return rooms.kick(state, connId, m, now);
    case "room.start":
      return rooms.start(state, connId, now);
    case "room.leave":
      return rooms.leave(state, connId, now);
    case "room.dissolve":
      return rooms.dissolve(state, connId, now);
    case "match.ready":
      return match.matchReady(state, connId, now);
    case "turn.fire":
      return match.fire(state, connId, m, now);
    case "turn.replayDone":
      return match.replayDone(state, connId, now);
    case "match.surrender":
      return match.surrender(state, connId, now);
    case "result.close":
      return match.resultClose(state, connId, now);
    case "conn.resume":
      return match.resume(state, connId, m, now);
    case "time.ping":
      return [send(connId, { type: "time.pong", sentAt: m.sentAt, serverTime: now })];
  }
};

/** 接続が切れた。対戦中の参加者は席を保持して再接続を待ち、それ以外は部屋から外す */
const onClose = (state: ServerState, connId: ConnId, now: number): readonly Outgoing[] => {
  const room = findRoomOfConn(state, connId);
  state.connections.delete(connId);
  if (!room) return [];
  const member = memberByConn(room, connId);
  if (member && room.phase === "inMatch") {
    const held: RoomRecord = { ...room, members: room.members.map((x) => (x === member ? { ...x, connId: null } : x)) };
    const step = dispatchEngine(held, { type: "disconnect", seat: member.seat }, now);
    state.rooms.set(step.room.code, step.room);
    return step.effects;
  }
  return rooms.removeFromRoom(state, room, connId, now);
};

const tickRoom = (state: ServerState, room: RoomRecord, now: number): readonly Outgoing[] => {
  const effects: Outgoing[] = [];
  let current = room;
  if (current.phase === "inMatch") {
    const wake = engineWakeAt(current);
    if (wake !== null && now >= wake) {
      const step = dispatchEngine(current, { type: "tick" }, now);
      current = step.room;
      effects.push(...step.effects);
      state.rooms.set(current.code, current);
      if (current.phase !== "inMatch") state.lobbyDirty = true;
    }
  }
  if (current.phase === "result" && current.resultOpenedAt !== null && now >= current.resultOpenedAt + state.config.resultAutoCloseMs) {
    const step = reopenRoom(current, now);
    current = step.room;
    effects.push(...step.effects);
    state.rooms.set(current.code, current);
    state.lobbyDirty = true;
  }
  if (current.phase === "open" && now >= current.lastActivityAt + state.config.idleRoomMs) {
    effects.push(...rooms.closeRoom(state, current, "idle"));
  }
  return effects;
};

const lobbyNotify = (state: ServerState, now: number): readonly Outgoing[] => {
  if (!state.lobbyDirty || now < state.lobbyNotifiedAt + state.config.lobbyThrottleMs) return [];
  state.lobbyDirty = false;
  state.lobbyNotifiedAt = now;
  return [...state.connections.entries()].filter(([, c]) => c.lobbySubscribed).map(([connId]) => send(connId, { type: "lobby.changed" }));
};

export const computeWakeAt = (state: ServerState): number | null => {
  const times: number[] = [];
  for (const room of state.rooms.values()) {
    const e = engineWakeAt(room);
    if (e !== null) times.push(e);
    if (room.phase === "result" && room.resultOpenedAt !== null) times.push(room.resultOpenedAt + state.config.resultAutoCloseMs);
    if (room.phase === "open") times.push(room.lastActivityAt + state.config.idleRoomMs);
  }
  if (state.lobbyDirty) times.push(state.lobbyNotifiedAt + state.config.lobbyThrottleMs);
  return times.length === 0 ? null : Math.min(...times);
};

export const handleCommand = (state: ServerState, command: Command, now: number): Result => {
  const effects: Outgoing[] = [];
  switch (command.type) {
    case "open":
      state.connections.set(command.connId, { roomCode: null, lobbySubscribed: false, lobbyQuery: null });
      break;
    case "message":
      if (state.connections.has(command.connId)) effects.push(...onMessage(state, command.connId, command.message, now));
      break;
    case "close":
      effects.push(...onClose(state, command.connId, now));
      break;
    case "tick":
      for (const room of [...state.rooms.values()]) effects.push(...tickRoom(state, room, now));
      break;
  }
  effects.push(...lobbyNotify(state, now));
  return { effects, wakeAt: computeWakeAt(state) };
};
