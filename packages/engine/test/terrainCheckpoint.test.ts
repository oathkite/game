import { expect, it } from "vitest";
import { applyOps, maskFromHeights } from "@game/sim";
import { captureTerrainCheckpoint, restoreTerrainCheckpoint } from "../src/multiplayer/terrainCheckpoint";
it("restores holes and applies only the tail after a checkpoint", () => {
  const base = maskFromHeights([2, 2, 2, 2, 2], 10);
  const ops = [{ cx: 2, cy: 6, radius: 1 }, { cx: 3, cy: 2, radius: 2 }];
  const checkpoint = captureTerrainCheckpoint(applyOps(base, ops.slice(0, 1)), 1);
  expect(restoreTerrainCheckpoint(checkpoint, 5, 10, ops)).toEqual(applyOps(base, ops));
  expect(() => restoreTerrainCheckpoint({ ...checkpoint, opCount: 3 }, 5, 10, ops)).toThrow();
  expect(() => restoreTerrainCheckpoint({ ...checkpoint, columns: "0-20;;;;" }, 5, 10, ops)).toThrow();
  expect(() => restoreTerrainCheckpoint({ ...checkpoint, width: 6 }, 5, 10, ops)).toThrow();
  expect(() => restoreTerrainCheckpoint({ ...checkpoint, columns: "2-6,4-8;;;;" }, 5, 10, ops)).toThrow();
});
