import { describe, expect, it } from "vitest";
import { allMaps, buildMapSpec, columnsOfMask, MULTIPLAYER_MAPS } from "../src/index.js";
import { applyOps, carve, buildInitialTerrain, spawnPos } from "@game/sim";

describe("refined rock arches", () => {
  for (const map of MULTIPLAYER_MAPS) it(`${map.id} has a destructible deck and a landable lower floor`, () => {
    const { mask } = buildMapSpec(map, 8);
    const columns = columnsOfMask(mask), at = columns.findIndex(runs => runs.length >= 2 && runs[1]![0] - runs[0]![1] >= 20);
    expect(at).toBeGreaterThanOrEqual(0);
    const lower = spawnPos(mask, at, columns[at]![0]![1]);
    expect(lower.y).toBeGreaterThan(columns[at]![0]![1]);
    const opened = carve(mask, { cx: at, cy: columns[at]![0]![0], radius: 16 });
    expect(opened.cells).not.toEqual(mask.cells);
    expect(applyOps(buildInitialTerrain(map), map.voids ?? []).cells).toEqual(mask.cells);
  });
  for (const map of allMaps()) it(`${map.name} remains deterministic after refinement`, () => {
    expect(map.build().cells).toEqual(map.build().cells);
  });
});
