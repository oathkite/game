import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { carve, hasClearance, isRingOut, spawnPos } from "@game/sim";
import { getMap } from "../src/index";
import { ROCK_ARCH_COLUMNS, ROCK_ARCH_SOURCE_SHA256 } from "../src/rockArchData";
it("ties the frozen collision data to the reviewed image", () => {
  const source = readFileSync(new URL("../../../assets/workbench/maps/rock-arch-v1/terrain.png", import.meta.url));
  expect(createHash("sha256").update(source).digest("hex")).toBe(ROCK_ARCH_SOURCE_SHA256);
  expect(ROCK_ARCH_COLUMNS).toHaveLength(400);
});
it("has open air beneath the bridge and a separate landable lower rock", () => {
  const mask = getMap("rock-arch").build();
  const runs = ROCK_ARCH_COLUMNS[200]!;
  expect(runs.length).toBe(2);
  expect(runs[1]![0] - runs[0]![1]).toBeGreaterThan(30);
  const below = spawnPos(mask, 200, runs[0]![1]);
  expect(below.y).toBeGreaterThan(120);
  expect(isRingOut(mask, below)).toBe(false);
  expect(hasClearance(mask, below.x, below.y)).toBe(true);
});
it("breaking the bridge drops a tank onto the lower rock without altering unrelated terrain", () => {
  const mask = getMap("rock-arch").build(), top = spawnPos(mask, 200);
  const bridge = ROCK_ARCH_COLUMNS[200]![0]!;
  const cut = carve(mask, { cx: 200, cy: Math.round((bridge[0] + bridge[1]) / 2), radius: 20 });
  const landed = spawnPos(cut, 200, top.y);
  expect(landed.y).toBeGreaterThan(top.y + 40);
  expect(isRingOut(cut, landed)).toBe(false);
  expect(spawnPos(cut, 85)).toEqual(spawnPos(mask, 85));
  expect(spawnPos(mask, 200)).toEqual(top);
});
