import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { hasClearance, isRingOut, spawnPos, stepOutcome } from "@game/sim";
import { buildMapSpec } from "../src/spec";
import { REED_HILLS_SPEC } from "../src/reedHillsSpec";
import { REED_HILLS_COLUMNS, REED_HILLS_SOURCE_SHA256 } from "../src/reedHillsData";
it("binds collision to the cleaned generated artwork", () => {
  const source = readFileSync(new URL("../../../assets/workbench/maps/reed-hills-v3/terrain.png", import.meta.url));
  expect(createHash("sha256").update(source).digest("hex")).toBe(REED_HILLS_SOURCE_SHA256);
});
it("supports 2..8 players and movement in either direction", () => {
  for (let count = 2; count <= 8; count++) {
    const { mask, spawns } = buildMapSpec(REED_HILLS_SPEC, count);
    for (const spawn of spawns) {
      expect(stepOutcome(mask, spawn, -1).kind).toBe("moved");
      expect(stepOutcome(mask, spawn, 1).kind).toBe("moved");
    }
  }
});
it("has a usable lower rock floor in the left cave", () => {
  const { mask } = buildMapSpec(REED_HILLS_SPEC, 2);
  const x = REED_HILLS_COLUMNS.findIndex(runs => runs.length >= 2 && runs[1]![0] - runs[0]![1] > 20);
  expect(x).toBeGreaterThan(0);
  const landed = spawnPos(mask, x, REED_HILLS_COLUMNS[x]![0]![1]);
  expect(isRingOut(mask, landed)).toBe(false);
  expect(hasClearance(mask, landed.x, landed.y)).toBe(true);
});
