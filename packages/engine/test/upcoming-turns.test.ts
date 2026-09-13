import { expect, it } from "vitest";
import { createRoster, eliminatePlayers, nextTurn, upcomingPlayers } from "../src/multiplayer/rules";
it("previews the next three distinct survivors in actual turn order across the ring boundary", () => {
  const initial = createRoster(Array.from({ length: 8 }, (_, i) => ({ playerId: `p${i}`, teamId: `t${i % 2}` })), 42);
  const roster = { ...initial, cursor: 7 };
  const state = eliminatePlayers(roster, [roster.turnRing[1]!]);
  let turn = state;
  const expected = Array.from({ length: 3 }, () => { turn = nextTurn(turn); return turn.turnRing[turn.cursor]!; });
  expect(upcomingPlayers(state)).toEqual(expected);
  expect(state.cursor).toBe(7);
});
it("does not duplicate seats in a duel and hides the queue after a result", () => {
  const state = createRoster([{ playerId: "a", teamId: "a" }, { playerId: "b", teamId: "b" }], 42);
  expect(upcomingPlayers(state)).toEqual([state.turnRing[1]]);
  expect(upcomingPlayers(eliminatePlayers(state, [state.turnRing[1]!]))).toEqual([]);
});
