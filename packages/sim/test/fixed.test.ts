import { describe, expect, it } from "vitest";
import { cellOf, cosFixed, isqrt, mulFixed, normalizeDegrees, ONE, sinFixed, toFixed } from "../src/index.js";

describe("固定小数点の補助", () => {
  it("セルと固定小数点を往復できる", () => {
    expect(toFixed(3)).toBe(3 * ONE);
    expect(cellOf(3 * ONE)).toBe(3);
    expect(cellOf(3 * ONE + ONE - 1)).toBe(3);
    expect(cellOf(-1)).toBe(-1);
  });

  it("積は切り捨てで、結果は整数", () => {
    expect(mulFixed(4 * ONE, ONE / 2)).toBe(2 * ONE);
    expect(mulFixed(-3 * ONE, ONE / 2)).toBe(Math.trunc(-1.5 * ONE));
    expect(Number.isInteger(mulFixed(123457, 65535))).toBe(true);
  });

  it("角度は 360 で正規化され、負の角度も引ける", () => {
    expect(normalizeDegrees(-35)).toBe(325);
    expect(normalizeDegrees(215)).toBe(215);
    expect(normalizeDegrees(360)).toBe(0);
    expect(sinFixed(-90)).toBe(-ONE);
    expect(cosFixed(215)).toBe(cosFixed(-145));
  });

  it("整数平方根は切り捨て", () => {
    expect(isqrt(0)).toBe(0);
    expect(isqrt(1)).toBe(1);
    expect(isqrt(8)).toBe(2);
    expect(isqrt(9)).toBe(3);
    expect(isqrt(99)).toBe(9);
    expect(isqrt(100)).toBe(10);
    expect(isqrt(-5)).toBe(0);
  });
});
