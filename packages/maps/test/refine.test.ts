import { describe, expect, it } from "vitest";
import { allMaps, buildMapSpec, columnsOfMask, MULTIPLAYER_MAPS } from "../src/index.js";
import { applyOps, carve, buildInitialTerrain, spawnPos, isRingOut } from "@game/sim";

describe("refined rock arches", () => {
  for (const map of MULTIPLAYER_MAPS.filter(map => map.id === "rock-arch")) it(`${map.id} has a destructible deck and a bottomless opening`, () => {
    const { mask } = buildMapSpec(map, 8);
    const columns = columnsOfMask(mask), at = Math.floor(mask.width / 2);
    expect(at).toBeGreaterThanOrEqual(0);
    const lower = spawnPos(mask, at, columns[at]![0]![1]);
    expect(isRingOut(mask, lower)).toBe(true);
    const opened = carve(mask, { cx: at, cy: columns[at]![0]![0], radius: 16 });
    expect(opened.cells).not.toEqual(mask.cells);
    expect(applyOps(buildInitialTerrain(map), map.voids ?? []).cells).toEqual(mask.cells);
  });
  for (const map of allMaps()) it(`${map.name} remains deterministic after refinement`, () => {
    expect(map.build().cells).toEqual(map.build().cells);
  });
});
