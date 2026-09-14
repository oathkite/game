import { describe, expect, it } from "vitest";
import { damageSummary } from "../src/game/damageSummary";
describe("damage summary", () => {
  it("totals only positive hits and emphasizes 50 or more", () => {
    expect(damageSummary([0, 18, 18, 18])).toEqual({ total: 54, hits: 3, big: true });
    expect(damageSummary([35, 0])).toEqual({ total: 35, hits: 1, big: false });
    expect(damageSummary([0, 0])).toEqual({ total: 0, hits: 0, big: false });
  });
});
