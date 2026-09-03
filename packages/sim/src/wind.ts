import type { Wind } from "@game/protocol";
import { GUST_PERCENT, WIND_DELTA_MAX, WIND_MAX } from "./constants.js";

/** サーバー内部の抽選結果。gust は記録用で、クライアントに送る Wind には含めない */
export type WindDraw = {
  readonly wind: Wind;
  readonly gust: boolean;
};
import { clamp } from "./fixed.js";

// 風の変化規則（設計書 01 の 1.5）。乱数はサーバーが引いて渡す。

export type WindRolls = {
  /** 0 から 99。GUST_PERCENT 未満なら突風 */
  readonly gust: number;
  /** 0 から 2 * WIND_MAX。突風時の再抽選に使う */
  readonly value: number;
  /** 0 から 2 * WIND_DELTA_MAX。通常の変化に使う */
  readonly delta: number;
};

export const initialWind = (valueRoll: number): Wind => ({
  value: clamp(valueRoll, 0, 2 * WIND_MAX) - WIND_MAX,
});

export const nextWind = (prev: Wind, rolls: WindRolls): WindDraw => {
  if (rolls.gust < GUST_PERCENT) {
    return { wind: { value: clamp(rolls.value, 0, 2 * WIND_MAX) - WIND_MAX }, gust: true };
  }
  const delta = clamp(rolls.delta, 0, 2 * WIND_DELTA_MAX) - WIND_DELTA_MAX;
  return { wind: { value: clamp(prev.value + delta, -WIND_MAX, WIND_MAX) }, gust: false };
};
