import { columnsOfMask, decodeColumns, encodeColumns } from "@game/maps";
import { applyOps, createMask, type TerrainMask } from "@game/sim";
import type { TerrainOp } from "@game/protocol";
export type TerrainCheckpoint = { readonly version: 1; readonly width: number; readonly height: number; readonly opCount: number; readonly columns: string; readonly checksum: number };
const checksum = (text: string): number => {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
};
const content = (width: number, height: number, opCount: number, columns: string) => `${width}:${height}:${opCount}:${columns}`;
export const captureTerrainCheckpoint = (mask: TerrainMask, opCount: number): TerrainCheckpoint => {
  const columns = encodeColumns(columnsOfMask(mask));
  return { version: 1, width: mask.width, height: mask.height, opCount, columns, checksum: checksum(content(mask.width, mask.height, opCount, columns)) };
};
export const restoreTerrainCheckpoint = (checkpoint: TerrainCheckpoint, width: number, height: number, ops: readonly TerrainOp[]): TerrainMask => {
  if (checkpoint.version !== 1 || checkpoint.width !== width || checkpoint.height !== height ||
    !Number.isSafeInteger(checkpoint.opCount) || checkpoint.opCount < 0 || checkpoint.opCount > ops.length || typeof checkpoint.columns !== "string") throw new Error("invalid terrain checkpoint");
  if (checkpoint.checksum !== checksum(content(width, height, checkpoint.opCount, checkpoint.columns))) throw new Error("checkpoint checksum mismatch");
  const columns = decodeColumns(checkpoint.columns);
  if (columns.length !== width) throw new Error("invalid checkpoint width");
  const mask = createMask(width, height);
  columns.forEach((runs, x) => {
    let end = 0;
    for (const [top, bottom] of runs) {
      if (!Number.isSafeInteger(top) || !Number.isSafeInteger(bottom) || top < end || top < 0 || bottom <= top || bottom > height) throw new Error("invalid checkpoint run");
      for (let y = top; y < bottom; y++) mask.cells[y * width + x] = 1;
      end = bottom;
    }
  });
  return applyOps(mask, ops.slice(checkpoint.opCount));
};
