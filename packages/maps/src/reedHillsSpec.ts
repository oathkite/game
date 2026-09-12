import { REED_HILLS_COLUMNS } from "./reedHillsData.js";
import type { MapSpec } from "./spec.js";

export const REED_HILLS_SPEC: MapSpec = {
  id: "reed-hills", version: 3, width: 400, height: 225, status: "test-only",
  surface: REED_HILLS_COLUMNS.map(runs => runs[0]?.[0] ?? 225), solidColumns: REED_HILLS_COLUMNS,
  spawns: Object.fromEntries(Array.from({ length: 7 }, (_, i) => {
    const count = i + 2;
    return [count, Array.from({ length: count }, (_, seat) => Math.round(55 + 290 * seat / (count - 1)))];
  })),
};
