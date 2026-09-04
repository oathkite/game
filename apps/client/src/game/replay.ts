import type { Seat } from "@game/protocol";
import { BLAST_RADIUS, isRingOut, MAP_HEIGHT, ONE, surfaceY, tiltOf, type TerrainMask } from "@game/sim";
import type { SoundName } from "@/app/audio";
import type { PlayerView, ReplayJob } from "@/match/types";
import type { ProjectileView } from "./projectileView";
import type { Renderer } from "./renderer";
import type { TankPose } from "./tankView";

// 射撃結果の再生。設計書 03 の 3.9。弾道は 1 ステップ 1/60 秒で進め、着弾で爆風、地形の削り、落下を順に描く。

export type ReplayCallbacks = {
  readonly sound: (name: SoundName) => void;
  readonly done: () => void;
};

const STEP_MS = 1000 / 60;
const BLAST_MS = 500;
const FLASH_MS = 300;
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

/** 着弾後の HP と位置で、地形は着弾前のまま描く。落下前の姿勢 */
const poseAfterHit = (run: Run, seat: Seat, flash: boolean): TankPose => {
  const before = run.job.playersBefore[seat];
  const after = run.job.playersAfter[seat];
  return poseOf({ ...before, hp: after.hp, x: after.x, facing: after.facing }, run.job.maskBefore, elevationOf(run, seat), { flash });
};

const finish = (run: Run): void => {
  if (run.phase === "done") return;
  run.phase = "done";
  run.projectile.clear();
  for (const seat of [0, 1] as const) run.renderer.setTank(seat, poseOf(run.job.playersAfter[seat], run.job.maskAfter, elevationOf(run, seat)));
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

const enterBlast = (run: Run): void => {
  run.phase = "blast";
  run.phaseStart = run.elapsed;
  run.projectile.setBullet(null, 0, 0);
  const { shot } = run.job;
  if (!shot.impact) {
    enterFall(run);
    return;
  }
  run.cb.sound("explosion");
  run.renderer.setTerrain(run.job.maskAfter);
  for (const seat of [0, 1] as const) {
    const damaged = shot.damage[seat] > 0;
    if (damaged && seat === run.mySeat) run.cb.sound("hit");
    run.renderer.setTank(seat, poseAfterHit(run, seat, damaged));
  }
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

const stepBlast = (run: Run): void => {
  const t = run.elapsed - run.phaseStart;
  if (t >= BLAST_MS) {
    enterFall(run);
    return;
  }
  const { shot } = run.job;
  const on = Math.floor(t / 80) % 2 === 0;
  if (shot.impact) run.projectile.setBlast(shot.impact.x, shot.impact.y, BLAST_RADIUS, on);
  if (t >= FLASH_MS) {
    for (const seat of [0, 1] as const) {
      if (shot.damage[seat] > 0) run.renderer.setTank(seat, poseAfterHit(run, seat, false));
    }
  }
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
    run.stopFrames();
  };
};
