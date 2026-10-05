import type { ChallengeState } from "./challenge";
import type { ChallengeStage } from "./stages";

// チュートリアル（設計書 44）。平らな床の的を、案内に沿った操作で壊す。
// 弾数は実質無制限にして失敗させず、記録も残さない。
export const TUTORIAL_STAGE: ChallengeStage = {
  id: "T", title: "チュートリアル", hint: "", shots: 99, wind: 0, loadout: ["cannon", "triple"],
  start: [100, 180], platforms: [[0, 180, 399, 224]], targets: [[170, 180]],
};

export type TutorialStep = "intro" | "aim" | "move" | "weapon" | "fire" | "target" | "done";
export const TUTORIAL_STEPS: readonly TutorialStep[] = ["intro", "aim", "move", "weapon", "fire", "target", "done"];
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
    default: return false;
  }
};

/** 手順の始まりの状態 from と今の状態 now から次の手順を返す。導入と完了はボタンでだけ進む。
 * 促す前に的を壊したら、残りの手順を飛ばして完了にする。 */
export const advanceTutorial = (step: TutorialStep, from: ChallengeState, now: ChallengeState): TutorialStep => {
  if (step === "intro" || step === "done") return step;
  if (now.status === "clear") return "done";
  return performed(step, from, now) ? TUTORIAL_STEPS[TUTORIAL_STEPS.indexOf(step) + 1]! : step;
};
