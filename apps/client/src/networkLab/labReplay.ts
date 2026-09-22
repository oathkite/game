import { shotFlashes, type ShotFlash } from "@/game/muzzlePose";
import { shotRecoil } from "@/game/shotRecoil";
import { CARVE_AT_MS, hpBarAt, IMPACT_TOTAL_MS, impactClock, missMarkAt, type HpBar, type MissMark } from "@/game/hitFeedback";
import { trailDots, type TrailDot } from "@/game/trail";
import type { LabFrame } from "@game/protocol/v2-lab";
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
type Replay = NonNullable<LabFrame["replay"]>;
type Path = Replay["paths"][number];
/** サーバーの位置列は 4 ステップおき。軌跡はその 1 点おきに描き、新しい 5 点（約 20 ステップ）を明るくする */
const TRAIL_RECENT_POINTS = 5;

/** 着弾 1 つの演出。clock は着弾からの時刻を hitFeedback の時間の流れに換算した値（設計書 38 の E1） */
export type LabEffect = {
  readonly key: string;
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly clock: number;
  /** この着弾で最も大きいダメージ */
  readonly damage: number;
  readonly damages: readonly { readonly playerId: string; readonly amount: number }[];
};

const projectileAt = (path: Path, tick: number) => {
  if (tick < path.launchTick || tick >= path.endTick || !path.points.length) return [];
  const right = path.points.findIndex(p => p.tick > tick);
  const a = path.points[right < 0 ? path.points.length - 1 : Math.max(0, right - 1)]!;
  const b = right < 0 ? a : path.points[right]!;
  const t = b.tick === a.tick ? 0 : Math.max(0, (tick - a.tick) / (b.tick - a.tick));
  const heading = right < 0 ? path.points[Math.max(0, path.points.length - 2)]! : a;
  return [{ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - heading.y, b.x - heading.x) }];
};

/** 飛んでいる弾道の軌跡。着弾か終わりを過ぎたら空 */
const trailAt = (path: Path, tick: number): readonly TrailDot[] => {
  if (tick < path.launchTick || tick >= path.endTick) return [];
  const passed = path.points.filter(p => p.tick <= tick);
  return trailDots(passed, passed.length - 1, 1, TRAIL_RECENT_POINTS);
};

type Timeline = { readonly replay: Replay; readonly settleAt: number; readonly now: number };
const timeOf = (line: Timeline, tick: number): number => line.replay.startsAt + tick / Math.max(1, line.replay.ticks) * (line.settleAt - line.replay.startsAt);
const clockOf = (line: Timeline, at: number): number => impactClock(line.now - at, line.replay.endsAt - at);

const effectsAt = (frame: LabFrame, line: Timeline): readonly LabEffect[] => line.replay.impacts.flatMap((impact, index) => {
  const at = timeOf(line, impact.tick), op = frame.terrainOps[line.replay.terrainOpsBefore + index];
  const clock = clockOf(line, at);
  if (line.now < at || clock >= IMPACT_TOTAL_MS || !op) return [];
  const damages = impact.damage.filter(d => d.amount > 0);
  return [{ key: String(index), cx: op.cx, cy: op.cy, radius: op.radius, clock, damage: Math.max(0, ...damages.map(d => d.amount)), damages }];
});

/** 被弾した機体の HP バー。最後に当たった着弾から、減る前の値を後の値へ減らしていく */
const hpBarsAt = (line: Timeline): Readonly<Record<string, HpBar>> => {
  const bars: Record<string, HpBar> = {};
  for (const before of line.replay.playersBefore) {
    let hp = before.hp, last: { at: number; before: number; after: number } | null = null;
    for (const impact of line.replay.impacts) {
      const at = timeOf(line, impact.tick), amount = impact.damage.find(d => d.playerId === before.playerId)?.amount ?? 0;
      if (at > line.now) break;
      if (amount > 0) last = { at, before: hp, after: hp - amount };
      hp -= amount;
    }
    if (last) bars[before.playerId] = hpBarAt(clockOf(line, last.at) - CARVE_AT_MS, last.before, last.after);
  }
  return bars;
};

/** マップの外へ出た弾道の、端に寄せた外れの印 */
const missesAt = (frame: LabFrame, line: Timeline): readonly (MissMark & { readonly key: string })[] => line.replay.paths.flatMap((path, index) => {
  const last = path.points[path.points.length - 1];
  if (!last || (last.x >= 0 && last.x < frame.map.width && last.y < frame.map.height)) return [];
  const mark = missMarkAt(line.now - timeOf(line, path.endTick), { x: Math.floor(last.x), y: Math.floor(last.y) }, frame.map);
  return mark ? [{ ...mark, key: `miss/${index}` }] : [];
});

const idle = (frame: LabFrame) => ({ players: frame.players, terrainOps: frame.terrainOps, bullets: [], trails: [] as readonly (readonly TrailDot[])[], effects: [] as readonly LabEffect[], hpBars: {} as Readonly<Record<string, HpBar>>, misses: [] as readonly (MissMark & { readonly key: string })[], fallingIds: [] as string[], recoil: 0, shotFlashes: [] as readonly ShotFlash[] });

/** Replay server ticks at a shared pace, retaining a final 300ms settling window. */
export const presentLabReplay = (frame: LabFrame, now: number) => {
  const replay = frame.replay;
  if (frame.phase !== "replaying" || !replay || now >= replay.endsAt) return idle(frame);
  const damageReadMs = replay.impacts.some(i => i.damage.some(d => d.amount > 0)) ? 1300 : 0;
  const settleAt = replay.endsAt - 300 - damageReadMs;
  const line: Timeline = { replay, settleAt, now };
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
  const fallingIds = now >= settleAt && now < settleAt + 300 ? replay.playersBefore.filter(before => (frame.players.find(p => p.playerId === before.playerId)?.y ?? before.y) > before.y).map(p => p.playerId) : [];
  const launches = replay.paths.map(path => timeOf(line, path.launchTick));
  const flying = now < settleAt;
  return { players, effects: effectsAt(frame, line), hpBars: hpBarsAt(line), misses: missesAt(frame, line), fallingIds, shotFlashes: shotFlashes(now, launches), recoil: shotRecoil(now, launches),
    bullets: flying ? replay.paths.flatMap(path => projectileAt(path, tick)) : [], trails: flying ? replay.paths.map(path => trailAt(path, tick)) : [],
    terrainOps: frame.terrainOps.slice(0, replay.terrainOpsBefore + impacts.length) };
};
