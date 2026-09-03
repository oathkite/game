import { MAX_PLAYERS, MAX_SPECTATORS, type RoomState, type Seat, type ServerMessage } from "@game/protocol";
import type { ConnId, Member, Outgoing, RoomRecord, ServerState } from "../state.js";

// 部屋の内部記録から配信用の RoomState を作る補助と、宛先の解決。

/** 先にいる参加者（joinOrder が小さい）と主色が重なっているか */
export const hasColorConflict = (room: RoomRecord, member: Member): boolean =>
  room.members.some((m) => m.joinOrder < member.joinOrder && m.colors.primary === member.colors.primary);

export const toRoomState = (room: RoomRecord): RoomState => ({
  code: room.code,
  title: room.title,
  isPublic: room.isPublic,
  mapName: room.mapName,
  maxPlayers: MAX_PLAYERS,
  ownerSeat: room.ownerSeat,
  phase: room.phase,
  members: [...room.members]
    .sort((a, b) => a.seat - b.seat)
    .map((m) => ({
      seat: m.seat,
      playerId: m.playerId,
      nickname: m.nickname,
      colors: m.colors,
      ready: m.ready,
      colorConflict: hasColorConflict(room, m),
      joinOrder: m.joinOrder,
      connected: m.connId !== null,
    })),
  spectators: room.spectators.map((s) => ({ playerId: s.playerId, nickname: s.nickname })),
  maxSpectators: MAX_SPECTATORS,
});

export const send = (connId: ConnId, message: ServerMessage): Outgoing => ({ connId, message });

export const memberByConn = (room: RoomRecord, connId: ConnId): Member | undefined => room.members.find((m) => m.connId === connId);

export const memberBySeat = (room: RoomRecord, seat: Seat): Member | undefined => room.members.find((m) => m.seat === seat);

/** 接続中の全員（参加者と観戦者）の接続 ID */
export const connIdsOf = (room: RoomRecord): ConnId[] => [
  ...room.members.map((m) => m.connId).filter((c): c is ConnId => c !== null),
  ...room.spectators.map((s) => s.connId).filter((c): c is ConnId => c !== null),
];

export const broadcast = (room: RoomRecord, message: ServerMessage): Outgoing[] => connIdsOf(room).map((c) => send(c, message));

export const broadcastState = (room: RoomRecord): Outgoing[] => broadcast(room, { type: "room.state", room: toRoomState(room) });

export const findRoomOfConn = (state: ServerState, connId: ConnId): RoomRecord | undefined => {
  const code = state.connections.get(connId)?.roomCode;
  return code ? state.rooms.get(code) : undefined;
};

export const freeSeat = (room: RoomRecord): Seat | null => {
  if (!room.members.some((m) => m.seat === 0)) return 0;
  if (!room.members.some((m) => m.seat === 1)) return 1;
  return null;
};

export const resetReady = (room: RoomRecord): RoomRecord => ({ ...room, members: room.members.map((m) => ({ ...m, ready: false })) });

export const touch = (room: RoomRecord, now: number): RoomRecord => ({ ...room, lastActivityAt: now });

export const canStart = (room: RoomRecord): boolean =>
  room.phase === "open" &&
  room.members.length === MAX_PLAYERS &&
  room.members.every((m) => m.seat === room.ownerSeat || m.ready) &&
  room.members.every((m) => !hasColorConflict(room, m));
