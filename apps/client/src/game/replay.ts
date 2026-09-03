import type { Seat } from "@game/protocol";
import { BLAST_RADIUS, isRingOut, MAP_HEIGHT, ONE, surfaceY, tiltOf, type TerrainMask } from "@game/sim";
import type { SoundName } from "@/app/audio";
import type { PlayerView, ReplayJob } from "@/match/types";
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

const poseOf = (p: PlayerView, mask: TerrainMask, elevation: number, over: Partial<TankPose> = {}): TankPose => ({
  x: p.x,
  y: surfaceY(mask, p.x),
  tilt: tiltOf(mask, p.x),
  facing: p.facing,
  elevation,
  hp: p.hp,
  visible: !isRingOut(mask, p.x),
  flash: false,
  ...over,
});

type Fall = { readonly seat: Seat; readonly from: number; readonly to: number };

/** 再生を始める。返り値で中断できる */
export const playReplay = (
  renderer: Renderer,
  job: ReplayJob,
  elevations: readonly [number, number],
  mySeat: Seat | null,
  cb: ReplayCallbacks,
): (() => void) => {
  const { shot, path } = job;
  const shooter = job.playersBefore[shot.input.seat];
  const projectile = renderer.projectile(shooter.colors.primary);
  const elevOf = (seat: Seat): number => (seat === shot.input.seat ? shot.input.elevation : elevations[seat]);

  const setBefore = (): void => {
    for (const seat of [0, 1] as const) renderer.setTank(seat, poseOf(job.playersBefore[seat], job.maskBefore, elevOf(seat)));
  };
  setBefore();
  // 撃つ側の位置は移動後の x で描く
  renderer.setTank(shot.input.seat, poseOf({ ...shooter, x: shot.input.x, facing: shot.input.facing }, job.maskBefore, shot.input.elevation));
  cb.sound("fire");

  const falls: Fall[] = [];
  for (const seat of [0, 1] as const) {
    const p = job.playersAfter[seat];
    const from = surfaceY(job.maskBefore, p.x);
    const to = isRingOut(job.maskAfter, p.x) ? MAP_HEIGHT + 12 : surfaceY(job.maskAfter, p.x);
    if (to > from) falls.push({ seat, from, to });
  }

  let phase: "flight" | "blast" | "fall" | "done" = "flight";
  let elapsed = 0;
  let trailIndex = 0;
  let phaseStart = 0;

  const enterBlast = (): void => {
    phase = "blast";
    phaseStart = elapsed;
    projectile.setBullet(null, 0, 0);
    if (!shot.impact) {
      enterFall();
      return;
    }
    cb.sound("explosion");
    renderer.setTerrain(job.maskAfter);
    for (const seat of [0, 1] as const) {
      const damaged = shot.damage[seat] > 0;
      if (damaged && seat === mySeat) cb.sound("hit");
      // HP はここで更新し、位置と傾きは落下前のまま
      const before = job.playersBefore[seat];
      const after = job.playersAfter[seat];
      renderer.setTank(seat, poseOf({ ...before, hp: after.hp, x: after.x, facing: after.facing }, job.maskBefore, elevOf(seat), { flash: damaged }));
    }
  };

  const enterFall = (): void => {
    phase = "fall";
    phaseStart = elapsed;
    projectile.clear();
    for (const seat of [0, 1] as const) {
      renderer.setTank(seat, poseOf(job.playersAfter[seat], job.maskBefore, elevOf(seat), { visible: true }));
    }
    if (falls.length === 0) finish();
  };

  const finish = (): void => {
    if (phase === "done") return;
    phase = "done";
    projectile.clear();
    for (const seat of [0, 1] as const) renderer.setTank(seat, poseOf(job.playersAfter[seat], job.maskAfter, elevOf(seat)));
    stop();
    cb.done();
  };

  const flight = (): void => {
    const t = elapsed / STEP_MS;
    const i = Math.floor(t);
    if (i >= path.length - 1) {
      enterBlast();
      return;
    }
    const a = path[i];
    const b = path[i + 1];
    if (!a || !b) return;
    const f = t - i;
    const x = (a.x + (b.x - a.x) * f) / ONE;
    const y = (a.y + (b.y - a.y) * f) / ONE;
    projectile.setBullet(x, y, Math.atan2(b.y - a.y, b.x - a.x));
    while (trailIndex + 2 <= i) {
      trailIndex += 2;
      const p = path[trailIndex];
      if (p) projectile.addTrail(Math.floor(p.x / ONE), Math.floor(p.y / ONE));
    }
  };

  const blast = (): void => {
    const t = elapsed - phaseStart;
    if (t >= BLAST_MS) {
      enterFall();
      return;
    }
    const on = Math.floor(t / 80) % 2 === 0;
    if (shot.impact) projectile.setBlast(shot.impact.x, shot.impact.y, BLAST_RADIUS, on);
    if (t >= FLASH_MS) {
      for (const seat of [0, 1] as const) {
        if (shot.damage[seat] > 0) {
          const after = job.playersAfter[seat];
          renderer.setTank(seat, poseOf({ ...job.playersBefore[seat], hp: after.hp, x: after.x, facing: after.facing }, job.maskBefore, elevOf(seat)));
        }
      }
    }
  };

  const fall = (): void => {
    const t = (elapsed - phaseStart) / 1000;
    let allDone = true;
    for (const f of falls) {
      const y = Math.min(f.to, f.from + FALL_CELLS_PER_S * t);
      if (y < f.to) allDone = false;
      const p = job.playersAfter[f.seat];
      renderer.setTank(f.seat, poseOf(p, job.maskBefore, elevOf(f.seat), { y, visible: y < MAP_HEIGHT + 6 }));
    }
    if (allDone) finish();
  };

  const stop = renderer.onFrame((deltaMs) => {
    elapsed += deltaMs;
    if (phase === "flight") flight();
    else if (phase === "blast") blast();
    else if (phase === "fall") fall();
  });

  return () => {
    if (phase !== "done") {
      phase = "done";
      projectile.clear();
      stop();
    }
  };
};
