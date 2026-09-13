import { MOSS_VALLEY_COLUMNS } from "./mossValleyData.js";
import type { MapSpec } from "./spec.js";

export const MOSS_VALLEY_SPEC: MapSpec = {
  id: "moss-valley", version: 3, width: 500, height: 225, status: "test-only",
  surface: MOSS_VALLEY_COLUMNS.map(runs => runs[0]?.[0] ?? 225), solidColumns: MOSS_VALLEY_COLUMNS,
  spawns: Object.fromEntries(Array.from({ length: 7 }, (_, i) => {
    const count = i + 2;
    return [count, Array.from({ length: count }, (_, seat) => Math.round(110 + 280 * seat / (count - 1)))];
  })),
};
