import { expect, it } from "vitest";
import { buildMapSpec, TEST_ARENA } from "../src/spec";
import { hasClearance, isRingOut, stepOutcome } from "@game/sim";

it("builds a versioned 500-cell test arena for 2..8 players with safe distinct spawns", () => {
  for (let count = 2; count <= 8; count++) {
    const { mask, spawns } = buildMapSpec(TEST_ARENA, count);
    expect(mask.width).toBe(500); expect(mask.height).toBe(225);
    expect(spawns).toHaveLength(count); expect(new Set(spawns.map(p => p.x)).size).toBe(count);
    for (const p of spawns) {
      expect(isRingOut(mask, p)).toBe(false);
      expect(hasClearance(mask, p.x, p.y)).toBe(true);
      expect(stepOutcome(mask, p, 1).kind).toBe("moved");
      expect(stepOutcome(mask, p, -1).kind).toBe("moved");
    }
  }
});
it("rejects unsupported counts, invalid dimensions and overlapping spawns", () => {
  for (const count of [1, 9, 2.5]) expect(() => buildMapSpec(TEST_ARENA, count)).toThrow();
  expect(() => buildMapSpec({ ...TEST_ARENA, width: 0 }, 2)).toThrow();
  expect(() => buildMapSpec({ ...TEST_ARENA, spawns: { 2: [100, 100] } }, 2)).toThrow();
});
