import { shotRecoil } from "@/game/shotRecoil";
import type { LabFrame } from "@game/protocol/v2-lab";
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
type Replay = NonNullable<LabFrame["replay"]>;
const projectileAt = (path: Replay["paths"][number], tick: number) => {
  if (tick < path.launchTick || tick >= path.endTick || !path.points.length) return [];
  const right = path.points.findIndex(p => p.tick > tick);
  const a = path.points[right < 0 ? path.points.length - 1 : Math.max(0, right - 1)]!;
  const b = right < 0 ? a : path.points[right]!;
  const t = b.tick === a.tick ? 0 : Math.max(0, (tick - a.tick) / (b.tick - a.tick));
  const heading = right < 0 ? path.points[Math.max(0, path.points.length - 2)]! : a;
  return [{ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - heading.y, b.x - heading.x) }];
};
/** Replay server ticks at a shared pace, retaining a final 300ms settling window. */
export const presentLabReplay = (frame: LabFrame, now: number) => {
  const replay = frame.replay;
  if (frame.phase !== "replaying" || !replay || now >= replay.endsAt) return { players: frame.players, terrainOps: frame.terrainOps, bullets: [], effects: [], fallingIds: [] as string[], recoil: 0 };
  const settleAt = replay.endsAt - 300;
  const t = Math.max(0, Math.min(1, (now - replay.startsAt) / Math.max(1, settleAt - replay.startsAt)));
  const tick = t * replay.ticks;
  const impacts = replay.impacts.filter(i => i.tick <= tick);
  const fall = smooth(Math.max(0, Math.min(1, (now - settleAt) / 300)));
  const players = replay.playersBefore.map(before => {
    const after = frame.players.find(p => p.playerId === before.playerId)!;
    if (now >= settleAt) return { ...after, x: before.x + (after.x - before.x) * fall, y: before.y + (after.y - before.y) * fall };
    const hp = before.hp - impacts.reduce((sum, impact) => sum + (impact.damage.find(d => d.playerId === before.playerId)?.amount ?? 0), 0);
    return { ...before, hp, eliminated: before.eliminated || hp <= 0 };
  });
  const effects = replay.impacts.flatMap((impact, index) => {
    const at = replay.startsAt + impact.tick / Math.max(1, replay.ticks) * (settleAt - replay.startsAt);
    const age = now - at, op = frame.terrainOps[replay.terrainOpsBefore + index];
    return age >= 0 && age < 300 && op ? [{ ...op, frame: Math.min(3, Math.floor(age / 75)), hitIds: age < 150 ? impact.damage.filter(damage => damage.amount > 0).map(damage => damage.playerId) : [] }] : [];
  });
  const fallingIds = now >= settleAt ? replay.playersBefore.filter(before => (frame.players.find(p => p.playerId === before.playerId)?.y ?? before.y) > before.y).map(p => p.playerId) : [];
  const launches = replay.paths.map(path => replay.startsAt + path.launchTick / Math.max(1, replay.ticks) * (settleAt - replay.startsAt));
  return { players, effects, fallingIds, recoil: shotRecoil(now, launches), bullets: now >= settleAt ? [] : replay.paths.flatMap(path => projectileAt(path, tick)),
    terrainOps: frame.terrainOps.slice(0, replay.terrainOpsBefore + impacts.length) };
};
