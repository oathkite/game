import { expect, it } from "vitest";
import { labFrameSchema } from "@game/protocol/v2-lab";
import { presentLabReplay } from "../src/networkLab/labReplay";
import { CARVE_AT_MS, HP_DRAIN_MS, IMPACT_TOTAL_MS, MISS_MS } from "../src/game/hitFeedback";
const player = { playerId: "p1", x: 20, y: 150, hp: 100, teamId: "t0", eliminated: false };
const frame = labFrameSchema.parse({ type: "lab.frame", build: { protocol: 2, sim: "keropod-sim-v2.1", assets: "keropod-world-v1", rules: "keropod-v2.1", map: { id: "test", version: 1 } }, wind: 0, map: { id: "test", version: 1, width: 500, height: 225, surface: Array(500).fill(150) }, serverTime: 1000, eventSeq: 2, matchId: "m", turnId: 1, actorId: "p1", deadlineAt: 20000,
  players: Array.from({ length: 8 }, (_, i) => ({ ...player, playerId: `p${i + 1}`, y: 170, hp: 65 })),
  movement: { version: 2, type: "move.snapshot", matchId: "m", turnId: 1, playerId: "p1", eventSeq: 2, serverTime: 1000, x: 20, y: 150, facing: 1, stepsLeft: 30, ackMoveSeq: 0, stoppedByFall: false, eliminated: false },
  phase: "replaying", result: { type: "ongoing" }, terrainOps: [{ cx: 20, cy: 150, radius: 10 }],
  replay: { startsAt: 1000, endsAt: 3300, terrainOpsBefore: 0, playersBefore: Array.from({ length: 8 }, (_, i) => ({ ...player, playerId: `p${i + 1}` })), ticks: 42, shooter: { playerId: "p1", facing: 1, elevation: 45, weapon: "cannon" }, impacts: [{ tick: 42, damage: [{ playerId: "p1", amount: 35 }] }], paths: [{ launchTick: 0, endTick: 42, points: [{ x: 20, y: 140, tick: 0 }, { x: 80, y: 130, tick: 42 }] }] } });
it("holds committed pre-shot positions and terrain until impact, then settles before the deadline", () => {
  const start = presentLabReplay(frame, 1000);
  expect(start.players[0]).toMatchObject({ x: 20, y: 150, hp: 100 }); expect(start.terrainOps).toEqual([]);
  expect(start.bullets[0]).toMatchObject({ x: 20, y: 140 });
  expect(start.bullets[0]!.angle).toBeCloseTo(Math.atan2(-10, 60));
  const middle = presentLabReplay(frame, 1350); expect(middle.bullets[0]!.x).toBeCloseTo(50);
  const falling = presentLabReplay(frame, 1850); expect(falling.bullets).toEqual([]);
  expect(falling.terrainOps).toHaveLength(1); expect(falling.players[0]!.y).toBeCloseTo(160);
  const end = presentLabReplay(frame, 2000); expect(end.players).toEqual(frame.players);
  expect(frame.replay!.playersBefore[0]!.y).toBe(150);
});
it("late join uses the same server timeline and finished frame cannot restart a projectile", () => {
  expect(presentLabReplay(frame, 3000).bullets).toEqual([]);
  expect(presentLabReplay({ ...frame, phase: "finished" }, 1000).players).toEqual(frame.players);
});

it("staggered launches and impacts follow authoritative ticks, preserving earlier damage", () => {
  const staggered = { ...frame, terrainOps: [{ cx: 20, cy: 150, radius: 4 }, { cx: 40, cy: 150, radius: 4 }], replay: { ...frame.replay!, ticks: 40,
    impacts: [{ tick: 10, damage: [{ playerId: "p1", amount: 10 }] }, { tick: 40, damage: [{ playerId: "p1", amount: 25 }] }],
    paths: [
      { launchTick: 0, endTick: 10, points: [{ x: 20, y: 140, tick: 0 }, { x: 30, y: 140, tick: 10 }] },
      { launchTick: 20, endTick: 40, points: [{ x: 20, y: 140, tick: 20 }, { x: 40, y: 140, tick: 40 }] },
    ] } };
  const beforeSecond = presentLabReplay(staggered, 1262.5); // tick 15
  expect(beforeSecond.bullets).toEqual([]);
  expect(beforeSecond.terrainOps).toHaveLength(1);
  expect(beforeSecond.players[0]).toMatchObject({ hp: 90, y: 150 });
  const second = presentLabReplay(staggered, 1525); // tick 30
  expect(second.bullets).toEqual([{ x: 30, y: 140, angle: 0 }]);
  expect(second.players[0]!.hp).toBe(90);
  const settled = presentLabReplay(staggered, 1850);
  expect(settled.players[0]).toMatchObject({ hp: 65, y: 160 });
  expect(settled.terrainOps).toHaveLength(2);
});

it("plays the practice impact timeline from the authoritative impact time", () => {
  expect(presentLabReplay(frame, 1699).effects).toEqual([]);
  expect(presentLabReplay(frame, 1700).effects[0]).toMatchObject({ cx: 20, cy: 150, radius: 10, clock: 0, damage: 35, damages: [{ playerId: "p1", amount: 35 }] });
  expect(presentLabReplay(frame, 2289).effects[0]!.clock).toBe(589);
  expect(presentLabReplay(frame, 1700 + IMPACT_TOTAL_MS).effects).toEqual([]);
});
it("compresses the impact timeline into the 300ms left on a turn without damage", () => {
  const miss = { ...frame, replay: { ...frame.replay!, impacts: [{ tick: 42, damage: [] }] } };
  expect(presentLabReplay(miss, 3000).effects[0]).toMatchObject({ clock: 0, damage: 0, damages: [] });
  expect(presentLabReplay(miss, 3150).effects[0]!.clock).toBeCloseTo(IMPACT_TOTAL_MS / 2);
  expect(presentLabReplay(miss, 3299).effects).toHaveLength(1);
  expect(presentLabReplay(miss, 3300).effects).toEqual([]);
});
it("drains the hit tank's HP bar from the value before the hit", () => {
  expect(presentLabReplay(frame, 1699).hpBars).toEqual({});
  expect(presentLabReplay(frame, 1700).hpBars.p1).toMatchObject({ hp: 100, hpGhost: 100 });
  expect(presentLabReplay(frame, 1700 + CARVE_AT_MS + HP_DRAIN_MS).hpBars.p1!.hp).toBe(65);
  expect(presentLabReplay(frame, 1700).hpBars.p2).toBeUndefined();
});
it("draws a trail behind a flying projectile and clears it at impact", () => {
  const long = { ...frame, replay: { ...frame.replay!, paths: [{ launchTick: 0, endTick: 42, points: Array.from({ length: 11 }, (_, i) => ({ x: 20 + i * 6, y: 140, tick: i * 4 })) }] } };
  const early = presentLabReplay(long, 1100).trails[0]!, later = presentLabReplay(long, 1600).trails[0]!;
  expect(later.length).toBeGreaterThan(early.length);
  expect(later[0]).toMatchObject({ x: 20, y: 140, recent: false });
  expect(later[later.length - 1]!.recent).toBe(true);
  expect(presentLabReplay(long, 1700).trails).toEqual([]);
});
it("marks a projectile that leaves the map at the edge of the actual map size", () => {
  const out = { ...frame, replay: { ...frame.replay!, impacts: [], paths: [{ launchTick: 0, endTick: 20, points: [{ x: 400, y: 100, tick: 0 }, { x: 560, y: 90, tick: 20 }] }] } };
  const at = 1000 + (20 / 42) * (3000 - 1000);
  expect(presentLabReplay(out, at).misses).toEqual([{ key: "miss/0", x: 498, y: 90, on: true }]);
  expect(presentLabReplay(out, at + MISS_MS).misses).toEqual([]);
  expect(presentLabReplay(frame, 1700).misses).toEqual([]);
});
it("marks only descending tanks during settlement and clears falling at its deadline", () => {
  const mixed = { ...frame, players: frame.players.map((p, i) => ({ ...p, y: i === 0 ? 170 : 150 })) };
  expect(presentLabReplay(mixed, 1699).fallingIds).toEqual([]);
  expect(presentLabReplay(mixed, 1700).fallingIds).toEqual(["p1"]);
  expect(presentLabReplay(mixed, 1999).fallingIds).toEqual(["p1"]);
  expect(presentLabReplay(mixed, 2000).fallingIds).toEqual([]);
  expect(presentLabReplay({ ...mixed, phase: "acting" }, 1750).fallingIds).toEqual([]);
});
it("derives recoil from the shared replay clock including a later launch", () => {
  const repeated = { ...frame, replay: { ...frame.replay!, paths: [frame.replay!.paths[0]!, { ...frame.replay!.paths[0]!, launchTick: 12 }] } };
  expect(presentLabReplay(repeated, 1000).recoil).toBe(0);
  expect(presentLabReplay(repeated, 1090).recoil).toBe(3);
  expect(presentLabReplay(repeated, 1180).recoil).toBe(0);
  expect(presentLabReplay(repeated, 1290).recoil).toBe(3);
  expect(presentLabReplay(repeated, 1380).recoil).toBe(0);
  expect(presentLabReplay(repeated, 2000).recoil).toBe(0);
});

it("keeps damage reading time after settlement without stretching projectile flight", () => {
  expect(presentLabReplay(frame, 1350).bullets[0]!.x).toBeCloseTo(50);
  expect(presentLabReplay(frame, 2500).players).toEqual(frame.players);
  expect(presentLabReplay(frame, 2500).fallingIds).toEqual([]);
  expect(presentLabReplay(frame, 2500).bullets).toEqual([]);
});
