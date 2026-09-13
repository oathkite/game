import type { MapSpec } from "./spec.js";

type Point = readonly [number, number];
type Span = readonly [number, number];
const heightAt = (points: readonly Point[], x: number): number => {
  const right = points.findIndex(point => point[0] >= x);
  if (right <= 0) return points[Math.max(0, right)]![1];
  const [ax, ay] = points[right - 1]!, [bx, by] = points[right]!;
  return Math.round(ay + (by - ay) * (x - ax) / (bx - ax));
};
const makeMap = (id: string, width: number, profile: readonly Point[], column: (x: number, y: number) => readonly Span[], seats: readonly number[], scale = 0.7): MapSpec => {
  const sourceWidth = width;
  width = Math.round(width * scale);
  const solidColumns = Array.from({ length: width }, (_, index) => {
    const x = Math.floor(index * sourceWidth / width);
    const safe = seats.some(seat => Math.abs(seat - x) < 12);
    const ledge = safe ? 0 : Math.round(Math.sin(x / 8) + Math.sin(x / 3) * 0.6);
    return column(x, heightAt(profile, x) + ledge);
  });
  return {
    id, version: 5, width, height: 225, status: "test-only", solidColumns,
    surface: solidColumns.map(runs => runs[0]?.[0] ?? 225),
    spawns: Object.fromEntries(Array.from({ length: 7 }, (_, i) => {
      const count = i + 2;
      return [count, Array.from({ length: count }, (_, seat) => Math.round(seats[Math.round(seat * 7 / (count - 1))]! * width / sourceWidth))];
    })),
  };
};

// Broad shoulders and a central ridge leave room for movement and high-angle shots.
export const RIDGELINE = makeMap("moss-valley", 500,
  [[0, 160], [55, 151], [115, 151], [155, 139], [190, 124], [220, 124], [250, 103], [280, 124], [310, 124], [345, 139], [385, 151], [445, 151], [499, 160]],
  (_x, y) => [[y, 225]], [65, 110, 160, 205, 295, 340, 390, 435]);

// A thin central deck spans a bottomless arch with thick, tapered supports.
export const STONE_BRIDGE = makeMap("rock-arch", 460,
  [[0, 145], [40, 132], [100, 132], [150, 117], [190, 117], [230, 109], [270, 117], [310, 117], [360, 132], [420, 132], [459, 145]],
  (x, y) => {
    if (x <= 60 || x >= 400) return [[y, 225]];
    const floor = 225;
    const roof = y + 17 + Math.round(Math.abs(x - 230) / 12);
    const edge = Math.min(1, (x - 60) / 72, (400 - x) / 80);
    const taper = edge * edge * (3 - 2 * edge);
    const opening = Math.round((floor - roof + 2 * Math.sin(x / 7)) * taper);
    if (opening < 1) return [[y, 225]];
    return [[y, floor - opening]];
  },
  [50, 95, 150, 190, 270, 310, 365, 410]);

// High outer terraces descend into a broad central basin.
export const TERRACES = makeMap("reed-hills", 500,
  [[0, 80], [40, 80], [65, 80], [90, 105], [115, 105], [145, 135], [170, 135], [195, 160], [220, 160], [240, 180], [260, 180], [280, 160], [305, 160], [330, 135], [355, 135], [385, 105], [410, 105], [435, 80], [460, 80], [499, 80]],
  (_x, y) => [[y, 225]], [55, 100, 160, 205, 295, 340, 400, 445]);

// Six islands rise to a broad summit, with smaller stepping stones below.
export const SKY_ISLANDS = makeMap("sky-islands", 480,
  [[0, 142], [479, 142]],
  (x) => {
    const island = [
      [12, 102, 155, 40], [120, 176, 135, 24], [194, 286, 120, 42],
      [305, 340, 145, 18], [360, 420, 135, 35], [438, 467, 165, 14],
    ].find(([left, right]) => x >= left! && x <= right!);
    if (!island) return [];
    const [left, right, top, depth] = island as [number, number, number, number];
    const edge = Math.min(x - left, right - x);
    const crest = top + Math.max(0, 7 - edge);
    const point = left + (right - left) * 0.58;
    const taper = Math.max(0, 1 - Math.abs(x - point) / ((right - left) * 0.65));
    const bottom = top + 10 + Math.round(depth * taper + 2 * Math.sin(x / 4));
    return [[crest, Math.max(crest + 6, bottom)]];
  }, [40, 75, 145, 220, 260, 322, 390, 452], 0.62);
