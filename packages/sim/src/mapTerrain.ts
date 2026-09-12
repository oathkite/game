import { createMask, maskFromHeights, type TerrainMask } from "./terrain.js";

export type InitialTerrain = {
  readonly width: number;
  readonly height: number;
  readonly surface: readonly number[];
  readonly solidColumns?: readonly (readonly (readonly [number, number])[])[] | undefined;
};

/** Frozen map data shared by simulation, persistence and rendering. End is exclusive. */
export const buildInitialTerrain = (map: InitialTerrain): TerrainMask => {
  if (!Number.isInteger(map.width) || map.width < 1 || map.width > 500 || !Number.isInteger(map.height) || map.height < 1 || map.height > 225) throw new Error("invalid terrain dimensions");
  if (map.surface.length !== map.width || map.surface.some(y => !Number.isInteger(y) || y < 0 || y > map.height)) throw new Error("invalid terrain surface");
  if (!map.solidColumns) return maskFromHeights(map.surface, map.height);
  if (map.solidColumns.length !== map.width) throw new Error("invalid terrain columns");
  const mask = createMask(map.width, map.height);
  map.solidColumns.forEach((runs, x) => {
    let previousEnd = 0;
    for (const [start, end] of runs) {
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < previousEnd || start < 0 || start >= end || end > map.height) throw new Error("invalid terrain span");
      for (let y = start; y < end; y++) mask.cells[y * map.width + x] = 1;
      previousEnd = end;
    }
  });
  return mask;
};
