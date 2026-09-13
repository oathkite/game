import { expect, it } from "vitest";
import { TANK_PIXELS, treadPixels } from "../src/game/tankPixels";
import { weaponPixels } from "../src/game/weaponPixels";
import { WEAPON_IDS } from "@game/protocol";
it("animates treads by displacement without escaping the track housing", () => {
  expect(treadPixels(0)).toEqual(treadPixels(1.5));
  expect(treadPixels(.5)).not.toEqual(treadPixels(0));
  for (const d of [-1,-.5,0,.1,.5,1,1.5,20]) for (const p of treadPixels(d)) {
    expect(p.x).toBeGreaterThanOrEqual(12); expect(p.x+p.w).toBeLessThanOrEqual(64); expect(p.w).toBeGreaterThan(0);
  }
  expect(TANK_PIXELS.some(p => p.part === "turret")).toBe(true);
});
it("gives every weapon a distinct integer pixel silhouette", () => {
  const patterns = WEAPON_IDS.map(id => weaponPixels(id));
  expect(new Set(patterns.map(p => JSON.stringify(p))).size).toBe(WEAPON_IDS.length);
  for (const pattern of patterns) {
    expect(pattern.length).toBeGreaterThan(8);
    for (const p of pattern) { expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true); expect(p.x).toBeLessThan(8); expect(p.y).toBeLessThan(8); }
  }
});
