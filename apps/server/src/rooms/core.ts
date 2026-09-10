import { reportPlayer, REPORT_RETENTION_MS, type PlayerReport } from "./reports.js";
import { CLIENT_BUILD, compatibleBuild, type ClientBuild } from "@game/protocol/build";
import { MULTIPLAYER_MAPS } from "@game/maps";
import { createLobby, joinLobby, leaveLobby, setLobbyConnection, editLobby, startLobby, createPreparedSession,
  fireInSession, moveInSession, surrenderInSession, forfeitInSession, tickSession, type LobbyState, type BattleSession } from "@game/engine/multiplayer";
import { roomInputSchema, type RoomMode, type RoomRegion } from "@game/protocol/v2-rooms";

export type RoomSession = { readonly build: ClientBuild; readonly role: "player" | "spectator"; readonly token: string; readonly playerId: string; readonly connectionId: string | null; readonly disconnectedAt: number; readonly generation: number };
export type RoomState = { readonly reports: readonly PlayerReport[]; readonly mode: RoomMode; readonly region: RoomRegion; readonly roomId: string; readonly lobby: LobbyState | null; readonly battle: BattleSession | null; readonly sessions: readonly RoomSession[] };
export type Identity = { readonly playerId: string; readonly token: string; readonly matchId: string; readonly seed: number };
type Input = ReturnType<typeof roomInputSchema.parse>;
export type RoomReply = { readonly state: RoomState; readonly reason: string; readonly welcome?: RoomSession; readonly ack?: boolean; readonly reported?: "saved" | "duplicate"; readonly close?: boolean };
export const createRoomState = (roomId: string, mode: RoomMode = "custom", region: RoomRegion = "asia"): RoomState => ({ roomId, mode, region, reports: [], lobby: null, battle: null, sessions: [] });
const reply = (state: RoomState, reason = "accepted"): RoomReply => ({ state, reason });
const connectedOwner = (state: RoomState): RoomState => {
  if (!state.lobby || state.sessions.some(s => s.playerId === state.lobby!.ownerId && s.connectionId && s.role === "player")) return state;
  const ownerId = state.sessions.find(s => s.connectionId && s.role === "player")?.playerId ?? null;
  return ownerId === state.lobby.ownerId ? state : { ...state, lobby: { ...state.lobby, ownerId } };
};
const leave = (state: RoomState, playerId: string, now: number): RoomState => connectedOwner({ ...state,
  sessions: state.sessions.filter(s => s.playerId !== playerId),
  lobby: state.lobby && !state.battle ? leaveLobby(state.lobby, playerId) : state.lobby,
  battle: state.battle ? surrenderInSession(state.battle, playerId, now) : null,
});
export const disconnectRoom = (state: RoomState, connectionId: string, now: number): RoomState => {
  const session = state.sessions.find(s => s.connectionId === connectionId);
  if (!session) return state;
  return connectedOwner({ ...state,
    sessions: state.sessions.map(s => s === session ? { ...s, connectionId: null, disconnectedAt: now } : s),
    lobby: state.lobby && !state.battle ? setLobbyConnection(state.lobby, session.playerId, false) : state.lobby,
  });
};
export const tickRoom = (state: RoomState, now: number): RoomState => {
  const expired = state.sessions.filter(s => !s.connectionId && now - s.disconnectedAt >= 60000);
  const battle = state.battle ? tickSession(forfeitInSession(state.battle, expired.map(s => s.playerId), now), now) : null;
  const reports = state.reports.filter(report => now < report.createdAt + REPORT_RETENTION_MS);
  const next = battle === state.battle && reports.length === state.reports.length ? state : { ...state, battle, reports };
  return expired.reduce((room, s) => leave(room, s.playerId, now), next);
};
export const nextRoomDeadline = (state: { readonly reports?: readonly PlayerReport[]; readonly sessions: readonly RoomSession[]; readonly battle: { readonly phase: string; readonly movement: { readonly deadlineAt: number }; readonly replay: { readonly endsAt: number } | null } | null }): number | null => {
  const deadlines = state.sessions.filter(s => !s.connectionId).map(s => s.disconnectedAt + 60000);
  if (state.reports?.length) deadlines.push(...state.reports.map(report => report.createdAt + REPORT_RETENTION_MS));
  if (state.battle?.phase === "acting") deadlines.push(state.battle.movement.deadlineAt);
  if (state.battle?.phase === "replaying") deadlines.push(state.battle.replay!.endsAt);
  return deadlines.length ? Math.min(...deadlines) : null;
};
const join = (state: RoomState, connectionId: string, message: Extract<Input, { type: "room.create" | "room.join" | "room.resume" | "room.spectate" | "room.quick" }>, now: number, id: Identity): RoomReply => {
  if (!compatibleBuild(message.build)) return reply(state, "version-mismatch");
  if (state.sessions.some(s => s.connectionId === connectionId)) return reply(state, "already-joined");
  if (message.type === "room.resume") {
    const saved = state.sessions.find(s => s.token === message.token);
    if (!saved || saved.connectionId || now - saved.disconnectedAt >= 60000) return reply(state, "invalid-session");
    if (!compatibleBuild(saved.build)) return reply(state, "version-mismatch");
    const welcome = { ...saved, connectionId, generation: saved.generation + 1 };
    const next = connectedOwner({ ...state, sessions: state.sessions.map(s => s === saved ? welcome : s),
      lobby: state.lobby && !state.battle ? setLobbyConnection(state.lobby, saved.playerId, true) : state.lobby });
    return { state: next, reason: "accepted", welcome };
  }
  if ((message.type === "room.join" || message.type === "room.spectate") && message.roomId !== state.roomId) return reply(state, "wrong-room");
  if ((message.type === "room.join" || message.type === "room.spectate") && !state.lobby) return reply(state, "not-found");
  if (message.type === "room.quick" && (message.roomId !== state.roomId || message.mode !== state.mode || message.region !== state.region)) return reply(state, "wrong-mode");
  if (message.type === "room.create" && state.mode !== "custom") return reply(state, "wrong-mode");
  if (message.type === "room.create" && state.lobby) return reply(state, "already-exists");
  if (message.type === "room.spectate") {
    if (state.sessions.filter(s => s.role === "spectator").length >= 8) return reply(state, "spectators-full");
    const welcome: RoomSession = { build: { ...CLIENT_BUILD }, role: "spectator", token: id.token, playerId: id.playerId, connectionId, generation: 1, disconnectedAt: 0 };
    return { state: { ...state, sessions: [...state.sessions, welcome] }, reason: "accepted", welcome };
  }
  if (state.battle) return reply(state, "locked");
  if (state.sessions.filter(s => s.role === "player").length >= (state.mode === "1v1" ? 2 : state.mode === "2v2" ? 4 : 8)) return reply(state, "full");
  let lobby = state.lobby ? joinLobby(state.lobby, id.playerId, message.profile) : createLobby(state.roomId, id.playerId, message.profile, MULTIPLAYER_MAPS[0]!);
  if (state.mode !== "custom") {
    const count = (team: string) => lobby.members.filter(p => p.teamId === team).length;
    lobby = editLobby(lobby, id.playerId, { version: 2, type: "room.assignTeam", roomId: state.roomId, revision: lobby.revision,
      playerId: id.playerId, teamId: count("t0") <= count("t1") ? "t0" : "t1" }).room;
  }
  const welcome: RoomSession = { build: { ...CLIENT_BUILD }, role: "player", token: id.token, playerId: id.playerId, connectionId, generation: 1, disconnectedAt: 0 };
  return { state: { ...state, lobby, sessions: [...state.sessions, welcome] }, reason: "accepted", welcome };
};
const battleCommand = (state: RoomState, playerId: string, message: Input, now: number): RoomReply => {
  const battle = state.battle;
  if (!battle) return reply(state, "not-started");
  if (message.type === "lab.rematch") {
    if (battle.phase !== "finished" || message.matchId !== battle.matchId || state.lobby!.ownerId !== playerId) return reply(state, "not-owner-or-not-finished");
    let lobby: LobbyState = { ...state.lobby!, phase: "waiting", revision: state.lobby!.revision + 1,
      members: state.lobby!.members.filter(p => state.sessions.some(s => s.playerId === p.playerId)).map(p => ({ ...p, ready: false })) };
    for (const s of state.sessions) lobby = setLobbyConnection(lobby, s.playerId, s.connectionId !== null);
    return reply({ ...state, lobby, battle: null });
  }
  if (message.type === "lab.surrender") return message.matchId !== battle.matchId ? reply(state, "wrong-match") : reply({ ...state, battle: surrenderInSession(battle, playerId, now) });
  if (message.type === "turn.fire" || message.type === "move.command") {
    const result = message.type === "turn.fire" ? fireInSession(battle, playerId, message, now) : moveInSession(battle, playerId, message, now);
    return { state: result.state === battle ? state : { ...state, battle: result.state }, reason: result.reason, ack: true };
  }
  return reply(state, "invalid");
};
export const reduceRoom = (state: RoomState, connectionId: string, raw: unknown, now: number, id: Identity): RoomReply => {
  const parsed = roomInputSchema.safeParse(raw);
  if (!parsed.success || !Number.isFinite(now)) return reply(state, "invalid");
  const message = parsed.data;
  if (message.type === "room.create" || message.type === "room.join" || message.type === "room.resume" || message.type === "room.spectate" || message.type === "room.quick") return join(state, connectionId, message, now, id);
  const session = state.sessions.find(s => s.connectionId === connectionId);
  if (!session) return reply(state, "join-required");
  if (!compatibleBuild(session.build)) return reply(state, "version-mismatch");
  if (message.type === "room.leave") return { state: leave(state, session.playerId, now), reason: "accepted", close: true };
  if (message.type === "room.report") return reportPlayer(state, session.playerId, message, now);
  if (session.role === "spectator") return reply(state, "read-only");
  if ("roomId" in message && message.roomId !== state.roomId) return reply(state, "wrong-room");
  if (state.mode !== "custom" && (message.type === "room.assignTeam" || message.type === "room.map")) return reply(state, "fixed-mode");
  if (message.type === "room.start") {
    if (state.mode !== "custom" && state.lobby!.members.length !== (state.mode === "1v1" ? 2 : 4)) return reply(state, "waiting-for-players");
    const result = startLobby(state.lobby!, session.playerId, message.revision);
    return result.setup ? reply({ ...state, lobby: result.room, battle: createPreparedSession(result.setup, id.matchId, id.seed, now) }) : reply(state, result.reason);
  }
  if (message.type.startsWith("room.")) {
    const result = editLobby(state.lobby!, session.playerId, message);
    if (message.type === "room.ready" && state.mode !== "custom" && result.room.members.length === (state.mode === "1v1" ? 2 : 4)) {
      const started = startLobby(result.room, result.room.ownerId!, result.room.revision);
      if (started.setup) return reply({ ...state, lobby: started.room, battle: createPreparedSession(started.setup, id.matchId, id.seed, now) });
    }
    return reply(result.room === state.lobby ? state : { ...state, lobby: result.room }, result.reason);
  }
  return battleCommand(state, session.playerId, message, now);
};
