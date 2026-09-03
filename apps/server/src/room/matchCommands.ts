import type { ClientMessageOf, RoomErrorReason } from "@game/protocol";
import type { ConnId, Outgoing, RoomRecord, ServerState } from "../state.js";
import { dispatchEngine, reopenRoom } from "./match.js";
import { broadcastState, findRoomOfConn, memberByConn, send, toRoomState } from "./view.js";

// 対戦中のメッセージ、リザルトを閉じる、再接続。観戦者からの対戦操作は拒否する。

const error = (connId: ConnId, reason: RoomErrorReason): readonly Outgoing[] => [send(connId, { type: "room.error", reason })];

const put = (state: ServerState, room: RoomRecord): void => {
  state.rooms.set(room.code, room);
};

const asMember = (state: ServerState, connId: ConnId) => {
  const room = findRoomOfConn(state, connId);
  const member = room ? memberByConn(room, connId) : undefined;
  return room && member ? { room, member } : null;
};

export const matchReady = (state: ServerState, connId: ConnId, now: number): readonly Outgoing[] => {
  const r = asMember(state, connId);
  if (!r) return [];
  const step = dispatchEngine(r.room, { type: "loaded", seat: r.member.seat }, now);
  put(state, step.room);
  return step.effects;
};

export const fire = (state: ServerState, connId: ConnId, m: ClientMessageOf<"turn.fire">, now: number): readonly Outgoing[] => {
  const r = asMember(state, connId);
  if (!r) return error(connId, "notMember");
  const step = dispatchEngine(r.room, { type: "fire", seat: r.member.seat, fire: m }, now);
  put(state, step.room);
  return step.effects;
};

export const replayDone = (state: ServerState, connId: ConnId, now: number): readonly Outgoing[] => {
  const r = asMember(state, connId);
  if (!r) return [];
  const step = dispatchEngine(r.room, { type: "replayDone", seat: r.member.seat }, now);
  put(state, step.room);
  return step.effects;
};

export const surrender = (state: ServerState, connId: ConnId, now: number): readonly Outgoing[] => {
  const r = asMember(state, connId);
  if (!r) return error(connId, "notMember");
  const step = dispatchEngine(r.room, { type: "surrender", seat: r.member.seat }, now);
  put(state, step.room);
  return step.effects;
};

/** 全員が閉じるか一定時間で部屋は募集中に戻る */
export const resultClose = (state: ServerState, connId: ConnId, now: number): readonly Outgoing[] => {
  const r = asMember(state, connId);
  if (!r || r.room.phase !== "result") return [];
  const marked: RoomRecord = { ...r.room, members: r.room.members.map((m) => (m.seat === r.member.seat ? { ...m, closedResult: true } : m)) };
  const allClosed = marked.members.every((m) => m.closedResult || m.connId === null);
  if (!allClosed) {
    put(state, marked);
    return [];
  }
  const step = reopenRoom(marked, now);
  put(state, step.room);
  state.lobbyDirty = true;
  return step.effects;
};

/** 接続トークンで席を取り戻す。対戦中ならエンジンに再接続を伝える */
export const resume = (state: ServerState, connId: ConnId, m: ClientMessageOf<"conn.resume">, now: number): readonly Outgoing[] => {
  if (findRoomOfConn(state, connId)) return error(connId, "badRequest");
  for (const room of state.rooms.values()) {
    const member = room.members.find((x) => x.token === m.token);
    if (member) {
      if (member.connId !== null) return error(connId, "invalidToken");
      let next: RoomRecord = { ...room, members: room.members.map((x) => (x === member ? { ...x, connId } : x)), lastActivityAt: now };
      const effects: Outgoing[] = [
        send(connId, { type: "room.joined", code: next.code, inviteUrl: `?room=${next.code}`, seat: member.seat, spectator: false, token: member.token, room: toRoomState(next) }),
      ];
      if (next.phase === "inMatch") {
        const step = dispatchEngine(next, { type: "reconnect", seat: member.seat }, now);
        next = step.room;
        effects.push(...step.effects);
      } else if (next.engine && next.phase === "result") {
        effects.push(send(connId, { type: "conn.state", match: next.engine.match, seat: member.seat }));
      }
      state.rooms.set(next.code, next);
      state.connections.set(connId, { roomCode: next.code, lobbySubscribed: false, lobbyQuery: null });
      return [...effects, ...broadcastState(next)];
    }
    const spectator = room.spectators.find((s) => s.token === m.token);
    if (spectator) {
      if (spectator.connId !== null) return error(connId, "invalidToken");
      const next: RoomRecord = { ...room, spectators: room.spectators.map((s) => (s === spectator ? { ...s, connId } : s)) };
      state.rooms.set(next.code, next);
      state.connections.set(connId, { roomCode: next.code, lobbySubscribed: false, lobbyQuery: null });
      const effects: Outgoing[] = [
        send(connId, { type: "room.joined", code: next.code, inviteUrl: `?room=${next.code}`, seat: null, spectator: true, token: spectator.token, room: toRoomState(next) }),
      ];
      if (next.engine && next.phase !== "open") effects.push(send(connId, { type: "conn.state", match: next.engine.match, seat: null }));
      return [...effects, ...broadcastState(next)];
    }
  }
  return error(connId, "invalidToken");
};
