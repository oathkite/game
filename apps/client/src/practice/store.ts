import type { Impact } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { resolveTargets } from "./rules";
import type { Facing, WeaponSlot } from "@game/protocol";
import type { Profile } from "@/app/profile";
import { applyElevation, applyItem, applySlot, applyStep, canStep } from "@/match/control";
import type { ItemId } from "@game/protocol";
import { createListeners } from "@/net/connection";
import { completeChallenge, fireChallenge, initialChallenge, type ChallengeOptions, type ChallengeState } from "./challenge";
import type { ChallengeStage } from "./stages";

export type ChallengeStore = ReturnType<typeof createChallengeStore>;
export const createChallengeStore = (stage: ChallengeStage, profile: Profile, options: ChallengeOptions = {}) => {
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
    /** アイテムの選択（設計書 42.1）。ストアを作るときに許したとき（チュートリアル）だけ選べる */
    selectItem: (item: ItemId | null) => { if (options.items) set({ ...state, view: applyItem(state.view, item) }); },
    /** 的を足す（チュートリアルは的当ての手順で初めて的を出す。設計書 44.3） */
    addTargets: (points: readonly (readonly [number, number])[]) => set({ ...state, targets: [...state.targets, ...points.map(([x, y], i) => ({ id: `${stage.id}-${state.targets.length + i}`, x, y, destroyed: false }))] }),
    setWind: (value: number) => set({ ...state, view: { ...state.view, wind: { ...state.view.wind, value } } }),
    fire: (power: number) => set(fireChallenge(state, power)),
    completeReplay: (id: number) => set(completeChallenge(state, stage, id, options.endless)),
  };
};
