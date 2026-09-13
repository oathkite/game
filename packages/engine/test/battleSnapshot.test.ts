import { LEGACY_CLIENT_BUILD } from "@game/protocol/build";
import { expect, it } from "vitest";
import { MULTIPLAYER_MAPS, TEST_ARENA } from "@game/maps";
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
  expect(restored.stats?.[id]?.shots).toBe(1);
  expect(restored.mask.cells).toBeInstanceOf(Uint8Array);
  expect(fireInSession(restored, id, command, 1200).reason).toBe("duplicate");
  expect(fireInSession(restored, id, command, 1200).state.stats?.[id]?.shots).toBe(1);
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
it("rejects a different simulation or map revision in a saved match", () => {
  const stored = serializeBattle(start());
  expect(() => restoreBattle({ ...stored, state: { ...stored.state, build: { ...stored.state.build, sim: "old" } } })).toThrow(/version/);
  expect(() => restoreBattle({ ...stored, state: { ...stored.state, map: { ...stored.state.map, version: 2 } } })).toThrow(/version/);
});
it("explicitly migrates only the known pre-public v1 snapshot", () => {
  const state = start(), stored = serializeBattle(state), { build: _build, ...legacy } = stored.state;
  expect(restoreBattle({ version: 1, state: legacy })).toEqual(state);
});

it("keeps statistics unavailable for old snapshots instead of fabricating zero damage", () => {
  const stored = serializeBattle(start());
  const { stats: _stats, ...state } = stored.state;
  expect(restoreBattle({ ...stored, state }).stats).toBeUndefined();
});

it("preserves authored bridge air and lower rock through JSON restoration", () => {
  const solidColumns = Array.from({ length: TEST_ARENA.width }, () => [[150, 160], [190, 210]] as const);
  const battle = createBattle([{ playerId: "a", teamId: "t0" }, { playerId: "b", teamId: "t1" }], 42, { ...TEST_ARENA, solidColumns });
  const initial = createBattleSession(battle, "authored", 1000);
  const restored = restoreBattle(JSON.parse(JSON.stringify(serializeBattle(initial))));
  expect(restored.mask.cells).toEqual(initial.mask.cells);
  expect(restored.mask.cells[170 * 500 + 250]).toBe(0);
  expect(restored.mask.cells[195 * 500 + 250]).toBe(1);
  expect(restored.map.solidColumns).toEqual(solidColumns);
});

it("upgrades known height-only stored builds while rejecting authored legacy data", () => {
  const initial = start(), snapshot = serializeBattle(initial);
  const build = { ...LEGACY_CLIENT_BUILD, map: { ...initial.build.map } };
  const stored = { ...snapshot, state: { ...snapshot.state, build } };
  expect(restoreBattle(stored)).toEqual(initial);
  expect(() => restoreBattle({ ...stored, state: { ...stored.state, map: { ...stored.state.map, solidColumns: [] } } })).toThrow();
});

it("restores a frozen reed-hills v2 match without adopting the registered geometry", () => {
  const oldMap = { ...TEST_ARENA, id: "reed-hills", version: 2, width: 400, height: 200,
    surface: Array.from({ length: 400 }, (_, x) => Math.round(124 + 8 * Math.cos(4 * Math.PI * x / 399))),
    spawns: { 2: [90, 310] } };
  const original = createBattleSession(createBattle([{ playerId: "a", teamId: "t0" }, { playerId: "b", teamId: "t1" }], 42, oldMap), "old-reed", 0);
  const restored = restoreBattle(JSON.parse(JSON.stringify(serializeBattle(original))));
  expect(restored.map.version).toBe(2); expect(restored.mask.height).toBe(200);
  expect(restored.map.solidColumns).toBeUndefined();
  expect(restored.mask.cells).toEqual(original.mask.cells);
});

it("keeps v3 reed-hills seats frozen after the pixel terrain refresh", () => {
  const current = MULTIPLAYER_MAPS.find(map => map.id === "reed-hills")!;
  expect(current.version).toBe(5);
  const oldMap = { ...current, version: 3, spawns: { 2: [55, 345] } };
  const members = [{ playerId: "a", teamId: "t0" }, { playerId: "b", teamId: "t1" }];
  const original = createBattleSession(createBattle(members, 42, oldMap), "old-seats", 0);
  const restored = restoreBattle(JSON.parse(JSON.stringify(serializeBattle(original))));
  expect(restored.map.version).toBe(3);
  expect(restored.players.map(player => player.x)).toEqual([55, 345]);
  expect(restored.mask.cells).toEqual(original.mask.cells);
  expect(createBattle(members, 42, current).players.map(player => player.x)).not.toEqual([55, 345]);
});
