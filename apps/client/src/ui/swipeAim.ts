// マップの上を指でなぞる操作。設計書 03 の 3.3。
// 横に動かせば移動、縦に動かせば仰角が変わる。小さな画面で十字キーが押しにくいときの代わりに置く。

/** 1 歩に必要な横の移動量（px） */
export const SWIPE_STEP_PX = 24;
/** 1 度に必要な縦の移動量（px） */
export const SWIPE_ELEVATION_PX = 8;
/** これを下回る移動は指のぶれとみなす（px） */
export const SWIPE_DEADZONE_PX = 6;

export type SwipeDelta = {
  /** 進める歩数。右が正 */
  readonly steps: number;
  /** 変える仰角。上へなぞると正 */
  readonly elevation: number;
};

/**
 * 押し始めからの移動量を、送るべき歩数と仰角に変える。
 * 横と縦のうち大きい方だけを見る。斜めになぞったときに両方動くと狙いが定まらないためである。
 */
export const swipeDelta = (dx: number, dy: number): SwipeDelta => {
  if (Math.abs(dx) < SWIPE_DEADZONE_PX && Math.abs(dy) < SWIPE_DEADZONE_PX) return { steps: 0, elevation: 0 };
  if (Math.abs(dx) >= Math.abs(dy)) return { steps: Math.trunc(dx / SWIPE_STEP_PX), elevation: 0 };
  // 画面の y は下向きが正なので、上へなぞると仰角が上がる
  return { steps: 0, elevation: Math.trunc(-dy / SWIPE_ELEVATION_PX) };
};

/** 既に送った量との差。なぞっている間に何度も呼ばれるので、進んだぶんだけを返す */
export const swipeAdvance = (sent: SwipeDelta, current: SwipeDelta): SwipeDelta => ({
  steps: current.steps - sent.steps,
  elevation: current.elevation - sent.elevation,
});
