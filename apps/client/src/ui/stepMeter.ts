// 残り歩数のメーター。設計書 03 の 3.6。
// 目盛りの数は 1 ターンの歩数と等しく、幅はパネルに収まるように決める。

/** 目盛りの間隔（px）。styles.css の .steps の gap と合わせる */
export const STEP_GAP = 1;

/**
 * 目盛り 1 つの幅（px）。パネルの内側の幅から間隔を引き、歩数で割る。
 * 1 px を下回らないようにするので、歩数が多すぎればはみ出す代わりに見えなくなることはない。
 */
export const stepMarkWidth = (panelWidth: number, steps: number): number => {
  if (steps <= 0) return 0;
  const inner = panelWidth - 8 - STEP_GAP * (steps - 1);
  return Math.max(1, Math.floor(inner / steps));
};
