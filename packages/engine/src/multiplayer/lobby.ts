import { CLIENT_BUILD } from "@game/protocol/build";
import type { Loadout } from "@game/protocol";
import { lobbyCommandSchema, lobbyProfileSchema } from "@game/protocol/v2";
import { multiplayerMap, buildMapSpec, type MapSpec } from "@game/maps";

export const RULE_SET_VERSION = CLIENT_BUILD.rules;
export type LobbyProfile = { readonly nickname: string; readonly loadout: Loadout };
export type LobbyMember = LobbyProfile & {
  readonly playerId: string; readonly teamId: string | null; readonly connected: boolean; readonly ready: boolean;
};
export type LobbyState = {
  readonly roomId: string; readonly ownerId: string | null; readonly revision: number;
  readonly phase: "waiting" | "started"; readonly members: readonly LobbyMember[]; readonly map: MapSpec;
};
export type PreparedMatch = {
  readonly roomId: string; readonly revision: number; readonly ruleSetVersion: typeof RULE_SET_VERSION;
  readonly members: readonly (LobbyProfile & { readonly playerId: string; readonly teamId: string })[];
  readonly map: MapSpec;
};
const copyMap = (map: MapSpec): MapSpec => ({ ...map, surface: [...map.surface],
  spawns: Object.fromEntries(Object.entries(map.spawns).map(([count, xs]) => [count, [...xs!]])) });
const memberOf = (playerId: string, raw: LobbyProfile): LobbyMember => {
  if (!playerId.trim()) throw new Error("invalid player");
  const profile = lobbyProfileSchema.parse(raw);
  return { ...profile, playerId, teamId: null, ready: false, connected: true };
};
export const createLobby = (roomId: string, ownerId: string, profile: LobbyProfile, map: MapSpec): LobbyState => {
  if (!roomId.trim()) throw new Error("invalid room");
  return { roomId, ownerId, revision: 1, phase: "waiting", members: [memberOf(ownerId, profile)], map: copyMap(map) };
};
const changed = (room: LobbyState, members: readonly LobbyMember[]): LobbyState => ({ ...room,
  revision: room.revision + 1, members: members.map(p => ({ ...p, ready: false })),
  ownerId: members.some(p => p.playerId === room.ownerId && p.connected) ? room.ownerId : members.find(p => p.connected)?.playerId ?? null });
export const joinLobby = (room: LobbyState, playerId: string, profile: LobbyProfile): LobbyState => {
  if (room.phase !== "waiting") throw new Error("locked");
  if (room.members.some(p => p.playerId === playerId)) throw new Error("already joined");
  if (room.members.length >= 8) throw new Error("full");
  return changed(room, [...room.members, memberOf(playerId, profile)]);
};
/** Match departures are handled by battle surrender, never by editing a frozen roster. */
export const leaveLobby = (room: LobbyState, playerId: string): LobbyState => {
  if (room.phase !== "waiting") throw new Error("locked");
  return room.members.some(p => p.playerId === playerId) ? changed(room, room.members.filter(p => p.playerId !== playerId)) : room;
};
export const setLobbyConnection = (room: LobbyState, playerId: string, connected: boolean): LobbyState => {
  if (room.phase !== "waiting") throw new Error("locked");
  const player = room.members.find(p => p.playerId === playerId);
  if (!player || player.connected === connected) return room;
  return changed(room, room.members.map(p => p === player ? { ...p, connected } : p));
};
export const editLobby = (room: LobbyState, authenticatedId: string, raw: unknown) => {
  const reject = (reason: string) => ({ room, reason });
  const parsed = lobbyCommandSchema.safeParse(raw);
  if (!parsed.success) return reject("invalid");
  const command = parsed.data;
  if (command.roomId !== room.roomId) return reject("wrong-room");
  const actor = room.members.find(p => p.playerId === authenticatedId);
  if (!actor) return reject("not-member");
  if (!actor.connected) return reject("disconnected");
  if (room.phase !== "waiting") return reject("locked");
  if (command.revision !== room.revision) return reject("stale-revision");
  if (command.type === "room.map") {
    if (room.ownerId !== authenticatedId) return reject("not-owner");
    const map = multiplayerMap(command.mapId);
    if (!map) return reject("unsupported-map");
    if (map.id === room.map.id && map.version === room.map.version) return reject("unchanged");
    return { room: { ...changed(room, room.members), map: copyMap(map) }, reason: "accepted" };
  }
  if (command.type === "room.ready") return { room: { ...room, members: room.members.map(p => p === actor ? { ...p, ready: command.ready } : p) }, reason: "accepted" };
  if (command.type === "room.profile") return { room: { ...room, members: room.members.map(p => p === actor ? { ...p, nickname: command.nickname } : p) }, reason: "accepted" };
  if (command.type === "room.loadout") {
    if (actor.loadout.every((weapon, i) => weapon === command.loadout[i])) return reject("unchanged");
    return { room: changed(room, room.members.map(p => p === actor ? { ...p, loadout: command.loadout } : p)), reason: "accepted" };
  }
  if (command.playerId !== authenticatedId && room.ownerId !== authenticatedId) return reject("not-owner");
  const target = room.members.find(p => p.playerId === command.playerId);
  if (!target) return reject("not-member");
  if (target.teamId === command.teamId) return reject("unchanged");
  return { room: changed(room, room.members.map(p => p === target ? { ...p, teamId: command.teamId } : p)), reason: "accepted" };
};
export const startLobby = (room: LobbyState, authenticatedId: string, revision: number): { room: LobbyState; reason: string; setup?: PreparedMatch } => {
  const reject = (reason: string) => ({ room, reason });
  if (room.ownerId !== authenticatedId) return reject("not-owner");
  if (room.phase !== "waiting") return reject("locked");
  if (revision !== room.revision) return reject("stale-revision");
  if (room.members.length < 2) return reject("not-enough-players");
  if (room.members.some(p => !p.connected)) return reject("disconnected");
  if (room.members.some(p => p.teamId === null)) return reject("unassigned");
  if (new Set(room.members.map(p => p.teamId)).size < 2) return reject("not-enough-teams");
  if (room.members.some(p => !p.ready)) return reject("not-ready");
  try { buildMapSpec(room.map, room.members.length); } catch { return reject("unsupported-map"); }
  return { room: { ...room, phase: "started" }, reason: "started", setup: {
    roomId: room.roomId, revision, ruleSetVersion: RULE_SET_VERSION, map: copyMap(room.map),
    members: room.members.map(p => ({ playerId: p.playerId, teamId: p.teamId!, nickname: p.nickname, loadout: [...p.loadout] })) } };
};
