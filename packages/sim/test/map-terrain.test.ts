import { expect, it } from "vitest";
import { buildInitialTerrain, maskFromHeights } from "../src/index";
it("preserves a bridge, its air gap and lower landing rock", () => {
  const map = { width: 2, height: 12, surface: [2, 2], solidColumns: [[[2, 4], [8, 11]], [[2, 4], [8, 11]]] as const };
  const mask = buildInitialTerrain(map);
  expect(Array.from({ length: 12 }, (_, y) => mask.cells[y * 2])).toEqual([0,0,1,1,0,0,0,0,1,1,1,0]);
  mask.cells[4] = 0;
  expect(buildInitialTerrain(map).cells[4]).toBe(1);
});
it("keeps legacy height maps identical", () => {
  expect(buildInitialTerrain({ width: 2, height: 6, surface: [2, 4] })).toEqual(maskFromHeights([2, 4], 6));
});
it("rejects malformed column ranges", () => {
  for (const solidColumns of [[[[3, 2]]], [[[1, 4], [3, 5]]], [[[0, 7]]], []]) {
    expect(() => buildInitialTerrain({ width: 1, height: 6, surface: [1], solidColumns: solidColumns as [number, number][][] })).toThrow();
  }
});
