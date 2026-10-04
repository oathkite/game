import type { Clock, EngineState } from "@game/engine";
import type { Facing, WeaponSlot } from "@game/protocol";
import { aimCpuShot, type CpuShot } from "./cpu";
import { choosePosition, positionOptions } from "./cpuPosition";
import type { CpuLevel } from "./cpuLevel";

export type CpuPose = { readonly x: number; readonly y: number; readonly facing: Facing; readonly elevation: number; readonly slot: WeaponSlot; readonly power: number };
type Frame = { readonly at: number; readonly pose: CpuPose };
export type CpuTurnPlan = { readonly frames: readonly Frame[]; readonly duration: number; readonly fire: CpuShot };
const range = (rng: () => number, low: number, high: number) => low + Math.floor(rng() * (high - low + 1));

export const planCpuTurn = (state: EngineState, level: CpuLevel, elevation: number, rng: () => number): CpuTurnPlan => {
  const actor = state.match.players[1];
  const { path, fire: best } = choosePosition(positionOptions(state, level), rng);
  const fire = aimCpuShot(best, level, rng);
  let at = range(rng, 700, 1800);
  let pose: CpuPose = { x: actor.x, y: actor.y, facing: actor.facing, elevation, slot: fire.slot, power: 0 };
  const frames: Frame[] = [{ at, pose }];
  for (const position of path) {
    at += range(rng, 90, 150);
    pose = { ...pose, ...position };
    frames.push({ at, pose });
  }
  at += range(rng, 250, 650);
  const waypoints = [Math.max(10, Math.min(90, fire.elevation + range(rng, -5, 5))), fire.elevation];
  for (const target of waypoints) {
    while (pose.elevation !== target) {
      at += range(rng, 35, 60);
      pose = { ...pose, facing: fire.facing, elevation: pose.elevation + Math.sign(target - pose.elevation) };
      frames.push({ at, pose });
    }
    at += range(rng, 180, 400);
  }
  for (let power = 5; power < fire.power; power += 5) {
    at += 75;
    pose = { ...pose, facing: fire.facing, power };
    frames.push({ at, pose });
  }
  at += range(rng, 150, 450);
  frames.push({ at, pose: { ...pose, facing: fire.facing, power: fire.power } });
  return { frames, duration: at + 100, fire };
};

export const playCpuTurn = (plan: CpuTurnPlan, clock: Clock, show: (pose: CpuPose) => void, fire: () => void): (() => void) => {
  const start = clock.now();
  let cancel = () => {};
  let stopped = false;
  const next = (index: number): void => {
    const frame = plan.frames[index];
    cancel = clock.schedule(start + (frame?.at ?? plan.duration), () => {
      if (stopped) return;
      if (frame) { show(frame.pose); next(index + 1); } else fire();
    });
  };
  next(0);
  return () => { stopped = true; cancel(); };
};
