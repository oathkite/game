import { describe, expect, it } from "vitest";
import { COS_TABLE, ONE, SIN_TABLE, TILT_TABLE } from "../src/index.js";

const sumAbs = (t: readonly number[]): number => t.reduce((a, v) => a + Math.abs(v), 0);

describe("三角関数表と傾き表", () => {
  it("要素数と代表値が正しい", () => {
    expect(SIN_TABLE).toHaveLength(360);
    expect(COS_TABLE).toHaveLength(360);
    expect(TILT_TABLE).toHaveLength(13);
    expect(SIN_TABLE[0]).toBe(0);
    expect(SIN_TABLE[90]).toBe(ONE);
    expect(SIN_TABLE[30]).toBe(ONE / 2);
    expect(COS_TABLE[0]).toBe(ONE);
    expect(COS_TABLE[180]).toBe(-ONE);
    expect(TILT_TABLE[6]).toBe(0);
    expect(TILT_TABLE[0]).toBe(-45);
    expect(TILT_TABLE[12]).toBe(45);
  });

  it("検査値が生成時の値と一致する（表を書き換えたら更新する）", () => {
    expect(sumAbs(SIN_TABLE)).toBe(15019360);
    expect(sumAbs(COS_TABLE)).toBe(15019360);
    expect(sumAbs(TILT_TABLE)).toBe(346);
  });

  it("すべて整数で、対称性を持つ", () => {
    for (let d = 0; d < 360; d++) {
      expect(Number.isInteger(SIN_TABLE[d])).toBe(true);
      // -0 と +0 を区別しないため === で比べる
      expect((SIN_TABLE[d] ?? 0) === -(SIN_TABLE[(d + 180) % 360] ?? 0)).toBe(true);
      expect(COS_TABLE[d]).toBe(SIN_TABLE[(d + 90) % 360]);
    }
    for (let i = 0; i < 13; i++) expect((TILT_TABLE[i] ?? 0) === -(TILT_TABLE[12 - i] ?? 0)).toBe(true);
  });
});
