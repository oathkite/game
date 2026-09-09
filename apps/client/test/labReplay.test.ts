import { expect, it } from "vitest";
import { labFrameSchema } from "@game/protocol/v2-lab";
import { presentLabReplay } from "../src/networkLab/labReplay";
const player = { playerId: "p1", x: 20, y: 150, hp: 100, teamId: "t0", eliminated: false };
const frame = labFrameSchema.parse({ type: "lab.frame", serverTime: 1000, eventSeq: 2, matchId: "m", turnId: 1, actorId: "p1", deadlineAt: 20000,
  players: Array.from({ length: 8 }, (_, i) => ({ ...player, playerId: `p${i + 1}`, y: 170, hp: 65 })),
  movement: { version: 2, type: "move.snapshot", matchId: "m", turnId: 1, playerId: "p1", eventSeq: 2, serverTime: 1000, x: 20, y: 150, facing: 1, stepsLeft: 30, ackMoveSeq: 0, stoppedByFall: false, eliminated: false },
  phase: "replaying", result: { type: "ongoing" }, terrainOps: [{ cx: 20, cy: 150, radius: 10 }],
  replay: { startsAt: 1000, endsAt: 2000, terrainOpsBefore: 0, playersBefore: Array.from({ length: 8 }, (_, i) => ({ ...player, playerId: `p${i + 1}` })), paths: [[{ x: 20, y: 140 }, { x: 80, y: 130 }]] } });
it("holds committed pre-shot positions and terrain until impact, then settles before the deadline", () => {
  const start = presentLabReplay(frame, 1000);
  expect(start.players[0]).toMatchObject({ x: 20, y: 150, hp: 100 }); expect(start.terrainOps).toEqual([]);
  expect(start.bullets[0]).toEqual({ x: 20, y: 140 });
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
