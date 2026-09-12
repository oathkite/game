import { expect, it } from "vitest";
import { imageTerrainSource } from "../src/worldUi/assets";
it("selects artwork by both map identity and frozen revision", () => {
  expect(imageTerrainSource({ id: "rock-arch", version: 2 })).toBeTypeOf("string");
  expect(imageTerrainSource({ id: "reed-hills", version: 3 })).toBeTypeOf("string");
  expect(imageTerrainSource({ id: "reed-hills", version: 3 })).not.toBe(imageTerrainSource({ id: "rock-arch", version: 2 }));
  expect(imageTerrainSource({ id: "moss-valley", version: 3 })).toBeTypeOf("string");
  expect(imageTerrainSource({ id: "moss-valley", version: 2 })).toBeUndefined();
  expect(imageTerrainSource({ id: "reed-hills", version: 2 })).toBeUndefined();
  expect(imageTerrainSource({ id: "rock-arch", version: 1 })).toBeUndefined();
  expect(imageTerrainSource({ id: "reed-hills", version: 99 })).toBeUndefined();
});
