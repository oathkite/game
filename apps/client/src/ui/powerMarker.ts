// パワーゲージの目安ライン。設計書 03 の 3.5。
// ゲージを押した位置にラインを引き、同じ位置をもう一度押すと消す。別の位置を押すと引き直す。

/** 同じラインを押したとみなす幅（パワーの値） */
export const MARKER_TOLERANCE = 3;

/** ゲージ内の押した位置（上端からの px）をパワーの値にする。上端が 100、下端が 0 */
export const powerAtOffset = (offsetY: number, gaugeHeight: number): number => {
  if (gaugeHeight <= 0) return 0;
  const ratio = 1 - offsetY / gaugeHeight;
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
};

/** 押した結果の目安ライン。同じ位置なら消し、違う位置なら引き直す */
export const toggleMarker = (current: number | null, pressed: number): number | null =>
  current !== null && Math.abs(current - pressed) <= MARKER_TOLERANCE ? null : pressed;
