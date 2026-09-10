import { upcomingPlayers, movementSnapshot } from "@game/engine/multiplayer";
import type { LabFrame } from "@game/protocol/v2-lab";
import type { RoomState } from "./core.js";
import { replayFrame } from "../lab/replay.js";
export const battleFrame = (room: RoomState, now: number): LabFrame => {
  const state = room.battle!;
  return { ...(state.phase === "finished" ? { returnStatus: { deadlineAt: (state.finishedAt ?? state.movement.deadlineAt) + 60000, readyIds: [...(room.returnReadyIds ?? [])] } } : {}), type: "lab.frame", ...(state.phase === "finished" && state.stats ? { stats: state.stats } : {}), build: state.build, serverTime: now, eventSeq: state.movement.eventSeq, matchId: state.matchId,
    turnId: state.roster.turnId, actorId: state.movement.playerId, upcomingPlayerIds: [...upcomingPlayers(state.roster)], deadlineAt: state.movement.deadlineAt,
    players: state.players.map(p => { const member = room.lobby!.members.find(m => m.playerId === p.playerId)!;
      return { ...p, teamId: member.teamId!, nickname: member.nickname, loadout: [...state.loadouts[p.playerId]!], eliminated: state.roster.eliminated.includes(p.playerId) }; }),
    movement: movementSnapshot(state.movement, now), phase: state.phase, result: state.result,
    terrainOps: [...state.terrainOps], wind: state.windState.value, map: state.map, replay: replayFrame(state) };
};
export const lobbyFrame = (room: RoomState) => ({ type: "room.snapshot", room: { ...room.lobby!, mode: room.mode, region: room.region } });
export const roomFrame = (room: RoomState, now: number) => room.battle ? battleFrame(room, now) : lobbyFrame(room);
