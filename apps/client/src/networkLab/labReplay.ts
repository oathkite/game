import type { LabFrame } from "@game/protocol/v2-lab";
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
/** The lab's fixed cannon/digger loadout has one flight and one impact. */
export const presentLabReplay = (frame: LabFrame, now: number) => {
  const replay = frame.replay;
  if (frame.phase !== "replaying" || !replay || now >= replay.endsAt) return { players: frame.players, terrainOps: frame.terrainOps, bullets: [] };
  const impactAt = replay.endsAt - 300;
  const t = Math.max(0, Math.min(1, (now - replay.startsAt) / Math.max(1, impactAt - replay.startsAt)));
  const fall = smooth(Math.max(0, Math.min(1, (now - impactAt) / 300)));
  const players = replay.playersBefore.map(before => {
    const after = frame.players.find(p => p.playerId === before.playerId)!;
    return now < impactAt ? before : { ...after, x: before.x + (after.x - before.x) * fall, y: before.y + (after.y - before.y) * fall };
  });
  const bullets = now >= impactAt ? [] : replay.paths.flatMap(path => {
    if (!path.length) return [];
    const index = t * (path.length - 1), left = Math.floor(index), a = path[left]!, b = path[Math.min(left + 1, path.length - 1)]!;
    return [{ x: a.x + (b.x - a.x) * (index - left), y: a.y + (b.y - a.y) * (index - left) }];
  });
  return { players, bullets, terrainOps: now < impactAt ? frame.terrainOps.slice(0, replay.terrainOpsBefore) : frame.terrainOps };
};
