import { WIND_MAX } from "@game/sim";
import type { Rect } from "@/game/pixelGrid";

// 風のメーターの片側（設計書 08 の 8.5）。単位は art px で、表示は 1 art px を 2 CSS px（広い画面は 3 CSS px）の整数倍にする（40.3、40.10）。
// 中央（x = 0）から外へ、風 1 につき 1 目盛り伸ばす。左側は mirrorRects で左右を反転する。

/** 風 1 の幅。操作盤の角度メーターの列に収めるため 2 にする */
export const WIND_METER_PITCH = 2;
export const WIND_METER_HEIGHT = 7;
export const WIND_METER_HALF = WIND_MAX * WIND_METER_PITCH;

/** 矢じりの列の高さ。先端の列は 1 art px */
const HEAD = [7, 5, 3, 1] as const;
const SHAFT_Y = 2, SHAFT_HEIGHT = 3;

/** 矢印の長さにする強さ。範囲外の値は端で止める */
export const windStrength = (wind: number): number => Math.min(WIND_MAX, Math.abs(Math.trunc(wind)));

/** 強さの分だけ伸ばした右向きの矢印。先端は強さの目盛りに重なる */
export const windArrowRects = (strength: number): readonly Rect[] => {
  if (strength <= 0) return [];
  const headLeft = strength * WIND_METER_PITCH - HEAD.length;
  const shaft = headLeft > 0 ? [{ left: 0, top: SHAFT_Y, width: headLeft, height: SHAFT_HEIGHT }] : [];
  const head = HEAD.map((height, i) => ({ left: headLeft + i, top: (WIND_METER_HEIGHT - height) / 2, width: 1, height })).filter(r => r.left >= 0);
  return [...shaft, ...head];
};

/** 風 1 ごとの目盛り。5 と 10 は長くする */
export const windTicks = (): readonly (Rect & { readonly major: boolean })[] => Array.from({ length: WIND_MAX }, (_, i) => {
  const major = (i + 1) % 5 === 0;
  return { left: (i + 1) * WIND_METER_PITCH - 1, top: major ? SHAFT_Y : 3, width: 1, height: major ? SHAFT_HEIGHT : 1, major };
});

/** 左半分に描くため左右を反転する。中央（片側の右端）から外（左）へ伸びる形になる */
export const mirrorRects = <T extends Rect>(rects: readonly T[]): readonly T[] => rects.map(r => ({ ...r, left: WIND_METER_HALF - r.left - r.width }));
