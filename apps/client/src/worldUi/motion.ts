/** ドット絵の演出で共有する、時間から見た目への写像と刻みのタイマー。 */

/** 動きを減らす設定。SSR やテスト（node）では matchMedia が無いので動きありとして扱う。 */
export const prefersReducedMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 1 文字 msPerChar で打ち出したとき、elapsedMs 時点で見えている文字列。 */
export const typedText = (text: string, elapsedMs: number, msPerChar: number): string => {
  const chars = Array.from(text);
  const count = Math.max(0, Math.min(chars.length, Math.floor(elapsedMs / msPerChar)));
  return chars.slice(0, count).join("");
};

/** 打ち出しに必要な刻みの数（サロゲートペアを 1 文字と数える）。 */
export const charCount = (text: string): number => Array.from(text).length;

/**
 * stepMs ごとに onTick(1..steps) を呼び、steps に達したら止まる。
 * 返り値で途中停止する。steps が 0 以下なら何もしない。
 */
export const startTicker = (stepMs: number, steps: number, onTick: (tick: number) => void): (() => void) => {
  if (steps <= 0) return () => undefined;
  let tick = 0;
  const timer = setInterval(() => {
    tick += 1;
    onTick(tick);
    if (tick >= steps) clearInterval(timer);
  }, stepMs);
  return () => clearInterval(timer);
};
