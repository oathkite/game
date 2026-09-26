import { expect, it } from "vitest";
import { weaponPixels, weaponPixelHeight } from "../src/game/weaponPixels";
import { WEAPON_IDS } from "@game/protocol";
it("gives every weapon a distinct integer pixel silhouette", () => {
  const patterns = WEAPON_IDS.map(id => weaponPixels(id));
  expect(new Set(patterns.map(p => JSON.stringify(p))).size).toBe(WEAPON_IDS.length);
  for (const [index, pattern] of patterns.entries()) {
    expect(pattern.length).toBeGreaterThan(8);
    for (const p of pattern) { expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true); expect(p.x).toBeLessThan(12); expect(p.y).toBeLessThan(weaponPixelHeight(WEAPON_IDS[index]!)); }
  }
});
