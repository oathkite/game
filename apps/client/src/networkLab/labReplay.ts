import { shotFlashes, type ShotFlash } from "@/game/muzzlePose";
import { shotRecoil } from "@/game/shotRecoil";
import { CARVE_AT_MS, hitstopClock, hpBarAt, IMPACT_TOTAL_MS, missMarkAt, type HpBar, type MissMark } from "@/game/hitFeedback";
import { replayTailMs } from "@game/engine/replay-timing";
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
  /** この着弾で HP が 0 になった参加者（設計書 41.6 の全画面の光） */
  readonly kills: readonly string[];
  /** 最後の着弾で、その後に飛んでいる弾がない。削る瞬間にヒットストップを入れる */
  readonly final: boolean;
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

type Timeline = { readonly replay: Replay; readonly settleAt: number; readonly now: number; readonly freezeAt: number | null };
const timeOf = (line: Timeline, tick: number): number => line.replay.startsAt + tick / Math.max(1, line.replay.ticks) * (line.settleAt - line.replay.startsAt);
// 着弾の後には 1000 ms 以上残るので（設計書 41.8）、着弾の演出は縮めずに再生する
const clockOf = (line: Timeline, at: number): number => hitstopClock(line.now, line.freezeAt) - at;

/** 最後の着弾の添字。その後に飛んでいる弾があれば null */
const finalImpactOf = (replay: Replay): number | null => {
  if (replay.impacts.length === 0) return null;
  const index = replay.impacts.reduce((best, impact, i) => (impact.tick > replay.impacts[best]!.tick ? i : best), 0);
  return replay.paths.every(path => path.endTick <= replay.impacts[index]!.tick) ? index : null;
};

/** 着弾ごとに HP が 0 になった参加者 */
const killsOf = (replay: Replay): readonly (readonly string[])[] => {
  const hp = new Map(replay.playersBefore.map(p => [p.playerId, p.eliminated ? 0 : p.hp]));
  return replay.impacts.map(impact => impact.damage.flatMap(d => {
    const before = hp.get(d.playerId) ?? 0;
    hp.set(d.playerId, before - d.amount);
    return before > 0 && before - d.amount <= 0 ? [d.playerId] : [];
  }));
};

const effectsAt = (frame: LabFrame, line: Timeline): readonly LabEffect[] => {
  const final = finalImpactOf(line.replay), kills = killsOf(line.replay);
  return line.replay.impacts.flatMap((impact, index) => {
  const at = timeOf(line, impact.tick), op = frame.terrainOps[line.replay.terrainOpsBefore + index];
  const clock = clockOf(line, at);
  if (line.now < at || clock >= IMPACT_TOTAL_MS || !op) return [];
  const damages = impact.damage.filter(d => d.amount > 0);
  return [{ key: String(index), cx: op.cx, cy: op.cy, radius: op.radius, clock, damage: Math.max(0, ...damages.map(d => d.amount)), damages, kills: kills[index] ?? [], final: index === final }];
  });
};

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

/** 発射した弾道。砲口の位置、飛び出す向き、発射からの ms（設計書 41 の段階 4 の煙の輪） */
export type LabLaunch = { readonly key: string; readonly x: number; readonly y: number; readonly angle: number; readonly age: number;
  /** 弾道の点（セル、発射からの ms）。武器の軌跡の粒に使う（設計書 41 の段階 5） */
  readonly points: readonly { readonly x: number; readonly y: number; readonly at: number }[] };

const launchesAt = (line: Timeline): readonly LabLaunch[] => line.replay.paths.flatMap((path, index) => {
  const at = timeOf(line, path.launchTick), a = path.points[0], b = path.points[1] ?? a;
  if (!a || !b || line.now < at) return [];
  const points = path.points.map(p => ({ x: p.x, y: p.y, at: timeOf(line, p.tick) - at }));
  return [{ key: String(index), x: a.x, y: a.y, angle: Math.atan2(b.y - a.y, b.x - a.x), age: line.now - at, points }];
});

const FALL_MS = 300;
type Position = { readonly x: number; readonly y: number };
type Fall = { readonly at: number; readonly positions: ReadonlyMap<string, { readonly from: Position; readonly to: Position; readonly teleport: boolean }> };

/**
 * 機体が動く時刻と、動く前と後の位置。新しい順に並べる。
 * ダブルシュート（設計書 42.2）は 1 発目の後にも一度落とす。テレポートした機体は滑らせずに着地点へ移す（42.3）
 */
const fallsOf = (frame: LabFrame, replay: Replay, firstAt: number, settleAt: number): readonly Fall[] => {
  const mid = replay.firstShot, teleported = replay.teleport ? replay.shooter.playerId : null;
  const midOf = (id: string, before: Position): Position => mid?.players.find(p => p.playerId === id) ?? before;
  const last: Fall = { at: settleAt, positions: new Map(replay.playersBefore.map(before => {
    const after = frame.players.find(p => p.playerId === before.playerId)!, from = midOf(before.playerId, before);
    const teleport = before.playerId === teleported;
    return [before.playerId, { from: teleport ? after : from, to: after, teleport }];
  })) };
  if (!mid) return [last];
  return [last, { at: firstAt, positions: new Map(replay.playersBefore.map(before => [before.playerId, { from: before, to: midOf(before.playerId, before), teleport: false }])) }];
};

const idle = (frame: LabFrame) => ({ launches: [] as readonly LabLaunch[], players: frame.players, terrainOps: frame.terrainOps, bullets: [], trails: [] as readonly (readonly TrailDot[])[], effects: [] as readonly LabEffect[], hpBars: {} as Readonly<Record<string, HpBar>>, misses: [] as readonly (MissMark & { readonly key: string })[], fallingIds: [] as string[], recoil: 0, shotFlashes: [] as readonly ShotFlash[] });

/** Replay server ticks at a shared pace, retaining a final 300ms settling window. */
export const presentLabReplay = (frame: LabFrame, now: number, reduced = false) => {
  const replay = frame.replay;
  if (frame.phase !== "replaying" || !replay || now >= replay.endsAt) return idle(frame);
  // 飛翔の終わりはサーバーと同じ関数で逆算する（設計書 41.8）
  const settleAt = replay.endsAt - replayTailMs(replay.impacts);
  const base = { replay, settleAt, now, freezeAt: null };
  const final = finalImpactOf(replay);
  // 最後の着弾の削る瞬間から HITSTOP_MS だけ着弾の時計を止める。動きを減らす設定では止めない（設計書 41.6）
  const line: Timeline = { ...base, freezeAt: final === null || reduced ? null : timeOf(base, replay.impacts[final]!.tick) + CARVE_AT_MS };
  const t = Math.max(0, Math.min(1, (now - replay.startsAt) / Math.max(1, settleAt - replay.startsAt)));
  const tick = t * replay.ticks;
  const impacts = replay.impacts.filter(i => i.tick <= tick);
  const falls = fallsOf(frame, replay, timeOf(base, replay.firstShot?.tick ?? 0), settleAt);
  const players = replay.playersBefore.map(before => {
    const after = frame.players.find(p => p.playerId === before.playerId)!;
    const step = falls.find(f => now >= f.at), fall = step?.positions.get(before.playerId);
    const progress = step ? smooth(Math.max(0, Math.min(1, (now - step.at) / FALL_MS))) : 0;
    const pose = fall ? { x: fall.from.x + (fall.to.x - fall.from.x) * progress, y: fall.from.y + (fall.to.y - fall.from.y) * progress } : { x: before.x, y: before.y };
    if (now >= settleAt) return { ...after, ...pose };
    const hp = before.hp - impacts.reduce((sum, impact) => sum + (impact.damage.find(d => d.playerId === before.playerId)?.amount ?? 0), 0);
    return { ...before, ...pose, hp, eliminated: before.eliminated || hp <= 0 };
  });
  const fallingIds = falls.flatMap(f => now >= f.at && now < f.at + FALL_MS ? [...f.positions].filter(([, p]) => p.to.y > p.from.y && !p.teleport).map(([id]) => id) : []);
  const launches = replay.paths.map(path => timeOf(line, path.launchTick));
  const flying = now < settleAt;
  return { launches: launchesAt(line), players, effects: effectsAt(frame, line), hpBars: hpBarsAt(line), misses: missesAt(frame, line), fallingIds, shotFlashes: shotFlashes(now, launches), recoil: shotRecoil(now, launches),
    bullets: flying ? replay.paths.flatMap(path => projectileAt(path, tick)) : [], trails: flying ? replay.paths.map(path => trailAt(path, tick)) : [],
    terrainOps: frame.terrainOps.slice(0, replay.terrainOpsBefore + impacts.length) };
};
