import { ROCK_ARCH_COLUMNS } from "./rockArchData.js";
import type { MapSpec } from "./spec.js";

/** Authored terrain candidate; register only with a matching client build. */
export const ROCK_ARCH_SPEC: MapSpec = {
  id: "rock-arch", version: 2, width: 400, height: 225, status: "test-only",
  surface: ROCK_ARCH_COLUMNS.map(runs => runs[0]?.[0] ?? 225),
  solidColumns: ROCK_ARCH_COLUMNS,
  spawns: Object.fromEntries(Array.from({ length: 7 }, (_, i) => {
    const count = i + 2;
    return [count, Array.from({ length: count }, (_, seat) => Math.round(60 + 280 * seat / (count - 1)))];
  })),
};
