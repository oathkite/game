import type { ChallengeState } from "./challenge";
import type { ChallengeStage } from "./stages";

// チュートリアル（設計書 44）。平らな床で、案内に沿って基本の操作を一つずつ試す。
// 盤面は的を壊しても弾を使い切っても終えず（endless）、記録も残さない。的は的当ての手順で初めて出す。
export const TUTORIAL_STAGE: ChallengeStage = {
  id: "T", title: "チュートリアル", hint: "", shots: 99, wind: 0, loadout: ["cannon", "triple"],
  start: [100, 180], platforms: [[0, 180, 399, 224]], targets: [],
};
/** 的当ての手順で出す的。開始位置から 70 セル右で、標準砲ならどの角度でもパワー42〜50前後で当たる */
export const TUTORIAL_TARGET = [170, 180] as const;
/** アイテムの手順で足す的。ダブルシュートは生きた的が無いと 2 発目を撃たない（設計書 42.2）ので、新しく出す */
export const ITEM_TARGET = [240, 180] as const;
/** 風の手順から吹かせる風。ターゲットチャレンジの「風に乗せて」と同じ強さ */
export const TUTORIAL_WIND = 6;

export type TutorialStep = "intro" | "aim" | "move" | "weapon" | "fire" | "memo" | "target" | "wind" | "timer" | "items" | "done";
export const TUTORIAL_STEPS: readonly TutorialStep[] = ["intro", "aim", "move", "weapon", "fire", "memo", "target", "wind", "timer", "items", "done"];
/** 「次へ」で進む、説明だけの手順。ほかの手順は促した操作でだけ進め、「次へ」も「スキップ」も置かない（2026-10-05 のユーザー指示） */
export const TUTORIAL_BUTTON_STEPS: readonly TutorialStep[] = ["intro", "timer", "done"];

const at = (step: TutorialStep): number => TUTORIAL_STEPS.indexOf(step);
export const nextTutorialStep = (step: TutorialStep): TutorialStep => TUTORIAL_STEPS[at(step) + 1] ?? step;

/** 手順に入ったときの盤面の準備。手順から決まるので、場外に落ちて盤面を作り直したときもかけ直せる */
export const tutorialSetup = (step: TutorialStep): { readonly targets: readonly (readonly [number, number])[]; readonly wind: number } => ({
  targets: [...(at(step) >= at("target") ? [TUTORIAL_TARGET] : []), ...(at(step) >= at("items") ? [ITEM_TARGET] : [])],
  wind: at(step) >= at("wind") ? TUTORIAL_WIND : 0,
});

type Direction = "up" | "down" | "left" | "right";
/** 手順の始まりの状態 from と、その手順の間にした操作の向き seen */
export type TutorialProgress = { readonly step: TutorialStep; readonly from: ChallengeState; readonly seen: readonly Direction[] };
export const startTutorialStep = (step: TutorialStep, state: ChallengeState): TutorialProgress => ({ step, from: state, seen: [] });

/** 1 回の状態の変化でした操作の向き。歩数が尽きても左右の入力は向きを変えるので、向きの変化も数える */
const directionsOf = (previous: ChallengeState, now: ChallengeState): readonly Direction[] => {
  const a = previous.view, b = now.view;
  const aim: readonly Direction[] = b.lastElevation > a.lastElevation ? ["up"] : b.lastElevation < a.lastElevation ? ["down"] : [];
  const moved = a.control !== null && b.control !== null && (b.control.x !== a.control.x || b.control.facing !== a.control.facing);
  return moved ? [...aim, b.control!.facing === 1 ? "right" : "left"] : aim;
};

/** 撃って再生が終わり、次を撃てるようになったか */
const shotSince = (from: ChallengeState, now: ChallengeState): boolean => now.used > from.used && now.view.phase === "acting";
const itemsUsed = (state: ChallengeState): number => state.view.players?.[0].itemsUsed?.length ?? 0;

const performed = ({ step, from, seen }: TutorialProgress, now: ChallengeState): boolean => {
  switch (step) {
    case "aim": return seen.includes("up") && seen.includes("down");
    case "move": return seen.includes("left") && seen.includes("right");
    case "weapon": return now.view.lastSlot !== from.view.lastSlot;
    case "fire": case "wind": return shotSince(from, now);
    case "target": return now.targets.length > 0 && now.targets.every(t => t.destroyed) && now.view.phase === "acting";
    case "items": return itemsUsed(now) > itemsUsed(from) && now.view.phase === "acting";
    // 目安の線は盤面の状態に残らないので、画面が目盛りを押したことを受けて nextTutorialStep で進める。説明の手順は「次へ」で進める
    default: return false;
  }
};

/** 状態が previous から now へ 1 回変わったときの進み具合。促した操作ができたら次の手順を now から始める */
export const observeTutorial = (progress: TutorialProgress, previous: ChallengeState, now: ChallengeState): TutorialProgress => {
  const next = { ...progress, seen: [...new Set([...progress.seen, ...directionsOf(previous, now)])] };
  return performed(next, now) ? startTutorialStep(nextTutorialStep(progress.step), now) : next;
};
