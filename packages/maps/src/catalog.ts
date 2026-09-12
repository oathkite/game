import { REED_HILLS_SPEC } from "./reedHillsSpec.js";
import { ROCK_ARCH_SPEC } from "./rockArchSpec.js";
import { MOSS_VALLEY_SPEC } from "./mossValleySpec.js";
import type { MapSpec } from "./spec.js";

export const MULTIPLAYER_MAPS: readonly MapSpec[] = [
  MOSS_VALLEY_SPEC,
  REED_HILLS_SPEC,
  ROCK_ARCH_SPEC,
];
export const multiplayerMap = (id: string): MapSpec | undefined => MULTIPLAYER_MAPS.find(map => map.id === id);
export const MULTIPLAYER_MAP_LABELS: Readonly<Record<string, string>> = {
  "rock-arch": "苔むす岩橋", "moss-valley": "苔の谷", "reed-hills": "葦の丘",
};
