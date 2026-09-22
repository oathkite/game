import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { hasClearance, isRingOut, spawnPos, stepOutcome } from "@game/sim";
import { buildMapSpec } from "../src/spec";
import { MOSS_VALLEY_SPEC } from "../src/mossValleySpec";
import { MOSS_VALLEY_COLUMNS, MOSS_VALLEY_SOURCE_SHA256 } from "../src/mossValleyData";
it("binds collision to the cleaned generated artwork", () => {
  const source = readFileSync(new URL("../../../assets/workbench/maps/moss-valley-v3/terrain.png", import.meta.url));
  expect(createHash("sha256").update(source).digest("hex")).toBe(MOSS_VALLEY_SOURCE_SHA256);
});
it("supports 2..8 players and movement in either direction", () => {
  for (let count = 2; count <= 8; count++) {
    const { mask, spawns } = buildMapSpec(MOSS_VALLEY_SPEC, count);
    // 急な坂（SLOPE_RISE_MAX）の麓のスポーンは上りへ進めないが、どのスポーンも少なくとも一方へは動ける
    for (const spawn of spawns) {
      expect([stepOutcome(mask, spawn, -1).kind, stepOutcome(mask, spawn, 1).kind]).toContain("moved");
    }
  }
});
it("has a usable lower rock floor in the right cave", () => {
  const { mask } = buildMapSpec(MOSS_VALLEY_SPEC, 2);
  const x = MOSS_VALLEY_COLUMNS.findIndex(runs => runs.length >= 2 && runs[1]![0] - runs[0]![1] > 20);
  expect(x).toBeGreaterThan(0);
  const landed = spawnPos(mask, x, MOSS_VALLEY_COLUMNS[x]![0]![1]);
  expect(isRingOut(mask, landed)).toBe(false);
  expect(hasClearance(mask, landed.x, landed.y)).toBe(true);
});
