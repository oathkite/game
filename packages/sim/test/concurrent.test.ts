import { expect, it } from "vitest";
import { WEAPON_IDS } from "@game/protocol";
import { flatMask, shot } from "../src/fixtures";
import { maskFromHeights } from "../src/terrain";
import { simulateCombat } from "../src/ballistics";
import { simulateConcurrentCombat } from "../src/concurrent";
it("resolves all simultaneous muzzle impacts against the same living targets", () => {
  const mask = maskFromHeights(Array.from({ length: 400 }, (_, x) => x === 64 ? 140 : 150), 225);
  const players = [{ x: 60, y: 150, hp: 10000 }, { x: 64, y: 150, hp: 1 }];
  const input = shot({ weapon: "triple", elevation: 10, power: 20 });
  const result = simulateConcurrentCombat(mask, players, input);
  expect(result.impacts).toHaveLength(3);
  expect(result.impacts.map(i => i.tick)).toEqual([0, 0, 0]);
  expect(result.impacts.map(i => i.damage[1])).toEqual([15, 15, 15]);
  expect(result.hpAfter[1]).toBe(-44);
  expect(players[1]!.hp).toBe(1); expect(mask.cells[140 * 400 + 64]).toBe(1);
});
it("retains single-flight physical results and records monotonic global ticks", () => {
  const players = [{ x: 60, y: 150, hp: 10000 }, { x: 300, y: 150, hp: 10000 }];
  for (const weapon of ["cannon", "digger", "floater", "stinger"] as const) {
    const input = shot({ weapon }), legacy = simulateCombat(flatMask(), players, input), next = simulateConcurrentCombat(flatMask(), players, input);
    expect(next.mask).toEqual(legacy.mask); expect(next.hpAfter).toEqual(legacy.hpAfter);
    expect(next.paths.map(({ points, impactAt }) => ({ points, impactAt }))).toEqual(legacy.paths);
    expect(next.impacts.map(({ tick, ...impact }) => impact)).toEqual(legacy.impacts);
  }
  for (const weapon of WEAPON_IDS) {
    const result = simulateConcurrentCombat(flatMask(), players, shot({ weapon, power: 100, wind: -10 }));
    expect(result.impacts.map(i => i.tick)).toEqual(result.impacts.map(i => i.tick).sort((a, b) => a - b));
    for (const path of result.paths) {
      expect(path.pointTicks).toHaveLength(path.points.length);
      expect(path.pointTicks).toEqual([...path.pointTicks].sort((a, b) => a - b));
    }
    expect(simulateConcurrentCombat(flatMask(), players, shot({ weapon, power: 100, wind: -10 }))).toEqual(result);
  }
});
it("removes defeated collision bodies only after a tick batch and staggers later volleys", () => {
  const mask = maskFromHeights(Array.from({ length: 400 }, (_, x) => x === 64 ? 140 : 150), 225);
  const result = simulateConcurrentCombat(mask, [{ x: 60, y: 150, hp: 10000 }, { x: 64, y: 150, hp: 1 }], shot({ weapon: "multiple", elevation: 10, power: 20 }));
  expect(result.paths.map(p => p.launchTick)).toEqual([0, 0, 0, 11, 11, 11, 22, 22, 22]);
  expect(result.impacts.filter(i => i.tick === 0).map(i => i.damage[1])).toEqual([5, 5, 5]);
  expect(result.impacts.filter(i => i.tick > 0).every(i => i.damage[1] === 0)).toBe(true);
});
