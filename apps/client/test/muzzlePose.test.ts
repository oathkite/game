import { expect, it } from "vitest";
import { muzzlePose, shotFlashes } from "../src/game/muzzlePose";
it("selects authored frames and expires at 140ms without replaying old launches", () => {
  expect([0, 25, 60, 100].map(age => muzzlePose("cannon", { age, index: 0 }, 0).frame)).toEqual([0, 1, 2, 3]);
  expect(shotFlashes(140, [0, 120, 300])).toEqual([{ age: 20, index: 1 }]);
  expect(shotFlashes(500, [0, 120, 300])).toEqual([]);
});
it("uses separate emission ports and follows recoil at the original pixel scale", () => {
  expect([0, 1, 2].map(index => muzzlePose("triple", { age: 0, index }, 3).y)).toEqual([-103 / 12, -8, -89 / 12]);
  expect(muzzlePose("cannon", { age: 0, index: 0 }, 3).x).toBe(-51 / 12);
  expect([0, 1, 2].map(index => muzzlePose("multiple", { age: 0, index }, 0).y)).toEqual([-106 / 12, -8, -87 / 12]);
});
it("energy flashes use their first frame and fade instead of an orange muzzle", () => {
  for (const weapon of ["laser", "floater"] as const) expect(muzzlePose(weapon, { age: 70, index: 0 }, 0)).toMatchObject({ id: "effect-energy", frame: 0, alpha: .5 });
});
