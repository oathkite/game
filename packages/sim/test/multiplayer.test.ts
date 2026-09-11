import { WEAPON_IDS } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { flatMask, shot } from "../src/fixtures";
import { simulateCombat, simulateShot } from "../src/ballistics";

describe("variable combatants", () => {
  it("damages every overlapping target in the same impact and excludes defeated players", () => {
    const mask = flatMask();
    const players = Array.from({ length: 8 }, (_, i) => ({ x: i === 0 ? 60 : 70, y: 150, hp: i === 7 ? 0 : 100 }));
    const result = simulateCombat(mask, players, shot({ elevation: 0, power: 20 }));
    expect(result.impacts.length).toBeGreaterThan(0);
    const damage = result.impacts[0]!.damage;
    expect(damage[1]).toBeGreaterThan(0);
    for (let i = 2; i < 7; i++) expect(damage[i]).toBe(damage[1]);
    expect(damage[7]).toBe(0);
    expect(result.hpAfter).toHaveLength(8);
    expect(players[1]!.hp).toBe(100);
    expect(mask.cells).toEqual(flatMask().cells);
  });
  it("preserves two-player physical trajectories, terrain and hp for every weapon", () => {
    const players = [{ x: 60, y: 150, hp: 10000 }, { x: 200, y: 150, hp: 10000 }] as const;
    for (const weapon of WEAPON_IDS) {
      const input = shot({ weapon });
      const legacy = simulateShot(flatMask(), players, input);
      const next = simulateCombat(flatMask(), players, input);
      expect(next.mask).toEqual(legacy.mask); expect(next.paths).toEqual(legacy.paths);
      expect(next.impacts).toEqual(legacy.result.impacts); expect(next.hpAfter).toEqual(legacy.result.hpAfter);
    }
  });
});
