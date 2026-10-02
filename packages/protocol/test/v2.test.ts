import { expect, it } from "vitest";
import { fireCommandSchema, moveCommandSchema, moveSnapshotSchema } from "../src/v2";
const command = { version: 2, type: "move.command", matchId: "m", turnId: 1, commandId: "c", moveSeq: 1, direction: -1, steps: 2 };
it("validates v2 move boundaries without accepting position or client timestamps", () => {
  expect(moveCommandSchema.safeParse(command).success).toBe(true);
  for (const patch of [{ version: 1 }, { matchId: "" }, { turnId: 0 }, { moveSeq: .5 }, { steps: 0 }, { steps: 3 }, { direction: 0 }, { x: 20 }, { now: 1000 }]) {
    expect(moveCommandSchema.safeParse({ ...command, ...patch }).success).toBe(false);
  }
});
it("validates public movement snapshots and excludes internal receipt data", () => {
  const snapshot = { version: 2, type: "move.snapshot", matchId: "m", turnId: 1, playerId: "p", x: 60, y: 150, facing: 1,
    stepsLeft: 30, ackMoveSeq: 0, eventSeq: 1, serverTime: 1000, stoppedByFall: false, eliminated: false };
  expect(moveSnapshotSchema.safeParse(snapshot).success).toBe(true);
  expect(moveSnapshotSchema.safeParse({ ...snapshot, receipts: [] }).success).toBe(false);
});
it("accepts an item with a v2 fire command and rejects unknown items", () => {
  const fire = { version: 2, type: "turn.fire", matchId: "m", turnId: 1, commandId: "c", ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power: 60 };
  expect(fireCommandSchema.safeParse(fire).success).toBe(true);
  for (const item of ["double", "teleport"]) expect(fireCommandSchema.safeParse({ ...fire, item }).success).toBe(true);
  for (const item of ["", "Double", "heal", null, 1]) expect(fireCommandSchema.safeParse({ ...fire, item }).success).toBe(false);
});
