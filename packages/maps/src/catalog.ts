import { RIDGELINE, STONE_BRIDGE, TERRACES, SKY_ISLANDS } from "./pixelMaps.js";
import type { MapSpec } from "./spec.js";

export const MULTIPLAYER_MAPS: readonly MapSpec[] = [RIDGELINE, STONE_BRIDGE, TERRACES, SKY_ISLANDS];
export const multiplayerMap = (id: string): MapSpec | undefined => MULTIPLAYER_MAPS.find(map => map.id === id);
export const MULTIPLAYER_MAP_LABELS: Readonly<Record<string, string>> = {
  "moss-valley": "稜線", "rock-arch": "石橋", "reed-hills": "段丘", "sky-islands": "浮島",
};
