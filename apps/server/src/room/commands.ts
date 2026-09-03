import { MAX_PLAYERS, MAX_SPECTATORS, type ClientMessageOf, type RoomClosedReason, type RoomErrorReason, type Seat } from "@game/protocol";
import { generateCode, generateToken } from "../codes.js";
import type { ConnId, Member, Outgoing, RoomRecord, ServerState, SpectatorRecord } from "../state.js";
import { dispatchEngine, startMatch } from "./match.js";
import { broadcast, broadcastState, canStart, findRoomOfConn, freeSeat, memberByConn, resetReady, send, toRoomState, touch } from "./view.js";

// 部屋の作成、入退室、ready、マップ変更、キック、開始、解散。設計書 09 と 05 の 5.5。
// 状態は state.rooms と state.connections を書き換える。効果は返り値で返す。

const error = (connId: ConnId, reason: RoomErrorReason): readonly Outgoing[] => [send(connId, { type: "room.error", reason })];

const put = (state: ServerState, room: RoomRecord): void => {
  state.rooms.set(room.code, room);
  state.lobbyDirty = true;
};

const bind = (state: ServerState, connId: ConnId, roomCode: string | null): void => {
  const c = state.connections.get(connId);
  state.connections.set(connId, { roomCode, lobbySubscribed: c?.lobbySubscribed ?? false, lobbyQuery: c?.lobbyQuery ?? null });
};

const joined = (room: RoomRecord, connId: ConnId, seat: Seat | null, token: string): Outgoing =>
  send(connId, { type: "room.joined", code: room.code, inviteUrl: `?room=${room.code}`, seat, spectator: seat === null, token, room: toRoomState(room) });

export const closeRoom = (state: ServerState, room: RoomRecord, reason: RoomClosedReason): readonly Outgoing[] => {
  const effects = broadcast(room, { type: "room.closed", reason });
  for (const m of room.members) if (m.connId) bind(state, m.connId, null);
  for (const s of room.spectators) if (s.connId) bind(state, s.connId, null);
  state.rooms.delete(room.code);
  state.lobbyDirty = true;
  return effects;
};

export const create = (state: ServerState, connId: ConnId, m: ClientMessageOf<"room.create">, now: number): readonly Outgoing[] => {
  if (findRoomOfConn(state, connId)) return error(connId, "badRequest");
  const code = generateCode(state.config.rng, (c) => state.rooms.has(c));
  if (code === null) return error(connId, "badRequest");
  const owner: Member = {
    seat: 0,
    playerId: m.playerId,
    token: generateToken(state.config.rng),
    nickname: m.nickname,
    colors: m.colors,
    ready: false,
    joinOrder: 0,
    connId,
    closedResult: false,
  };
  const room: RoomRecord = {
    code,
    title: m.title.trim().length > 0 ? m.title.trim() : `${m.nickname} の部屋`,
    isPublic: m.isPublic,
    mapName: m.mapName,
    createdAt: now,
    lastActivityAt: now,
    ownerSeat: 0,
    phase: "open",
    members: [owner],
    spectators: [],
    joinCounter: 1,
    engine: null,
    resultOpenedAt: null,
  };
  put(state, room);
  bind(state, connId, code);
  return [joined(room, connId, 0, owner.token)];
};

export const join = (state: ServerState, connId: ConnId, m: ClientMessageOf<"room.join">, now: number): readonly Outgoing[] => {
  if (findRoomOfConn(state, connId)) return error(connId, "badRequest");
  const room = state.rooms.get(m.code);
  if (!room) return error(connId, "notFound");
  if (room.phase === "inMatch") return error(connId, "inMatch");
  const seat = freeSeat(room);
  if (seat === null || room.members.length >= MAX_PLAYERS) return error(connId, "full");
  const member: Member = {
    seat,
    playerId: m.playerId,
    token: generateToken(state.config.rng),
    nickname: m.nickname,
    colors: m.colors,
    ready: false,
    joinOrder: room.joinCounter,
    connId,
    closedResult: false,
  };
  // 入室で全員の ready を解除する
  const next = touch(resetReady({ ...room, members: [...room.members, member], joinCounter: room.joinCounter + 1 }), now);
  put(state, next);
  bind(state, connId, next.code);
  return [joined(next, connId, seat, member.token), ...broadcastState(next)];
};

export const spectate = (state: ServerState, connId: ConnId, m: ClientMessageOf<"room.spectate">, now: number): readonly Outgoing[] => {
  if (findRoomOfConn(state, connId)) return error(connId, "badRequest");
  const room = state.rooms.get(m.code);
  if (!room) return error(connId, "notFound");
  if (room.spectators.length >= MAX_SPECTATORS) return error(connId, "spectatorsFull");
  const spectator: SpectatorRecord = { playerId: m.playerId, token: generateToken(state.config.rng), nickname: m.nickname, connId };
  const next = touch({ ...room, spectators: [...room.spectators, spectator] }, now);
  put(state, next);
  bind(state, connId, next.code);
  const effects: Outgoing[] = [joined(next, connId, null, spectator.token), ...broadcastState(next)];
  // 対戦中なら現在の状態を渡す
  if (next.engine && next.phase !== "open") effects.push(send(connId, { type: "conn.state", match: next.engine.match, seat: null }));
  return effects;
};

export const takeSeat = (state: ServerState, connId: ConnId, m: ClientMessageOf<"room.takeSeat">, now: number): readonly Outgoing[] => {
  const room = findRoomOfConn(state, connId);
  if (!room) return error(connId, "notFound");
  const spectator = room.spectators.find((s) => s.connId === connId);
  if (!spectator) return error(connId, "badRequest");
  if (room.phase !== "open") return error(connId, "inMatch");
  const seat = freeSeat(room);
  if (seat === null) return error(connId, "seatTaken");
  const member: Member = {
    seat,
    playerId: spectator.playerId,
    token: spectator.token,
    nickname: spectator.nickname,
    colors: m.colors,
    ready: false,
    joinOrder: room.joinCounter,
    connId,
    closedResult: false,
  };
  const next = touch(
    resetReady({ ...room, members: [...room.members, member], spectators: room.spectators.filter((s) => s !== spectator), joinCounter: room.joinCounter + 1 }),
    now,
  );
  put(state, next);
  return [joined(next, connId, seat, member.token), ...broadcastState(next)];
};

const updateMember = (room: RoomRecord, seat: Seat, patch: Partial<Member>): RoomRecord => ({
  ...room,
  members: room.members.map((m) => (m.seat === seat ? { ...m, ...patch } : m)),
});

export const ready = (state: ServerState, connId: ConnId, m: ClientMessageOf<"room.ready">, now: number): readonly Outgoing[] => {
  const room = findRoomOfConn(state, connId);
  const member = room ? memberByConn(room, connId) : undefined;
  if (!room || !member) return error(connId, "notMember");
  if (room.phase !== "open" || member.seat === room.ownerSeat) return error(connId, "badRequest");
  if (m.ready && toRoomState(room).members.some((x) => x.seat === member.seat && x.colorConflict)) return error(connId, "colorConflict");
  const next = touch(updateMember(room, member.seat, { ready: m.ready }), now);
  put(state, next);
  return broadcastState(next);
};

export const profile = (state: ServerState, connId: ConnId, m: ClientMessageOf<"room.profile">, now: number): readonly Outgoing[] => {
  const room = findRoomOfConn(state, connId);
  if (!room) return error(connId, "notMember");
  if (room.phase === "inMatch") return error(connId, "inMatch");
  const member = memberByConn(room, connId);
  if (!member) {
    const spectators = room.spectators.map((s) => (s.connId === connId ? { ...s, nickname: m.nickname } : s));
    const next = touch({ ...room, spectators }, now);
    put(state, next);
    return broadcastState(next);
  }
  const primaryChanged = member.colors.primary !== m.colors.primary;
  const updated = updateMember(room, member.seat, { nickname: m.nickname, colors: m.colors });
  // 主色が変わったら全員の ready を解除する。副色だけなら解除しない
  const next = touch(primaryChanged ? resetReady(updated) : updated, now);
  put(state, next);
  return broadcastState(next);
};

const ownerOnly = (state: ServerState, connId: ConnId): { room: RoomRecord } | { errors: readonly Outgoing[] } => {
  const room = findRoomOfConn(state, connId);
  const member = room ? memberByConn(room, connId) : undefined;
  if (!room || !member) return { errors: error(connId, "notMember") };
  if (member.seat !== room.ownerSeat) return { errors: error(connId, "notOwner") };
  return { room };
};

export const setMap = (state: ServerState, connId: ConnId, m: ClientMessageOf<"room.setMap">, now: number): readonly Outgoing[] => {
  const r = ownerOnly(state, connId);
  if ("errors" in r) return r.errors;
  if (r.room.phase !== "open") return error(connId, "inMatch");
  const next = touch(resetReady({ ...r.room, mapName: m.mapName }), now);
  put(state, next);
  return broadcastState(next);
};

export const kick = (state: ServerState, connId: ConnId, m: ClientMessageOf<"room.kick">, now: number): readonly Outgoing[] => {
  const r = ownerOnly(state, connId);
  if ("errors" in r) return r.errors;
  if (r.room.phase === "inMatch") return error(connId, "inMatch");
  const target = r.room.members.find((x) => x.seat === m.seat);
  if (!target || target.seat === r.room.ownerSeat) return error(connId, "badRequest");
  const next = touch(resetReady({ ...r.room, members: r.room.members.filter((x) => x.seat !== target.seat) }), now);
  put(state, next);
  const effects: Outgoing[] = [];
  if (target.connId) {
    bind(state, target.connId, null);
    effects.push(send(target.connId, { type: "room.closed", reason: "kicked" }));
  }
  return [...effects, ...broadcastState(next)];
};

export const start = (state: ServerState, connId: ConnId, now: number): readonly Outgoing[] => {
  const r = ownerOnly(state, connId);
  if ("errors" in r) return r.errors;
  if (!canStart(r.room)) return error(connId, "notReady");
  const step = startMatch(state, r.room, now);
  put(state, step.room);
  return step.effects;
};

/** 参加者か観戦者を部屋から外す。対戦中の参加者は降参扱い。誰もいなくなれば部屋を消す */
export const removeFromRoom = (state: ServerState, room: RoomRecord, connId: ConnId, now: number): readonly Outgoing[] => {
  const member = memberByConn(room, connId);
  let current = room;
  const effects: Outgoing[] = [];
  if (member) {
    if (current.phase === "inMatch") {
      const step = dispatchEngine(current, { type: "surrender", seat: member.seat }, now);
      current = step.room;
      effects.push(...step.effects);
    }
    const remaining = current.members.filter((x) => x.seat !== member.seat);
    if (remaining.length === 0) {
      effects.push(...closeRoom(state, { ...current, members: [] }, "dissolved"));
      bind(state, connId, null);
      return effects;
    }
    // オーナーが抜けたら、入室が最も早い参加者に移す
    const ownerSeat = member.seat === current.ownerSeat ? [...remaining].sort((a, b) => a.joinOrder - b.joinOrder)[0]?.seat ?? current.ownerSeat : current.ownerSeat;
    current = touch(resetReady({ ...current, members: remaining, ownerSeat }), now);
  } else {
    current = touch({ ...current, spectators: current.spectators.filter((s) => s.connId !== connId) }, now);
  }
  bind(state, connId, null);
  put(state, current);
  return [...effects, ...broadcastState(current)];
};

export const leave = (state: ServerState, connId: ConnId, now: number): readonly Outgoing[] => {
  const room = findRoomOfConn(state, connId);
  if (!room) return [];
  return removeFromRoom(state, room, connId, now);
};

export const dissolve = (state: ServerState, connId: ConnId, now: number): readonly Outgoing[] => {
  const r = ownerOnly(state, connId);
  if ("errors" in r) return r.errors;
  const effects: Outgoing[] = [];
  let room = r.room;
  if (room.phase === "inMatch") {
    const step = dispatchEngine(room, { type: "dissolve" }, now);
    room = step.room;
    effects.push(...step.effects);
  }
  return [...effects, ...closeRoom(state, room, "dissolved")];
};
