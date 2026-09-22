import type { Impact } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { resolveTargets } from "./rules";
import type { Facing, WeaponSlot } from "@game/protocol";
import type { Profile } from "@/app/profile";
import { applyElevation, applySlot, applyStep, canStep } from "@/match/control";
import { createListeners } from "@/net/connection";
import { completeChallenge, fireChallenge, initialChallenge, type ChallengeState } from "./challenge";
import type { ChallengeStage } from "./stages";

export type ChallengeStore = ReturnType<typeof createChallengeStore>;
export const createChallengeStore = (stage: ChallengeStage, profile: Profile) => {
  let state = initialChallenge(stage, profile);
  const listeners = createListeners<void>();
  const set = (next: ChallengeState): void => { state = next; listeners.emit(); };
  return {
    getState: () => state,
    getTargets: () => state.targets,
    showImpact: (mask: TerrainMask, impact: Impact) => set({ ...state, targets: resolveTargets(mask, state.targets, [impact.terrainOp]) }),
    getView: () => state.view,
    subscribe: (fn: () => void) => listeners.add(fn),
    moveStep: (dir: Facing) => {
      const view = applyStep(state.view, dir);
      const fellOut = view.control !== null && view.mask !== null && view.control.y >= view.mask.height;
      set({ ...state, status: fellOut ? "failed" : state.status, view: fellOut ? { ...view, phase: "finished" } : view });
    },
    changeElevation: (delta: number) => set({ ...state, view: applyElevation(state.view, delta) }),
    selectSlot: (slot: WeaponSlot) => set({ ...state, view: applySlot(state.view, slot) }),
    canStep: (dir: Facing) => canStep(state.view, dir),
    fire: (power: number) => set(fireChallenge(state, power)),
    completeReplay: (id: number) => set(completeChallenge(state, stage, id)),
  };
};
