import { describe, expect, it } from "vitest";
import { initialWind, nextWind } from "../src/index.js";

describe("風の変化規則", () => {
  it("初回は出目から -10 から 10 に写す", () => {
    expect(initialWind(0)).toEqual({ value: -10 });
    expect(initialWind(10)).toEqual({ value: 0 });
    expect(initialWind(20)).toEqual({ value: 10 });
    expect(initialWind(99).value).toBe(10);
  });

  it("通常は前の値に -2 から +2 を加え、範囲の端で止まる", () => {
    const prev = { value: 3 };
    expect(nextWind(prev, { gust: 50, value: 0, delta: 0 })).toEqual({ wind: { value: 1 }, gust: false });
    expect(nextWind(prev, { gust: 50, value: 0, delta: 2 })).toEqual({ wind: { value: 3 }, gust: false });
    expect(nextWind(prev, { gust: 50, value: 0, delta: 4 })).toEqual({ wind: { value: 5 }, gust: false });
    expect(nextWind({ value: 10 }, { gust: 99, value: 0, delta: 4 }).wind.value).toBe(10);
    expect(nextWind({ value: -9 }, { gust: 15, value: 0, delta: 0 }).wind.value).toBe(-10);
  });

  it("突風の出目が 15 未満なら再抽選になる", () => {
    expect(nextWind({ value: 3 }, { gust: 0, value: 20, delta: 0 })).toEqual({ wind: { value: 10 }, gust: true });
    expect(nextWind({ value: 3 }, { gust: 14, value: 0, delta: 0 })).toEqual({ wind: { value: -10 }, gust: true });
    expect(nextWind({ value: 3 }, { gust: 15, value: 0, delta: 2 }).gust).toBe(false);
  });
});
