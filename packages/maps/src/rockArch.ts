import { createMask, type TerrainMask } from "@game/sim";
import { ROCK_ARCH_COLUMNS } from "./rockArchData.js";

/** Frozen alpha-derived physics. Pixel artwork is only loaded by the renderer. */
export const buildRockArch = (): TerrainMask => {
  const mask = createMask(400, 225);
  ROCK_ARCH_COLUMNS.forEach((runs, x) => {
    for (const [top, bottom] of runs) for (let y = top; y < bottom; y++) mask.cells[y * mask.width + x] = 1;
  });
  return mask;
};
