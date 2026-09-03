import { LOBBY_PAGE_SIZE, type LobbyRoom, type ServerMessageOf } from "@game/protocol";
import type { LobbyQuery, RoomRecord } from "./state.js";

// 公開部屋の一覧。設計書 09 の 9.3。募集中を先に、次に対戦中。同じ状態では作成が新しい順。

const phaseRank = (phase: RoomRecord["phase"]): number => (phase === "open" ? 0 : phase === "inMatch" ? 1 : 2);

const matches = (room: RoomRecord, query: LobbyQuery): boolean => {
  if (!room.isPublic) return false;
  if (query.phase === "open" && room.phase !== "open") return false;
  if (query.phase === "inMatch" && room.phase !== "inMatch") return false;
  if (query.mapName !== null && room.mapName !== query.mapName) return false;
  const q = query.search.trim().toLowerCase();
  return q.length === 0 || room.title.toLowerCase().includes(q);
};

const toRow = (room: RoomRecord): LobbyRoom => ({
  code: room.code,
  title: room.title,
  mapName: room.mapName,
  players: room.members.length,
  maxPlayers: 2,
  spectators: room.spectators.length,
  phase: room.phase,
});

export const lobbyPage = (rooms: Iterable<RoomRecord>, query: LobbyQuery): ServerMessageOf<"lobby.page"> => {
  const all = [...rooms]
    .filter((r) => matches(r, query))
    .sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase) || b.createdAt - a.createdAt);
  const start = query.page * LOBBY_PAGE_SIZE;
  return {
    type: "lobby.page",
    rooms: all.slice(start, start + LOBBY_PAGE_SIZE).map(toRow),
    total: all.length,
    page: query.page,
    pageSize: LOBBY_PAGE_SIZE,
  };
};
