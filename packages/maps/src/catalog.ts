import { REED_HILLS_SPEC } from "./reedHillsSpec.js";
import { ROCK_ARCH_SPEC } from "./rockArchSpec.js";
import { archCuts } from "./refine.js";
import type { MapSpec } from "./spec.js";

const arena = (id: string, width: number, height: number, valley: boolean): MapSpec => ({
  id, version: 2, width, height, status: "test-only",
  surface: Array.from({ length: width }, (_, x) => Math.round(height * 0.62 +
    (valley ? 20 * Math.sin(Math.PI * x / (width - 1)) : 8 * Math.cos(4 * Math.PI * x / (width - 1))))),
  voids: archCuts(Math.round(width * 0.34), Math.round(width * 0.66), height - 12, 20),
  spawns: Object.fromEntries(Array.from({ length: 7 }, (_, i) => {
    const count = i + 2;
    return [count, Array.from({ length: count }, (_, seat) => Math.round(width * 0.22 + width * 0.56 * seat / (count - 1)))];
  })),
});
export const MULTIPLAYER_MAPS: readonly MapSpec[] = [
  arena("moss-valley", 500, 225, true),
  REED_HILLS_SPEC,
  ROCK_ARCH_SPEC,
];
export const multiplayerMap = (id: string): MapSpec | undefined => MULTIPLAYER_MAPS.find(map => map.id === id);
export const MULTIPLAYER_MAP_LABELS: Readonly<Record<string, string>> = {
  "rock-arch": "苔むす岩橋", "moss-valley": "苔の谷", "reed-hills": "葦の丘",
};
