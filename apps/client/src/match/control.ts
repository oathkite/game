import type { Facing, WeaponSlot } from "@game/protocol";
import { ELEVATION_MAX, ELEVATION_MIN, stepOutcome } from "@game/sim";
import type { MatchView } from "./types";

// 手番中の操作を表示状態に適用する純関数。matchStore から呼ぶ。

/** 1 歩の移動。左右の入力は向きも変える。歩数がなくても、進めなくても向きだけは変わる */
export const applyStep = (view: MatchView, dir: Facing): MatchView => {
  const c = view.control;
  if (view.phase !== "acting" || !c || !view.mask) return view;
  if (c.stepsLeft <= 0 || c.fell) return { ...view, control: { ...c, facing: dir } };
  const outcome = stepOutcome(view.mask, { x: c.x, y: c.y }, dir);
  if (outcome.kind === "blocked") return { ...view, control: { ...c, facing: dir } };
  return { ...view, control: { ...c, facing: dir, x: c.x + dir, y: outcome.y, stepsLeft: c.stepsLeft - 1, fell: outcome.kind === "fell" } };
};

/** dir 方向に 1 歩進めるか。進めなければボタンを暗くする */
export const canStep = (view: MatchView, dir: Facing): boolean => {
  const c = view.control;
  if (view.phase !== "acting" || !c || !view.mask) return false;
  if (c.stepsLeft <= 0 || c.fell) return false;
  return stepOutcome(view.mask, { x: c.x, y: c.y }, dir).kind !== "blocked";
};

/** 仰角の変更。10 から 90 に収める。最後の値はターンをまたいで引き継ぐ */
export const applyElevation = (view: MatchView, delta: number): MatchView => {
  const c = view.control;
  if (view.phase !== "acting" || !c) return view;
  const elevation = Math.min(ELEVATION_MAX, Math.max(ELEVATION_MIN, c.elevation + delta));
  if (elevation === c.elevation) return view;
  return { ...view, lastElevation: elevation, control: { ...c, elevation } };
};

/** 武器のスロットの選択。最後の値はターンをまたいで引き継ぐ（設計書 10 の 10.3） */
export const applySlot = (view: MatchView, slot: WeaponSlot): MatchView => {
  const c = view.control;
  if (view.phase !== "acting" || !c || c.slot === slot) return view;
  return { ...view, lastSlot: slot, control: { ...c, slot } };
};
