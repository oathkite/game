import { expect, it } from "vitest";
import { flatMask, wallMask } from "@game/sim";
import { createMovement, handleMove, movementSnapshot } from "../src/multiplayer/movement";
const command = (moveSeq = 1, steps = 2) => ({ version: 2, type: "move.command", matchId: "m", turnId: 1, commandId: `c${moveSeq}`, moveSeq, direction: 1, steps });
const start = () => createMovement({ matchId: "m", turnId: 1, playerId: "p", x: 60, y: 150, facing: 1, startsAt: 1000, deadlineAt: 21000 });
it("accepts only bounded steps at server-controlled speed and budget", () => {
  let state = start();
  state = handleMove(state, flatMask(), "p", command(), 1000).state;
  expect(state.x).toBe(62); expect(state.stepsLeft).toBe(28);
  const throttled = handleMove(state, flatMask(), "p", command(2), 1000);
  expect(throttled.reason).toBe("rate-limited"); expect(throttled.state.ackMoveSeq).toBe(2);
  state = throttled.state;
  for (let seq = 3; seq <= 16; seq++) state = handleMove(state, flatMask(), "p", command(seq), 1000 + (seq - 2) * 200).state;
  expect(state.x).toBe(90); expect(state.stepsLeft).toBe(0);
  expect(handleMove(state, flatMask(), "p", command(17), 5000).state.x).toBe(90);
});
it("deduplicates after serialization and rejects gaps, old turns and impersonation", () => {
  const first = handleMove(start(), flatMask(), "p", command(), 1000);
  const restored = JSON.parse(JSON.stringify(first.state));
  const duplicate = handleMove(restored, flatMask(), "p", command(), 1500);
  expect(duplicate.state).toEqual(restored); expect(duplicate.snapshot).toEqual(first.snapshot);
  expect(handleMove(restored, flatMask(), "p", command(3), 1500).reason).toBe("sync-required");
  expect(handleMove(restored, flatMask(), "other", command(2), 1500).reason).toBe("not-actor");
  expect(handleMove(restored, flatMask(), "p", { ...command(2), turnId: 2 }, 1500).reason).toBe("wrong-turn");
  expect(movementSnapshot(restored, 1600).ackMoveSeq).toBe(1);
});
it("walls do not consume movement and invalid input cannot mutate state", () => {
  const state = start();
  const blocked = handleMove(state, wallMask(61, 100), "p", command(), 1000);
  expect(blocked.state.stepsLeft).toBe(30); expect(blocked.state.x).toBe(60);
  for (const bad of [command(1, 3), { ...command(), x: 300 }, { ...command(), direction: 0 }]) {
    expect(handleMove(state, flatMask(), "p", bad, 1000).state).toBe(state);
  }
  expect(handleMove(state, flatMask(), "p", command(), 999).reason).toBe("outside-turn");
  expect(handleMove(state, flatMask(), "p", command(), 21000).reason).toBe("outside-turn");
});

it("partially accepts remaining credit, remembers rejection, and cannot bank a burst", () => {
  const first = handleMove(start(), flatMask(), "p", command(), 1000).state;
  const partial = handleMove(first, flatMask(), "p", command(2), 1100);
  expect(partial.reason).toBe("partial"); expect(partial.state.x).toBe(63);
  const denied = handleMove(partial.state, flatMask(), "p", command(3), 1100);
  expect(handleMove(denied.state, flatMask(), "p", command(3), 12000).state.x).toBe(63);
  expect(handleMove(denied.state, flatMask(), "p", command(4), 12000).state.x).toBe(65);
});
it("stops after falling, marks ring out, and stops movement when locked", async () => {
  const { slabMask } = await import("@game/sim");
  const fall = handleMove(start(), slabMask([[0, 60]], 150, 3), "p", command(), 1000);
  expect(fall.state.x).toBe(61); expect(fall.state.eliminated).toBe(true);
  expect(fall.state.stepsLeft).toBe(29);
  expect(handleMove(fall.state, flatMask(), "p", command(2), 2000).reason).toBe("stopped");
  expect(handleMove({ ...start(), locked: true }, flatMask(), "p", command(), 1000).reason).toBe("stopped");
});
it("requires exact command identity and bounds receipt memory", () => {
  const first = handleMove(start(), flatMask(), "p", command(), 1000).state;
  expect(handleMove(first, flatMask(), "p", { ...command(), direction: -1 }, 1200).reason).toBe("command-conflict");
  expect(handleMove(first, flatMask(), "p", { ...command(2), commandId: "c1" }, 1200).reason).toBe("command-conflict");
  let state = start();
  for (let i = 1; i <= 256; i++) state = handleMove(state, flatMask(), "p", command(i), 1000).state;
  expect(handleMove(state, flatMask(), "p", command(257), 1000).reason).toBe("command-limit");
  expect(state.receipts).toHaveLength(256);
});

it("commits lethal movement to battle state and permits its duplicate acknowledgement", async () => {
  const { slabMask } = await import("@game/sim");
  const { createRoster } = await import("../src/multiplayer/rules");
  const { moveBattle } = await import("../src/multiplayer/moveBattle");
  const roster = createRoster([{ playerId: "p", teamId: "a" }, { playerId: "q", teamId: "b" }], 42);
  const actor = roster.turnRing[0]!;
  const movement = createMovement({ ...start(), playerId: actor });
  const players = roster.members.map(p => ({ playerId: p.playerId, x: p.playerId === actor ? 60 : 30, y: 150, hp: 100 }));
  const mask = slabMask([[0, 60]], 150, 3);
  const result = moveBattle(roster, players, mask, movement, actor, command(), 1000);
  expect(result.outcome.type).toBe("win"); expect(result.roster.eliminated).toEqual([actor]);
  const retry = moveBattle(result.roster, result.players, mask, result.state, actor, command(), 1100);
  expect(retry.snapshot).toEqual(result.snapshot);
});
