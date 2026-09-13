import { expect, it } from "vitest";
import { MULTIPLAYER_MAPS } from "../src/catalog";
import { getMap } from "../src/index";
import { buildMapSpec } from "../src/spec";

it("offers four distinct maps with safe starts for two through eight players", () => {
  expect(MULTIPLAYER_MAPS).toHaveLength(4);
  const silhouettes = new Set<string>();
  for (const map of MULTIPLAYER_MAPS) {
    silhouettes.add(JSON.stringify(map.surface));
    for (let count = 2; count <= 8; count++) {
      const { spawns } = buildMapSpec(map, count);
      expect(spawns).toHaveLength(count);
      expect(spawns.every(p => p.y < 200)).toBe(true);
    }
  }
  expect(silhouettes.size).toBe(4);
});

it("keeps open air between islands and open space below the stone bridge", () => {
  const island = MULTIPLAYER_MAPS.find(m => m.id === "sky-islands")!;
  expect(island.solidColumns!.some(column => column.length === 0)).toBe(true);
  const bridge = MULTIPLAYER_MAPS.find(m => m.id === "rock-arch")!;
  expect(bridge.solidColumns![Math.floor(bridge.width / 2)]).toHaveLength(1);
  expect(bridge.solidColumns![Math.floor(bridge.width / 2)]![0]![1]).toBeLessThan(140);
});

it("uses the same terrain and firing distances in practice", () => {
  const names = ["ridgeline", "stone-bridge", "terraces", "sky-islands"] as const;
  MULTIPLAYER_MAPS.forEach((spec, index) => {
    const map = getMap(names[index]!), mask = map.build();
    const offset = Math.floor((400 - spec.width) / 2);
    const multiplayer = buildMapSpec(spec, 2);
    expect(map.spawns[1] - map.spawns[0]).toBe(spec.spawns[2]![1]! - spec.spawns[2]![0]!);
    for (let y = 0; y < spec.height; y++) {
      expect(mask.cells.slice(y * 400 + offset, y * 400 + offset + spec.width))
        .toEqual(multiplayer.mask.cells.slice(y * spec.width, (y + 1) * spec.width));
    }
  });
});

it("extends solid practice maps to both edges without introducing artificial gaps", () => {
  for (const name of ["ridgeline", "terraces"] as const) {
    const mask = getMap(name).build();
    for (let x = 0; x < mask.width; x++) {
      expect(mask.cells[(mask.height - 1) * mask.width + x], `${name}: bottom at ${x}`).toBe(1);
    }
  }
  const islands = getMap("sky-islands").build();
  expect(islands.cells[(islands.height - 1) * islands.width]).toBe(0);
});

it("tapers both ends of the bridge opening without abrupt vertical cuts", () => {
  const bridge = MULTIPLAYER_MAPS.find(m => m.id === "rock-arch")!;
  const gaps = bridge.solidColumns!.map(runs => 225 - runs[0]![1]);
  expect(Math.max(...gaps)).toBeGreaterThan(50);
  for (let x = 1; x < gaps.length; x++) {
    expect(Math.abs(gaps[x]! - gaps[x - 1]!)).toBeLessThanOrEqual(8);
  }
});

it("preserves the floating islands' pronounced height differences and varied sizes", () => {
  const map = MULTIPLAYER_MAPS.find(m => m.id === "sky-islands")!;
  const { spawns } = buildMapSpec(map, 8);
  expect(Math.max(...spawns.map(p => p.y)) - Math.min(...spawns.map(p => p.y))).toBeGreaterThanOrEqual(100);
  const widths: number[] = [];
  let width = 0;
  for (const runs of map.solidColumns!) {
    if (runs.length) width++;
    else if (width) { widths.push(width); width = 0; }
  }
  if (width) widths.push(width);
  expect(widths).toHaveLength(6);
  expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(3);
});
