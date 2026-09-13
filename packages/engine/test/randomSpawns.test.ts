import { createBattle } from "../src/multiplayer/create";
import { expect, it } from "vitest";
import { MULTIPLAYER_MAPS, buildMapSpec } from "@game/maps";
import { hasClearance, isRingOut } from "@game/sim";
import { randomSpawns } from "../src/randomSpawns";

it("varies starting positions while retaining safe, separated ground on every map", () => {
  for (const map of MULTIPLAYER_MAPS) for (let count = 2; count <= 8; count++) {
    const { mask, spawns } = buildMapSpec(map, 8);
    const first = randomSpawns(spawns, count, () => 0), last = randomSpawns(spawns, count, () => .999);
    expect(first).not.toEqual(last);
    for (const positions of [first, last]) positions.forEach((p, i) => {
      expect(isRingOut(mask, p)).toBe(false);
      expect(hasClearance(mask, p.x, p.y)).toBe(true);
      expect(positions.slice(i + 1).every(other => Math.abs(other.x - p.x) >= 12)).toBe(true);
    });
  }
});

it("reproduces a seeded battle and changes positions for another match", () => {
  const members = [{ playerId: "a", teamId: "a" }, { playerId: "b", teamId: "b" }];
  for (const map of MULTIPLAYER_MAPS) {
    const first = createBattle(members, 1, map);
    expect(createBattle(members, 1, map).players).toEqual(first.players);
    expect(createBattle(members, 2, map).players.map(p => p.x).sort()).not.toEqual(first.players.map(p => p.x).sort());
  }
});

it("randomizes practice positions and sends those exact coordinates in setup", async () => {
  const { createEngine, DEFAULT_ENGINE_TIMING, setupMessage } = await import("../src/index");
  const player = { nickname: "P", colors: { primary: "green", secondary: "green" }, loadout: ["cannon", "digger"] } as const;
  for (const mapName of ["ridgeline", "stone-bridge", "terraces", "sky-islands"] as const) {
    const create = (value: number) => createEngine({ ...DEFAULT_ENGINE_TIMING, rng: () => value }, { roomCode: "ABCDEF", mapName, players: [player, player] });
    const first = create(.1), second = create(.9);
    expect(first.match.players.map(p => p.x).sort()).not.toEqual(second.match.players.map(p => p.x).sort());
    expect(setupMessage(first).players.map(p => ({ x: p.x, y: p.y }))).toEqual(first.match.players.map(p => ({ x: p.x, y: p.y })));
  }
});

it("practice can use interior footholds far from both former starting positions", async () => {
  const { getMap } = await import("@game/maps");
  const { spawnPos } = await import("@game/sim");
  for (const name of ["ridgeline", "stone-bridge", "terraces", "sky-islands"] as const) {
    const map = getMap(name), mask = map.build();
    const pool = map.spawnCandidates!.map(x => spawnPos(mask, x));
    expect(pool).toHaveLength(8);
    const selected = randomSpawns(pool, 2, () => 0);
    expect(selected.some(p => map.spawns.every(x => Math.abs(x - p.x) > 20))).toBe(true);
  }
});
