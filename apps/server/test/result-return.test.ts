import { expect, it } from "vitest";
import { CLIENT_BUILD } from "@game/protocol/build";
import { createBattle, createBattleSession } from "@game/engine/multiplayer";
import { TEST_ARENA } from "@game/maps";
import { createRoomState, reduceRoom, tickRoom, nextRoomDeadline, disconnectRoom } from "../src/rooms/core";
import { serializeRoom, restoreRoom } from "../src/rooms/runtime";
const id = (playerId: string) => ({ playerId, token: `00000000-0000-4000-8000-${playerId === "a" ? "000000000001" : "000000000002"}`, matchId: "match", seed: 42 });
const finished = () => {
  const profile = { nickname: "Kero", loadout: ["cannon", "digger"] };
  let room = reduceRoom(createRoomState("ABCDEF"), "a", { type: "room.create", build: CLIENT_BUILD, profile }, 1000, id("a")).state;
  room = reduceRoom(room, "b", { type: "room.join", roomId: "ABCDEF", build: CLIENT_BUILD, profile }, 1000, id("b")).state;
  const battle = createBattleSession(createBattle([{ playerId: "a", teamId: "t0" }, { playerId: "b", teamId: "t1" }], 42, TEST_ARENA), "match", 1000);
  return { ...room, battle: { ...battle, phase: "finished" as const, finishedAt: 2000, result: { type: "win" as const, teamId: "t0" } } };
};
const vote = (room: ReturnType<typeof finished> | ReturnType<typeof createRoomState>, player: string) => reduceRoom(room, player, { type: "lab.rematch", matchId: "match" }, 3000, id(player));
it("waits for every participant including the non-owner and ignores duplicate votes", () => {
  const room = finished(), first = vote(room, "a");
  expect(first.state.battle).not.toBeNull();
  expect(vote(first.state, "a").state).toBe(first.state);
  expect(vote(first.state, "b").state.battle).toBeNull();
});
it("persists votes and returns at 60 seconds even with a disconnected participant", () => {
  const room = restoreRoom(JSON.parse(JSON.stringify(serializeRoom(disconnectRoom(vote(finished(), "a").state, "b", 3000)))));
  expect(nextRoomDeadline(room)).toBe(62000);
  expect(tickRoom(room, 61999).battle).not.toBeNull();
  expect(tickRoom(room, 62000).battle).toBeNull();
});
it("rejects early and stale return requests", () => {
  const room = finished();
  expect(vote({ ...room, battle: { ...room.battle, phase: "acting" } }, "a").state.battle?.phase).toBe("acting");
  expect(reduceRoom(room, "a", { type: "lab.rematch", matchId: "old" }, 3000, id("a")).state).toBe(room);
});
