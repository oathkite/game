import type { TerrainOp } from "@game/protocol";
import { applyOps, type TerrainMask } from "@game/sim";

/** A vaulted opening: irregular overlapping cuts retain a solid landing shelf. */
export const archCuts = (left: number, right: number, floor: number, radius: number): readonly TerrainOp[] =>
  Array.from({ length: Math.floor((right - left) / 8) + 1 }, (_, i) => {
    const cx = left + i * 8, t = (cx - left) / Math.max(1, right - left);
    const r = Math.round(radius * (0.72 + 0.28 * Math.sin(Math.PI * t)));
    return { cx, cy: floor - r - Math.round(3 * Math.sin(t * Math.PI * 3)), radius: r };
  });

/** Preserve each authored silhouette and spawn surface; remove mechanical repetition. */
export const refineTerrain = (source: TerrainMask, spawns: readonly number[], name?: string): TerrainMask => {
  const cells = new Uint8Array(source.cells);
  if (name === "valley") {
    for (let x = 140; x <= 260; x++) {
      const distance = Math.abs(x - 200);
      for (let y = 166 + Math.floor(distance / 20); y < 195 + Math.floor(distance / 6); y++) cells[y * source.width + x] = 1;
    }
  }
  if (name === "bridge") {
    for (let x = 110; x <= 290; x++) {
      const top = 190 + Math.floor(Math.abs(x - 200) / 4) + Math.floor(2 * Math.sin(x / 11));
      for (let y = top; y < source.height; y++) cells[y * source.width + x] = 1;
    }
  }
  const openings: Record<string, readonly TerrainOp[]> = {
    valley: archCuts(178, 222, 209, 18),
    mountain: [...archCuts(118, 150, 212, 22), ...archCuts(252, 278, 213, 19)],
    plain: archCuts(157, 239, 211, 24),
    terrace: archCuts(135, 200, 209, 24),
  };
  const mask = applyOps({ ...source, cells }, openings[name ?? ""] ?? []);
  const refined = new Uint8Array(mask.cells);
  for (let x = 1; x < mask.width - 1; x++) {
    if (spawns.some(spawn => Math.abs(x - spawn) < 14)) continue;
    const depth = Math.floor(x / 7) % 3;
    let y = 0;
    while (y < mask.height && !refined[y * mask.width + x]) y++;
    for (let i = 0; i < depth && y + i < mask.height - 1; i++) refined[(y + i) * mask.width + x] = 0;
  }
  return { ...mask, cells: refined };
};
