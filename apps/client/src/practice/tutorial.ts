import type { ChallengeState } from "./challenge";
import type { ChallengeStage } from "./stages";

// チュートリアル（設計書 44）。平らな床の的を、案内に沿った操作で壊す。
// 弾数は実質無制限にして失敗させず、記録も残さない。
export const TUTORIAL_STAGE: ChallengeStage = {
  id: "T", title: "チュートリアル", hint: "", shots: 99, wind: 0, loadout: ["cannon", "triple"],
  start: [100, 180], platforms: [[0, 180, 399, 224]], targets: [[170, 180]],
};

export type TutorialStep = "intro" | "aim" | "move" | "weapon" | "memo" | "fire" | "target" | "wind" | "timer" | "items" | "done";
export const TUTORIAL_STEPS: readonly TutorialStep[] = ["intro", "aim", "move", "weapon", "memo", "fire", "target", "wind", "timer", "items", "done"];
/** 「次へ」で進む、説明だけの手順。風、制限時間、アイテムはこの盤面では試せないので、的を壊したあとに読む。
 * 操作の手順には「次へ」も「スキップ」も置かず、促した操作でだけ進める（2026-10-05 のユーザー指示） */
export const TUTORIAL_BUTTON_STEPS: readonly TutorialStep[] = ["intro", "wind", "timer", "items", "done"];
/** 的を壊したら、操作の手順を飛ばしてここへ進む */
const AFTER_TARGET: TutorialStep = "wind";
/** 角度と移動は、変化が画面で見て分かる量になってから次へ進める */
export const AIM_DEGREES = 10;
export const MOVE_CELLS = 5;

const performed = (step: TutorialStep, from: ChallengeState, now: ChallengeState): boolean => {
  switch (step) {
    case "aim": return Math.abs(now.view.lastElevation - from.view.lastElevation) >= AIM_DEGREES;
    case "move": {
      const before = from.view.control, after = now.view.control;
      return before !== null && after !== null && Math.abs(after.x - before.x) >= MOVE_CELLS;
    }
    case "weapon": return now.view.lastSlot !== from.view.lastSlot;
    // 再生が終わって次を撃てるようになってから進める
    case "fire": return now.used > from.used && now.view.phase === "acting";
    // 目安の線は盤面の状態に残らないので、画面が目盛りを押したことを受けて nextTutorialStep で進める
    case "memo": return false;
    default: return false;
  }
};

export const nextTutorialStep = (step: TutorialStep): TutorialStep => TUTORIAL_STEPS[TUTORIAL_STEPS.indexOf(step) + 1] ?? step;

/** 手順の始まりの状態 from と今の状態 now から次の手順を返す。ボタンで進む手順はここでは進めない。
 * 促す前に的を壊したら、操作の手順を飛ばして対戦の説明へ進む。 */
export const advanceTutorial = (step: TutorialStep, from: ChallengeState, now: ChallengeState): TutorialStep => {
  if (TUTORIAL_STEPS.indexOf(step) >= TUTORIAL_STEPS.indexOf(AFTER_TARGET)) return step;
  if (now.status === "clear") return AFTER_TARGET;
  if (TUTORIAL_BUTTON_STEPS.includes(step)) return step;
  return performed(step, from, now) ? nextTutorialStep(step) : step;
};
