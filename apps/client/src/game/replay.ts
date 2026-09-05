import type { Seat } from "@game/protocol";
import { isRingOut, MAP_HEIGHT, ONE, surfaceY, tiltOf, type TerrainMask } from "@game/sim";
import type { SoundName } from "@/app/audio";
import type { PlayerView, ReplayJob } from "@/match/types";
import { blastFrameAt, CARVE_AT_MS, damageLabelText, damageSounds, damageTier, flashMsOf, hpBarAt, shakeOffsetAt } from "./hitFeedback";
import type { ProjectileView } from "./projectileView";
import type { Renderer } from "./renderer";
import type { TankPose } from "./tankView";

// 射撃結果の再生。設計書 03 の 3.9。弾道は 1 ステップ 1/60 秒で進め、着弾で弾を一瞬止め、爆風の膨張、地形の削り、落下を順に描く。
// 着弾の時間の流れは hitFeedback.ts が決める。

export type ReplayCallbacks = {
  readonly sound: (name: SoundName) => void;
  readonly done: () => void;
  /** 利用者が動きを減らす設定にしている。画面揺れを出さない */
  readonly reduceMotion: boolean;
};

const STEP_MS = 1000 / 60;
/** 落下の速さ（セル/秒） */
const FALL_CELLS_PER_S = 90;

type Fall = { readonly seat: Seat; readonly from: number; readonly to: number };

type Phase = "flight" | "blast" | "fall" | "done";

/** 再生 1 回分の可変状態 */
type Run = {
  readonly renderer: Renderer;
  readonly job: ReplayJob;
  readonly projectile: ProjectileView;
  readonly elevations: readonly [number, number];
  readonly mySeat: Seat | null;
  readonly cb: ReplayCallbacks;
  readonly falls: readonly Fall[];
  phase: Phase;
  elapsed: number;
  phaseStart: number;
  trailIndex: number;
  /** 爆風の膨張が終わり、地形を削って被弾を見せたか */
  carved: boolean;
  stopFrames: () => void;
};

const poseOf = (p: PlayerView, mask: TerrainMask, elevation: number, over: Partial<TankPose> = {}): TankPose => ({
  x: p.x,
  y: surfaceY(mask, p.x),
  tilt: tiltOf(mask, p.x),
  facing: p.facing,
  elevation,
  hp: p.hp,
  visible: !isRingOut(mask, p.x),
  flash: false,
  // 再生の間は狙いを付ける時間ではないので線を出さない
  aiming: false,
  ...over,
});

const elevationOf = (run: Run, seat: Seat): number => (seat === run.job.shot.input.seat ? run.job.shot.input.elevation : run.elevations[seat]);

/** 着弾で地面を失った機体の落下。着弾前と後の地表の差から求める */
const computeFalls = (job: ReplayJob): Fall[] => {
  const falls: Fall[] = [];
  for (const seat of [0, 1] as const) {
    const p = job.playersAfter[seat];
    const from = surfaceY(job.maskBefore, p.x);
    const to = isRingOut(job.maskAfter, p.x) ? MAP_HEIGHT + 12 : surfaceY(job.maskAfter, p.x);
    if (to > from) falls.push({ seat, from, to });
  }
  return falls;
};

/** 着弾後の位置で、地形は着弾前のまま描く。落下前の姿勢。HP バーは削れてからの時間で減らしていく */
const poseAfterHit = (run: Run, seat: Seat, flash: boolean, sinceCarve: number): TankPose => {
  const before = run.job.playersBefore[seat];
  const after = run.job.playersAfter[seat];
  const bar = hpBarAt(sinceCarve, before.hp, after.hp);
  return poseOf({ ...before, hp: bar.hp, x: after.x, facing: after.facing }, run.job.maskBefore, elevationOf(run, seat), {
    flash,
    hpGhost: bar.hpGhost,
    ghostOn: bar.ghostOn,
  });
};

const finish = (run: Run): void => {
  if (run.phase === "done") return;
  run.phase = "done";
  run.projectile.clear();
  for (const seat of [0, 1] as const) run.renderer.setTank(seat, poseOf(run.job.playersAfter[seat], run.job.maskAfter, elevationOf(run, seat)));
  run.renderer.setShake({ dx: 0, dy: 0 });
  run.stopFrames();
  run.cb.done();
};

const enterFall = (run: Run): void => {
  run.phase = "fall";
  run.phaseStart = run.elapsed;
  run.projectile.clear();
  for (const seat of [0, 1] as const) {
    run.renderer.setTank(seat, poseOf(run.job.playersAfter[seat], run.job.maskBefore, elevationOf(run, seat), { visible: true }));
  }
  if (run.falls.length === 0) finish(run);
};

/** 飛行の最後の向き。静止中の弾を飛んできた向きのまま描くために使う */
const lastFlightAngle = (path: ReplayJob["path"]): number => {
  const a = path[path.length - 2];
  const b = path[path.length - 1];
  return a && b ? Math.atan2(b.y - a.y, b.x - a.x) : 0;
};

/** 着弾。弾を着弾点に止め、爆発音を鳴らす。地形はまだ削らない */
const enterBlast = (run: Run): void => {
  run.phase = "blast";
  run.phaseStart = run.elapsed;
  const { shot } = run.job;
  if (!shot.impact) {
    run.projectile.setBullet(null, 0, 0);
    enterFall(run);
    return;
  }
  run.projectile.setBullet(shot.impact.x + 0.5, shot.impact.y + 0.5, lastFlightAngle(run.job.path));
  run.cb.sound("explosion");
};

/** 爆風が最大に達した瞬間。地形を削り、被弾した機体を白くし、被弾と手応えの音を鳴らす */
const carve = (run: Run): void => {
  run.carved = true;
  const { shot } = run.job;
  run.renderer.setTerrain(run.job.maskAfter);
  const shooterColor = run.job.playersBefore[shot.input.seat].colors.primary;
  for (const seat of [0, 1] as const) {
    const damage = shot.damage[seat];
    run.renderer.setTank(seat, poseAfterHit(run, seat, damage > 0, 0));
    if (damage > 0) run.renderer.showDamage(seat, damageLabelText(damage), shooterColor, damageTier(damage) === 3);
  }
  for (const name of damageSounds(shot, run.mySeat)) run.cb.sound(name);
};

const stepFlight = (run: Run): void => {
  const { path } = run.job;
  const t = run.elapsed / STEP_MS;
  const i = Math.floor(t);
  if (i >= path.length - 1) {
    enterBlast(run);
    return;
  }
  const a = path[i];
  const b = path[i + 1];
  if (!a || !b) return;
  const f = t - i;
  run.projectile.setBullet((a.x + (b.x - a.x) * f) / ONE, (a.y + (b.y - a.y) * f) / ONE, Math.atan2(b.y - a.y, b.x - a.x));
  // 尾は 1 セル置きに残す
  while (run.trailIndex + 2 <= i) {
    run.trailIndex += 2;
    const p = path[run.trailIndex];
    if (p) run.projectile.addTrail(Math.floor(p.x / ONE), Math.floor(p.y / ONE));
  }
};

/** 削れてからの被弾の見せ方。白はダメージが大きいほど長く続き、HP バーは減っていき、画面が揺れる */
const updateHits = (run: Run, sinceCarve: number): void => {
  const { shot } = run.job;
  for (const seat of [0, 1] as const) {
    const damage = shot.damage[seat];
    if (damage > 0) run.renderer.setTank(seat, poseAfterHit(run, seat, sinceCarve < flashMsOf(damage), sinceCarve));
  }
  if (!run.cb.reduceMotion) run.renderer.setShake(shakeOffsetAt(sinceCarve, shot.damage));
};

const stepBlast = (run: Run): void => {
  const t = run.elapsed - run.phaseStart;
  const frame = blastFrameAt(t);
  if (!frame) {
    enterFall(run);
    return;
  }
  const { impact } = run.job.shot;
  if (!impact) return;
  if (!frame.hold) run.projectile.setBullet(null, 0, 0);
  run.projectile.setBlast(impact.x, impact.y, frame.radius, frame.on, frame.ring);
  if (frame.carved && !run.carved) carve(run);
  if (run.carved) updateHits(run, t - CARVE_AT_MS);
};

const stepFall = (run: Run): void => {
  const t = (run.elapsed - run.phaseStart) / 1000;
  let allDone = true;
  for (const f of run.falls) {
    const y = Math.min(f.to, f.from + FALL_CELLS_PER_S * t);
    if (y < f.to) allDone = false;
    run.renderer.setTank(f.seat, poseOf(run.job.playersAfter[f.seat], run.job.maskBefore, elevationOf(run, f.seat), { y, visible: y < MAP_HEIGHT + 6 }));
  }
  if (allDone) finish(run);
};

const stepFrame = (run: Run, deltaMs: number): void => {
  run.elapsed += deltaMs;
  if (run.phase === "flight") stepFlight(run);
  else if (run.phase === "blast") stepBlast(run);
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
  const run: Run = {
    renderer,
    job,
    projectile: renderer.projectile(shooter.colors.primary),
    elevations,
    mySeat,
    cb,
    falls: computeFalls(job),
    phase: "flight",
    elapsed: 0,
    phaseStart: 0,
    trailIndex: 0,
    carved: false,
    stopFrames: () => {},
  };
  for (const seat of [0, 1] as const) renderer.setTank(seat, poseOf(job.playersBefore[seat], job.maskBefore, elevationOf(run, seat)));
  // 撃つ側の位置は移動後の x で描く
  renderer.setTank(job.shot.input.seat, poseOf({ ...shooter, x: job.shot.input.x, facing: job.shot.input.facing }, job.maskBefore, job.shot.input.elevation));
  cb.sound("fire");
  run.stopFrames = renderer.onFrame((deltaMs) => stepFrame(run, deltaMs));
  return () => {
    if (run.phase === "done") return;
    run.phase = "done";
    run.projectile.clear();
    run.renderer.setShake({ dx: 0, dy: 0 });
    run.stopFrames();
  };
};
