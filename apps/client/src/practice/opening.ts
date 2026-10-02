import type { Target } from "./rules";

type Point = { readonly x: number; readonly y: number };

/**
 * 的当ての開幕で回る点（設計書 37）。通常の対戦の「自機、相手」と同じく、自機の次に残った的の中心へ寄る。
 * 的は近くに固まっていることが多いので、1 つずつは回らない。最後に自機へ戻るのは openingPose が足す
 */
export const challengeOpeningOrder = (actor: Point, targets: readonly Target[]): readonly Point[] => {
  const live = targets.filter(t => !t.destroyed);
  if (live.length === 0) return [{ x: actor.x, y: actor.y }];
  const sum = live.reduce((a, t) => ({ x: a.x + t.x, y: a.y + t.y }), { x: 0, y: 0 });
  return [{ x: actor.x, y: actor.y }, { x: sum.x / live.length, y: sum.y / live.length }];
};
