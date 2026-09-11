import { expect, it } from "vitest";
import { TEST_ARENA } from "@game/maps";
import { createBattle } from "../src/multiplayer/create";
import { createBattleSession, fireInSession, tickSession } from "../src/multiplayer/session";
import { resolveBattleShot } from "../src/multiplayer/combat";
const start = (seed: number) => createBattleSession(createBattle([
  { playerId: "a", teamId: "t0" }, { playerId: "b", teamId: "t1" },
], 42, TEST_ARENA), "match", 1000, undefined, seed);
it("keeps wind stable within a turn and restores its deterministic sequence", () => {
  const initial = start(123);
  expect(tickSession(initial, 1500)).toBe(initial);
  const next = tickSession(initial, initial.movement.deadlineAt);
  expect(next.windState).not.toEqual(initial.windState);
  expect(tickSession(initial, initial.movement.deadlineAt).windState).toEqual(next.windState);
  expect(tickSession(next, next.movement.startsAt)).toBe(next);
});
it("keeps every wind within the simulation range", () => {
  for (const seed of [0, 1, 123, 0xffffffff]) {
    let state = start(seed);
    while (state.phase !== "finished") {
      expect(state.windState.value).toBeGreaterThanOrEqual(-10);
      expect(state.windState.value).toBeLessThanOrEqual(10);
      state = tickSession(state, state.movement.deadlineAt);
    }
  }
});

it("resolves the shot with authoritative wind and does not draw again on retry", () => {
  const state = start(123), playerId = state.movement.playerId;
  const command = { version: 2, type: "turn.fire", matchId: "match", turnId: 1,
    commandId: "shot", ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power: 60 };
  const expected = resolveBattleShot(state.roster, state.mask, state.players, {
    playerId, weapon: state.loadouts[playerId]![0], wind: state.windState.value,
    facing: 1, elevation: 45, power: 60,
  });
  const fired = fireInSession(state, playerId, command, 1100).state;
  expect(fired.replay!.shot.paths).toEqual(expected.paths);
  expect(fired.windState).toEqual(state.windState);
  expect(fireInSession(fired, playerId, command, 1200).state).toBe(fired);
});
