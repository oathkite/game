import type { MapSpec } from "./spec.js";

const arena = (id: string, width: number, height: number, valley: boolean): MapSpec => ({
  id, version: 1, width, height, status: "test-only",
  surface: Array.from({ length: width }, (_, x) => Math.round(height * 0.62 +
    (valley ? 20 * Math.sin(Math.PI * x / (width - 1)) : 8 * Math.cos(4 * Math.PI * x / (width - 1))))),
  spawns: Object.fromEntries(Array.from({ length: 7 }, (_, i) => {
    const count = i + 2;
    return [count, Array.from({ length: count }, (_, seat) => Math.round(width * 0.22 + width * 0.56 * seat / (count - 1)))];
  })),
});
export const MULTIPLAYER_MAPS: readonly MapSpec[] = [
  arena("moss-valley", 500, 225, true),
  arena("reed-hills", 400, 200, false),
];
export const multiplayerMap = (id: string): MapSpec | undefined => MULTIPLAYER_MAPS.find(map => map.id === id);
export const MULTIPLAYER_MAP_LABELS: Readonly<Record<string, string>> = {
  "moss-valley": "苔の谷", "reed-hills": "葦の丘",
};
