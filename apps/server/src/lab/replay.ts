import type { BattleSession } from "@game/engine/multiplayer";
import type { LabFrame } from "@game/protocol/v2-lab";
import { ONE, type TimedProjectilePath } from "@game/sim";

const pathPoints = (path: TimedProjectilePath) => path.points.flatMap((point, i) => {
  const isImpact = path.impactAt.includes(i);
  if (i % 4 !== 0 && i !== path.points.length - 1 && !isImpact) return [];
  const tick = path.pointTicks[i]!, next = path.pointTicks[i + 1];
  const position = { x: point.x / ONE, y: point.y / ONE };
  // Keep penetration's pause at the impact position, even after downsampling.
  return isImpact && next !== undefined && next > tick + 1
    ? [{ ...position, tick }, { ...position, tick: next - 1 }] : [{ ...position, tick }];
});
export const replayFrame = (state: BattleSession): LabFrame["replay"] => {
  const replay = state.replay;
  if (!replay) return null;
  const { shot } = replay, fire = state.lastFire!;
  return { startsAt: replay.startsAt, endsAt: replay.endsAt, ticks: shot.ticks,
    terrainOpsBefore: state.terrainOps.length - shot.impacts.length,
    playersBefore: replay.playersBefore.map(p => ({ ...p, teamId: state.roster.members.find(m => m.playerId === p.playerId)!.teamId, eliminated: replay.eliminatedBefore.includes(p.playerId) })),
    shooter: { playerId: fire.playerId, facing: fire.command.facing, elevation: fire.command.elevation, weapon: fire.command.slot === 0 ? "cannon" : "digger" },
    impacts: shot.impacts.map(i => ({ tick: i.tick, damage: i.damage })),
    paths: shot.paths.map((p, index) => ({ launchTick: p.launchTick,
      endTick: Math.max(p.pointTicks.at(-1) ?? p.launchTick, ...shot.impacts.filter(i => i.projectile === index).map(i => i.tick)),
      points: pathPoints(p) })) };
};
