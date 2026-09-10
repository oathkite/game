import { expect, it } from "vitest";
import { MULTIPLAYER_MAPS } from "../src/catalog";
import { buildMapSpec } from "../src/spec";
it("supports every player count with safe spawns on different map sizes", () => {
  expect(new Set(MULTIPLAYER_MAPS.map(map => map.width)).size).toBeGreaterThan(1);
  for (const map of MULTIPLAYER_MAPS) for (let count = 2; count <= 8; count++) {
    const built = buildMapSpec(map, count);
    expect(built.spawns).toHaveLength(count);
    expect(built.mask.width).toBe(map.width);
  }
});
