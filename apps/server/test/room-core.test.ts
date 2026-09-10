import { expect, it } from "vitest";
import { createRoomState, reduceRoom, disconnectRoom, tickRoom } from "../src/rooms/core";
const profile = { nickname: "Kero", loadout: ["cannon", "digger"] };
let serial = 0;
const identity = () => { const n = ++serial; return { playerId: `p${n}`, token: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, matchId: `m${n}`, seed: n }; };
const create = () => reduceRoom(createRoomState("ABCDEF"), "socket-a", { type: "room.create", profile }, 1000, identity()).state;
it("increments session generation after disconnect and rejects the old connection", () => {
  const state = create(), token = state.sessions[0]!.token;
  const disconnected = disconnectRoom(state, "socket-a", 1100);
  const resumed = reduceRoom(disconnected, "socket-b", { type: "room.resume", token }, 1200, identity());
  expect(resumed.reason).toBe("accepted");
  expect(resumed.state.sessions[0]!.generation).toBe(2);
  expect(disconnectRoom(resumed.state, "socket-a", 1300)).toBe(resumed.state);
  expect(reduceRoom(resumed.state, "socket-a", { type: "room.leave" }, 1300, identity()).reason).toBe("join-required");
});
it("expires a disconnected seat without deleting a connected member", () => {
  const state = reduceRoom(create(), "socket-b", { type: "room.join", roomId: "ABCDEF", profile }, 1100, identity()).state;
  const disconnected = disconnectRoom(state, "socket-a", 1200);
  expect(tickRoom(disconnected, 61199)).toBe(disconnected);
  const expired = tickRoom(disconnected, 61200);
  expect(expired.sessions).toHaveLength(1);
  expect(expired.lobby!.members).toHaveLength(1);
  expect(expired.lobby!.ownerId).toBe(expired.sessions[0]!.playerId);
});
it("keeps room identities isolated and denies active-token reuse", () => {
  const state = create();
  expect(reduceRoom(state, "socket-b", { type: "room.join", roomId: "FEDCBA", profile }, 1200, identity()).reason).toBe("wrong-room");
  expect(reduceRoom(state, "socket-b", { type: "room.resume", token: state.sessions[0]!.token }, 1200, identity()).reason).toBe("invalid-session");
  expect(state.sessions).toHaveLength(1);
});
