import { expect, it } from "vitest";
import { flatMask } from "@game/sim";
import { createRoster } from "../src/multiplayer/rules";
import { resolveBattleShot } from "../src/multiplayer/combat";

it("resolves an eight-player impact by stable IDs before declaring team victory", () => {
  const roster = createRoster(Array.from({ length: 8 }, (_, i) => ({ playerId: `p${i}`, teamId: `t${i}` })), 42);
  const shooter = roster.turnRing[0]!;
  const players = roster.members.map(p => ({ playerId: p.playerId, x: p.playerId === shooter ? 60 : 70, y: 150, hp: p.playerId === shooter ? 1000 : 1 }));
  const input = { playerId: shooter, weapon: "cannon", elevation: 0, facing: 1, power: 20, wind: 0 } as const;
  const result = resolveBattleShot(roster, flatMask(), players, input);
  expect(result.roster.eliminated).toHaveLength(7);
  expect(result.outcome).toEqual({ type: "win", teamId: roster.members.find(p => p.playerId === shooter)!.teamId });
  expect(resolveBattleShot(roster, flatMask(), [...players].reverse(), input)).toEqual(result);
  expect(result.impacts[0]!.damage.map(d => d.playerId)).toEqual(roster.members.map(p => p.playerId));
  expect(() => resolveBattleShot(roster, flatMask(), players, { ...input, playerId: roster.turnRing[1]! })).toThrow();
  const allDead = resolveBattleShot(roster, flatMask(), players.map(p => ({ ...p, hp: 1 })), input);
  expect(allDead.outcome).toEqual({ type: "draw" });
});

it("connects versioned map setup to an eight-player shot", async () => {
  const { TEST_ARENA } = await import("@game/maps");
  const { createBattle } = await import("../src/multiplayer/create");
  const battle = createBattle(Array.from({ length: 8 }, (_, i) => ({ playerId: `p${i}`, teamId: `t${i % 2}` })), 42, TEST_ARENA);
  expect(battle.map).toEqual({ id: TEST_ARENA.id, version: 1, width: 500, height: 225 });
  const result = resolveBattleShot(battle.roster, battle.mask, battle.players,
    { playerId: battle.roster.turnRing[0]!, weapon: "cannon", elevation: 45, facing: 1, power: 60, wind: 0 });
  expect(result.players).toHaveLength(8); expect(result.mask.width).toBe(500);
});
