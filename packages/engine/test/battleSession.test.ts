import { expect, it } from "vitest";
import { TEST_ARENA } from "@game/maps";
import { createBattle } from "../src/multiplayer/create";
import { createBattleSession, fireInSession, moveInSession, forfeitInSession, surrenderInSession, tickSession } from "../src/multiplayer/session";
const start = () => createBattleSession(createBattle(Array.from({ length: 8 }, (_, i) => ({ playerId: `p${i}`, teamId: `t${i % 2}` })), 42, TEST_ARENA), "match", 1000);
const fire = (state: ReturnType<typeof start>) => ({ version: 2, type: "turn.fire", matchId: "match", turnId: state.roster.turnId, commandId: "fire1", ackMoveSeq: state.movement.ackMoveSeq, slot: 0, facing: 1, elevation: 45, power: 30 });
it("fires once from the committed location, blocks moves during replay and advances without ACK", () => {
  const initial = start(), actor = initial.movement.playerId;
  const moved = moveInSession(initial, actor, { version: 2, type: "move.command", matchId: "match", turnId: 1, commandId: "m1", moveSeq: 1, direction: 1, steps: 1 }, 1000).state;
  expect(fireInSession(moved, actor, { ...fire(moved), ackMoveSeq: 0 }, 1100).reason).toBe("move-sync-required");
  const accepted = fireInSession(moved, actor, fire(moved), 1100);
  expect(accepted.state.phase).toBe("replaying");
  expect(accepted.state.replay!.origin.x).toBe(moved.movement.x);
  const retry = fireInSession(accepted.state, actor, fire(moved), 1200);
  expect(retry.state).toBe(accepted.state); expect(retry.reason).toBe("duplicate");
  expect(moveInSession(accepted.state, actor, {}, 1200).reason).toBe("not-acting");
  expect(tickSession(accepted.state, accepted.state.replay!.endsAt).roster.turnId).toBe(2);
});
it("passes on deadline and draws at the time limit without waiting for disconnected clients", () => {
  let state = start();
  for (let i = 0; i < 96; i++) state = tickSession(state, state.movement.deadlineAt);
  expect(state.phase).toBe("finished"); expect(state.result).toEqual({ type: "draw" });
});
it("rejects forged actor, old match, changed duplicate and fire positions", () => {
  const state = start(), actor = state.movement.playerId;
  expect(fireInSession(state, "other", fire(state), 1100).reason).toBe("not-actor");
  expect(fireInSession(state, actor, { ...fire(state), matchId: "old" }, 1100).reason).toBe("wrong-turn");
  expect(fireInSession(state, actor, { ...fire(state), x: 200 }, 1100).reason).toBe("invalid");
  const shot = fireInSession(state, actor, fire(state), 1100).state;
  expect(fireInSession(shot, actor, { ...fire(state), power: 40 }, 1200).reason).toBe("command-conflict");
});

it("finishes when a whole team surrenders and ignores repeated surrender", () => {
  let state = start();
  for (const member of state.roster.members.filter(p => p.teamId === "t0")) state = surrenderInSession(state, member.playerId, 1100);
  expect(state.phase).toBe("finished");
  expect(state.result).toEqual({ type: "win", teamId: "t1" });
  expect(surrenderInSession(state, "p0", 1200)).toBe(state);
});

it("simultaneous disconnect expiries produce a draw, not the first team's victory", () => {
  const state = start();
  const ended = forfeitInSession(state, state.roster.members.map(p => p.playerId), 62000);
  expect(ended.phase).toBe("finished"); expect(ended.result).toEqual({ type: "draw" });
});
