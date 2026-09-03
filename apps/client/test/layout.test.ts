import { describe, expect, it } from "vitest";
import { computeLayout } from "@/game/scale";

describe("computeLayout", () => {
  it("基準表示の 1600 + 192 × 900 ではセルが 4 px になる", () => {
    const l = computeLayout(1792, 900);
    expect(l.cell).toBe(4);
    expect(l.panelWidth).toBe(96);
    expect(l.mapWidth).toBe(1600);
    expect(l.mapHeight).toBe(900);
  });

  it("縦横比を保ち、収まる最大の整数倍を選ぶ", () => {
    expect(computeLayout(1400, 800).cell).toBe(3);
    expect(computeLayout(900, 500).cell).toBe(2);
    expect(computeLayout(3000, 700).cell).toBe(3);
  });

  it("小さすぎる画面でも 1 px は保つ", () => {
    expect(computeLayout(320, 200).cell).toBe(1);
  });
});
