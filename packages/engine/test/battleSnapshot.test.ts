import { expect, it } from "vitest";
import { TEST_ARENA } from "@game/maps";
import { createBattle } from "../src/multiplayer/create";
import { createBattleSession, fireInSession, moveInSession, tickSession } from "../src/multiplayer/session";
import { serializeBattle, restoreBattle } from "../src/multiplayer/snapshot";
const start = () => createBattleSession(createBattle([
  { playerId: "a", teamId: "t0" }, { playerId: "b", teamId: "t1" },
], 42, TEST_ARENA), "match", 1000, undefined, 42);
it("round trips replay, terrain, wind and fire deduplication through JSON", () => {
  const initial = start(), id = initial.movement.playerId;
  const command = { version: 2, type: "turn.fire", matchId: "match", turnId: 1, commandId: "shot", ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power: 30 };
  const state = fireInSession(initial, id, command, 1100).state;
  const restored = restoreBattle(JSON.parse(JSON.stringify(serializeBattle(state))));
  expect(restored).toEqual(state);
  expect(restored.mask.cells).toBeInstanceOf(Uint8Array);
  expect(fireInSession(restored, id, command, 1200).reason).toBe("duplicate");
  expect(tickSession(restored, state.replay!.endsAt)).toEqual(tickSession(state, state.replay!.endsAt));
});
it("retains movement receipts so a reconnect cannot spend a step twice", () => {
  const initial = start(), id = initial.movement.playerId;
  const command = { version: 2, type: "move.command", matchId: "match", turnId: 1, commandId: "move", moveSeq: 1, direction: 1, steps: 1 };
  const state = moveInSession(initial, id, command, 1100).state;
  const restored = restoreBattle(JSON.parse(JSON.stringify(serializeBattle(state))));
  expect(moveInSession(restored, id, command, 1200).state).toBe(restored);
  expect(restored).toEqual(state);
});
it("refuses incompatible stored versions instead of silently changing the simulation", () => {
  const stored = serializeBattle(start());
  expect(() => restoreBattle(JSON.parse(JSON.stringify({ ...stored, version: 999 })))).toThrow(/version/);
});
