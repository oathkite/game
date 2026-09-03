import { ONE } from "./constants.js";
import { COS_TABLE, SIN_TABLE } from "./tables.js";

// 固定小数点の補助。ビット演算は 32 bit に切り詰めるので使わない。

export const toFixed = (cells: number): number => cells * ONE;

/** 固定小数点をセル座標に切り捨てる */
export const cellOf = (fp: number): number => Math.floor(fp / ONE);

/** 固定小数点同士の積。a は位置や速度、b は係数を想定する */
export const mulFixed = (a: number, b: number): number => Math.trunc((a * b) / ONE);

export const normalizeDegrees = (deg: number): number => ((deg % 360) + 360) % 360;

export const sinFixed = (deg: number): number => SIN_TABLE[normalizeDegrees(deg)] ?? 0;

export const cosFixed = (deg: number): number => COS_TABLE[normalizeDegrees(deg)] ?? 0;

/** 整数の平方根（切り捨て）。二分探索で浮動小数点を使わない */
export const isqrt = (n: number): number => {
  if (n <= 0) return 0;
  let lo = 0;
  let hi = Math.min(n, 1 << 26);
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (mid * mid <= n) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
