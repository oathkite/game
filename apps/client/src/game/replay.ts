import type { CellPoint, Impact, Seat } from "@game/protocol";
import { carve, isRingOut, MAP_HEIGHT, ONE, tiltOf, weaponSpec, type ProjectilePath, type TerrainMask } from "@game/sim";
import type { SoundName } from "@/app/audio";
import type { PlayerView, ReplayJob } from "@/match/types";
import {
  blastFrameAt,
  CARVE_AT_MS,
  damageLabelText,
  damageSounds,
  damageTier,
  debrisAt,
  flashMsOf,
  hpBarAt,
  IMPACT_TOTAL_MS,
  impactTimeMs,
  launchDelayMs,
  MISS_MS,
  missMarkAt,
  projectileFrameAt,
  shakeOffsetAt,
  STEP_MS,
} from "./hitFeedback";
import type { ProjectileView } from "./projectileView";
import type { Renderer } from "./renderer";
import type { TankPose } from "./tankView";
import { trailStep } from "./weaponArt";

// 射撃結果の再生。設計書 03 の 3.9。弾道は 1 ステップ 1/60 秒で進め、着弾で弾を一瞬止め、爆風の膨張、地形の削り、落下を順に描く。
// 1 発の射撃に弾道は複数（扇）、着弾も複数（段）ありうる（設計書 10）。弾道はそれぞれの発射の遅れから、着弾はそれぞれの時刻から独立に演出し、
// 地形と HP は着弾が削れた順に積み上げる。着弾の時間の流れは hitFeedback.ts が決める。

export type ReplayCallbacks = {
  readonly sound: (name: SoundName) => void;
  readonly done: () => void;
  /** 利用者が動きを減らす設定にしている。画面揺れを出さない */
  readonly reduceMotion: boolean;
};

/** 落下の速さ（セル/秒） */
const FALL_CELLS_PER_S = 90;

type Fall = { readonly seat: Seat; readonly from: number; readonly to: number };

type Phase = "shot" | "fall" | "done";

/** HP バーの減り。減る前の値から後の値へ、at から減らしていく */
type Drain = { readonly before: number; readonly after: number; readonly at: number };

/** 着弾 1 つの再生の状態 */
type ImpactRun = {
  readonly impact: Impact;
  readonly key: string;
  /** 再生の開始からこの着弾までの時間 */
  readonly at: number;
  exploded: boolean;
  carved: boolean;
};

/** 再生 1 回分の可変状態 */
type Run = {
  readonly renderer: Renderer;
  readonly job: ReplayJob;
  readonly view: ProjectileView;
  readonly elevations: readonly [number, number];
  readonly mySeat: Seat | null;
  readonly cb: ReplayCallbacks;
  readonly falls: readonly Fall[];
  /** 弾道ごとの発射の遅れ */
  readonly launchAt: readonly number[];
  readonly impacts: readonly ImpactRun[];
  readonly trailEvery: number;
  phase: Phase;
  elapsed: number;
  phaseStart: number;
  /** 弾道ごとに、尾を置いた最後の添字 */
  readonly trailIndex: number[];
  /** 着弾で削られていく地形 */
  mask: TerrainMask;
  /** 着弾で減っていく HP */
  hp: [number, number];
  readonly flashUntil: [number, number];
  readonly drains: [Drain | null, Drain | null];
  shake: { readonly at: number; readonly damage: readonly [number, number] } | null;
  stopFrames: () => void;
};

const poseOf = (p: PlayerView, mask: TerrainMask, elevation: number, over: Partial<TankPose> = {}): TankPose => ({
  x: p.x,
  y: p.y,
  tilt: tiltOf(mask, p),
  facing: p.facing,
  elevation,
  hp: p.hp,
  visible: !isRingOut(mask, p),
  flash: false,
  // 再生の間は狙いを付ける時間ではないので線を出さない
  aiming: false,
  ...over,
});

const elevationOf = (run: Run, seat: Seat): number => (seat === run.job.shot.input.seat ? run.job.shot.input.elevation : run.elevations[seat]);

/** 落下前の地表。撃った側は移動後の位置（input.y）、相手はターン開始時の位置 */
const groundBeforeFall = (job: ReplayJob, seat: Seat): number => (seat === job.shot.input.seat ? job.shot.input.y : job.playersBefore[seat].y);

/** 着弾で地面を失った機体の落下。落下前の地表と、サーバーが決めた落下後の地表の差から求める */
const computeFalls = (job: ReplayJob): Fall[] => {
  const falls: Fall[] = [];
  for (const seat of [0, 1] as const) {
    const from = groundBeforeFall(job, seat);
    const after = job.playersAfter[seat];
    const to = isRingOut(job.maskAfter, after) ? MAP_HEIGHT + 12 : after.y;
    if (to > from) falls.push({ seat, from, to });
  }
  return falls;
};

/** 弾道ごとの発射の遅れと、着弾ごとの時刻。弾道の位置列はクライアントの再計算から得る */
const timeline = (job: ReplayJob): { launchAt: number[]; impacts: ImpactRun[] } => {
  const fanCount = weaponSpec(job.shot.input.weapon).fan.length;
  const launchAt = job.paths.map((_, p) => launchDelayMs(p, fanCount));
  const impacts = job.shot.impacts.map((impact) => {
    const path = job.paths[impact.projectile];
    const at = (launchAt[impact.projectile] ?? 0) + impactTimeMs(impact.stage, path?.impactAt ?? []);
    return { impact, key: `${impact.projectile}/${impact.stage}`, at, exploded: false, carved: false };
  });
  return { launchAt, impacts };
};

/** 着弾後の位置で、地形は着弾前のまま描く。落下前の姿勢。HP バーは削れてからの時間で減らしていく */
const poseAfterHit = (run: Run, seat: Seat, flash: boolean): TankPose => {
  const before = run.job.playersBefore[seat];
  const after = run.job.playersAfter[seat];
  const drain = run.drains[seat];
  const bar = drain ? hpBarAt(run.elapsed - drain.at, drain.before, drain.after) : { hp: run.hp[seat], hpGhost: run.hp[seat], ghostOn: false };
  // 落下前なので、撃った側は移動後の地表、相手はターン開始時の地表に立つ
  return poseOf({ ...before, hp: bar.hp, x: after.x, y: groundBeforeFall(run.job, seat), facing: after.facing }, run.job.maskBefore, elevationOf(run, seat), {
    flash,
    hpGhost: bar.hpGhost,
    ghostOn: bar.ghostOn,
  });
};

const finish = (run: Run): void => {
  if (run.phase === "done") return;
  run.phase = "done";
  run.view.clear();
  for (const seat of [0, 1] as const) run.renderer.setTank(seat, poseOf(run.job.playersAfter[seat], run.job.maskAfter, elevationOf(run, seat)));
  run.renderer.setShake({ dx: 0, dy: 0 });
  run.stopFrames();
  run.cb.done();
};

const enterFall = (run: Run): void => {
  run.phase = "fall";
  run.phaseStart = run.elapsed;
  run.view.clear();
  run.renderer.setTerrain(run.job.maskAfter);
  for (const seat of [0, 1] as const) {
    run.renderer.setTank(seat, poseOf(run.job.playersAfter[seat], run.job.maskBefore, elevationOf(run, seat), { visible: true }));
  }
  if (run.falls.length === 0) finish(run);
};

/** 位置列の添字 i 付近の進む向き。静止中の弾も飛んできた向きのまま描く */
const angleAt = (points: ProjectilePath["points"], i: number): number => {
  const k = Math.min(points.length - 1, Math.max(1, Math.ceil(i)));
  const a = points[k - 1];
  const b = points[k];
  return a && b ? Math.atan2(b.y - a.y, b.x - a.x) : 0;
};

const cellOfPoint = (p: { readonly x: number; readonly y: number }): CellPoint => ({ x: Math.floor(p.x / ONE), y: Math.floor(p.y / ONE) });

/** 弾道 p の弾の位置と尾。発射前は隠す。着弾が 1 つも無い弾道は、消えた位置に外れの印を出す */
const updateBullet = (run: Run, p: number): void => {
  const path = run.job.paths[p];
  const t = run.elapsed - (run.launchAt[p] ?? 0);
  if (!path || t < 0) {
    run.view.setBullet(p, null, 0, 0);
    return;
  }
  const points = path.points;
  const frame = projectileFrameAt(t, path.impactAt, points.length);
  const last = points[points.length - 1];
  if (frame.ended && last) {
    run.view.setBullet(p, null, 0, 0);
    const mark = path.impactAt.length === 0 ? missMarkAt(t - (points.length - 1) * STEP_MS, cellOfPoint(last)) : null;
    run.view.setMissMark(`miss/${p}`, mark ? mark.x : null, mark?.y ?? 0, mark?.on ?? false);
    return;
  }
  const i = Math.floor(frame.index);
  const a = points[i];
  const b = points[i + 1] ?? a;
  if (!a || !b) return;
  const f = frame.index - i;
  run.view.setBullet(p, (a.x + (b.x - a.x) * f) / ONE, (a.y + (b.y - a.y) * f) / ONE, angleAt(points, frame.holding ? i : frame.index));
  if (run.trailEvery === 0) return;
  while ((run.trailIndex[p] ?? 0) + run.trailEvery <= i) {
    const next = (run.trailIndex[p] ?? 0) + run.trailEvery;
    run.trailIndex[p] = next;
    const q = points[next];
    if (q) run.view.addTrail(Math.floor(q.x / ONE), Math.floor(q.y / ONE));
  }
};

/** 爆風が最大に達した瞬間。地形を削り、被弾した機体を白くし、HP を減らし始め、被弾と手応えの音を鳴らす */
const carveImpact = (run: Run, ir: ImpactRun): void => {
  ir.carved = true;
  const { impact } = ir;
  run.mask = carve(run.mask, impact.terrainOp);
  run.renderer.setTerrain(run.mask);
  const shooter = run.job.shot.input.seat;
  const shooterColor = run.job.playersBefore[shooter].colors.primary;
  const hpBefore: [number, number] = [run.hp[0], run.hp[1]];
  run.hp = [run.hp[0] - impact.damage[0], run.hp[1] - impact.damage[1]];
  for (const seat of [0, 1] as const) {
    const damage = impact.damage[seat];
    if (damage <= 0) continue;
    // 減り始めの値は、前の着弾の減りが途中なら今見えている値
    const prev = run.drains[seat];
    const shown = prev ? hpBarAt(run.elapsed - prev.at, prev.before, prev.after).hp : hpBefore[seat];
    run.drains[seat] = { before: shown, after: run.hp[seat], at: run.elapsed };
    run.flashUntil[seat] = Math.max(run.flashUntil[seat], run.elapsed + flashMsOf(damage));
    run.renderer.showDamage(seat, damageLabelText(damage), shooterColor, damageTier(damage) === 3);
  }
  if (impact.damage[0] > 0 || impact.damage[1] > 0) run.shake = { at: run.elapsed, damage: impact.damage };
  for (const name of damageSounds(impact.damage, hpBefore, run.hp, shooter, run.mySeat)) run.cb.sound(name);
};

/** 着弾 1 つの爆風と破片。時刻が来るまでは何も描かない */
const updateImpact = (run: Run, ir: ImpactRun): void => {
  const t = run.elapsed - ir.at;
  if (t < 0) return;
  if (!ir.exploded) {
    ir.exploded = true;
    run.cb.sound("explosion");
  }
  const { cell, terrainOp } = ir.impact;
  const frame = blastFrameAt(t, terrainOp.radius);
  run.view.setBlast(ir.key, frame ? cell.x : null, cell.y, frame?.radius ?? 0, frame?.on ?? false, frame?.ring ?? false, run.cb.reduceMotion ? 1 : Math.min(3, Math.floor(t / IMPACT_TOTAL_MS * 4)));
  if (frame?.carved && !ir.carved) carveImpact(run, ir);
  if (ir.carved) run.view.setDebris(ir.key, debrisAt(t - CARVE_AT_MS, cell, terrainOp.radius));
};

/** 被弾の見せ方。白はダメージが大きいほど長く続き、HP バーは減っていき、画面が揺れる */
const updateHits = (run: Run): void => {
  for (const seat of [0, 1] as const) {
    if (run.drains[seat]) run.renderer.setTank(seat, poseAfterHit(run, seat, run.elapsed < run.flashUntil[seat]));
  }
  if (run.cb.reduceMotion) return;
  run.renderer.setShake(run.shake ? shakeOffsetAt(run.elapsed - run.shake.at, run.shake.damage) : { dx: 0, dy: 0 });
};

/** すべての弾道が終わり、すべての着弾の演出と外れの印が消えたか */
const shotDone = (run: Run): boolean => {
  const impactsDone = run.impacts.every((ir) => run.elapsed - ir.at >= IMPACT_TOTAL_MS);
  const pathsDone = run.job.paths.every((path, p) => {
    const flightMs = (run.launchAt[p] ?? 0) + impactTimeMs(path.impactAt.length, [...path.impactAt, path.points.length - 1]);
    return run.elapsed >= flightMs + (path.impactAt.length === 0 ? MISS_MS : 0);
  });
  return impactsDone && pathsDone;
};

const stepShot = (run: Run): void => {
  for (let p = 0; p < run.job.paths.length; p++) updateBullet(run, p);
  for (const ir of run.impacts) updateImpact(run, ir);
  updateHits(run);
  if (shotDone(run)) enterFall(run);
};

const stepFall = (run: Run): void => {
  const t = (run.elapsed - run.phaseStart) / 1000;
  let allDone = true;
  for (const f of run.falls) {
    const y = Math.min(f.to, f.from + FALL_CELLS_PER_S * t);
    if (y < f.to) allDone = false;
    run.renderer.setTank(f.seat, poseOf(run.job.playersAfter[f.seat], run.job.maskBefore, elevationOf(run, f.seat), { y, falling: y < f.to, visible: y < MAP_HEIGHT + 6 }));
  }
  if (allDone) finish(run);
};

const stepFrame = (run: Run, deltaMs: number): void => {
  run.elapsed += deltaMs;
  if (run.phase === "shot") stepShot(run);
  else if (run.phase === "fall") stepFall(run);
};

/** 再生を始める。返り値で中断できる */
export const playReplay = (
  renderer: Renderer,
  job: ReplayJob,
  elevations: readonly [number, number],
  mySeat: Seat | null,
  cb: ReplayCallbacks,
): (() => void) => {
  const shooter = job.playersBefore[job.shot.input.seat];
  const { launchAt, impacts } = timeline(job);
  const run: Run = {
    renderer,
    job,
    view: renderer.projectile(shooter.colors.primary, job.shot.input.weapon),
    elevations,
    mySeat,
    cb,
    falls: computeFalls(job),
    launchAt,
    impacts,
    trailEvery: trailStep(job.shot.input.weapon),
    phase: "shot",
    elapsed: 0,
    phaseStart: 0,
    trailIndex: job.paths.map(() => 0),
    mask: job.maskBefore,
    hp: [job.playersBefore[0].hp, job.playersBefore[1].hp],
    flashUntil: [0, 0],
    drains: [null, null],
    shake: null,
    stopFrames: () => {},
  };
  // 再生初期化から移動後のx/yを使用し、ターン開始位置を一瞬描画しない。
  for (const seat of [0, 1] as const) {
    const before = job.playersBefore[seat];
    const position = seat === job.shot.input.seat
      ? { ...before, x: job.shot.input.x, y: job.shot.input.y, facing: job.shot.input.facing }
      : before;
    renderer.setTank(seat, poseOf(position, job.maskBefore, elevationOf(run, seat)));
  }
  cb.sound("fire");
  run.stopFrames = renderer.onFrame((deltaMs) => stepFrame(run, deltaMs));
  return () => {
    if (run.phase === "done") return;
    run.phase = "done";
    run.view.clear();
    run.renderer.setShake({ dx: 0, dy: 0 });
    run.stopFrames();
  };
};
