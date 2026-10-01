import { expect, it } from "vitest";
import { labFrameSchema, type LabFrame } from "@game/protocol/v2-lab";
import { canPrepare } from "../src/networkLab/onlinePreparation";

const player = { playerId: "p1", x: 20, y: 150, hp: 100, teamId: "t0", eliminated: false };
const acting = labFrameSchema.parse({ type: "lab.frame", build: { protocol: 2, sim: "keropod-sim-v2.1", assets: "keropod-world-v1", rules: "keropod-v2.1", map: { id: "test", version: 1 } }, wind: 0, map: { id: "test", version: 1, width: 500, height: 225, surface: Array(500).fill(150) }, serverTime: 1000, eventSeq: 2, matchId: "m", turnId: 1, actorId: "p2", deadlineAt: 21000,
  players: [player, { ...player, playerId: "p2", x: 300, teamId: "t1" }],
  movement: { version: 2, type: "move.snapshot", matchId: "m", turnId: 1, playerId: "p2", eventSeq: 2, serverTime: 1000, x: 300, y: 150, facing: -1, stepsLeft: 30, ackMoveSeq: 0, stoppedByFall: false, eliminated: false },
  phase: "acting", result: { type: "ongoing" }, terrainOps: [], replay: null });
const replaying = (shooter: string): LabFrame => ({ ...acting, phase: "replaying", replay: { startsAt: 1000, endsAt: 3000, terrainOpsBefore: 0, playersBefore: acting.players, ticks: 10,
  shooter: { playerId: shooter, facing: 1, elevation: 45, weapon: "cannon" }, impacts: [], paths: [] } });
const shown = { opening: false, revealed: true };

it("lets the player prepare the angle and weapon while another player acts or their shot plays", () => {
  expect(canPrepare(acting, "p1", shown, false)).toBe(true);
  expect(canPrepare(replaying("p2"), "p1", shown, false)).toBe(true);
});

it("keeps the player's own turn and own shot to the normal controls", () => {
  expect(canPrepare({ ...acting, actorId: "p1" }, "p1", shown, false)).toBe(false);
  expect(canPrepare(replaying("p1"), "p1", shown, false)).toBe(false);
});

it("does not prepare during the opening, the turn-order reveal, after the match, or while watching", () => {
  expect(canPrepare(acting, "p1", { opening: true, revealed: true }, false)).toBe(false);
  expect(canPrepare(acting, "p1", { opening: false, revealed: false }, false)).toBe(false);
  expect(canPrepare({ ...acting, phase: "finished" }, "p1", shown, false)).toBe(false);
  expect(canPrepare(acting, "p1", shown, true)).toBe(false);
});
