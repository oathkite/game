/** リザルトの段階表示の時間割。行・数え上げ・冠の明滅を合わせて RESULT_MOTION_MS に収める。 */
export const RESULT_MOTION_MS = 800;
export const RESULT_ROW_MS = 90;
export const RESULT_COUNT_STEPS = 8;
export const RESULT_COUNT_STEP_MS = 40;
/** 冠の明滅 1 回の長さ。2 回で 320 ms。 */
export const RESULT_CROWN_BLINK_MS = 160;
const COUNT_MS = RESULT_COUNT_STEPS * RESULT_COUNT_STEP_MS;

/** 行を出す間隔。最後の行の数え上げが RESULT_MOTION_MS に収まるよう、行が多いときだけ 90 ms より詰める。 */
export const resultRowStepMs = (rows: number): number =>
  rows <= 1 ? RESULT_ROW_MS : Math.min(RESULT_ROW_MS, Math.floor((RESULT_MOTION_MS - COUNT_MS) / (rows - 1)));

/** 段階表示のすべての動きが終わる時刻（開始の遅れを除く）。これを過ぎたら演出を止め、入力の見張りも外す。 */
export const resultMotionEndMs = (_rows: number): number => RESULT_MOTION_MS;

/** elapsedMs 時点の数え上げの値。steps 段で to に達し、それより前は段ごとに切り捨てる。 */
export const countUpAt = (elapsedMs: number, to: number, steps = RESULT_COUNT_STEPS, stepMs = RESULT_COUNT_STEP_MS): number => {
  if (steps <= 0) return to;
  const step = Math.max(0, Math.min(steps, Math.floor(elapsedMs / stepMs)));
  return Math.trunc(to * step / steps);
};

/** クリックかキー入力で演出を飛ばす。既定の動作は止めない（リザルトのボタンはそのまま押せる）。 */
export const listenForSkip = (target: EventTarget, onSkip: () => void): (() => void) => {
  const skip = () => onSkip();
  target.addEventListener("pointerdown", skip);
  target.addEventListener("keydown", skip);
  return () => {
    target.removeEventListener("pointerdown", skip);
    target.removeEventListener("keydown", skip);
  };
};
