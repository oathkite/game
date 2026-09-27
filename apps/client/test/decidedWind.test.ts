import { describe, expect, it } from "vitest";
import { decidedWind } from "../src/match/wind";
import { EMPTY_VIEW } from "../src/match/types";

// 1 ターン目の turn.start までは、view.wind は初期値 0 のままで無風を意味しない（設計書 08 の 8.5）

describe("decidedWind", () => {
  it("is undecided before the first turn starts", () => {
    expect(decidedWind(EMPTY_VIEW)).toBeNull();
    expect(decidedWind({ ...EMPTY_VIEW, wind: { value: 5 } })).toBeNull();
  });
  it.each([[1, 0], [1, -3], [7, 10], [30, -10]])("returns the wind of turn %s as it is (%s)", (turnNumber, value) => {
    expect(decidedWind({ ...EMPTY_VIEW, turnNumber, wind: { value } })).toBe(value);
  });
});
