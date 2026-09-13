import { CLIENT_BUILD } from "@game/protocol/build";
import { expect, it } from "vitest";
import { createRoomState, reduceRoom, disconnectRoom, tickRoom } from "../src/rooms/core";
const profile = { nickname: "Kero", loadout: ["cannon", "digger"] };
let serial = 0;
const identity = () => { const n = ++serial; return { playerId: `p${n}`, token: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, matchId: `m${n}`, seed: n }; };
const create = () => reduceRoom(createRoomState("ABCDEF"), "socket-a", { type: "room.create", build: CLIENT_BUILD, profile }, 1000, identity()).state;
it("increments session generation after disconnect and rejects the old connection", () => {
  const state = create(), token = state.sessions[0]!.token;
  const disconnected = disconnectRoom(state, "socket-a", 1100);
  const resumed = reduceRoom(disconnected, "socket-b", { type: "room.resume", build: CLIENT_BUILD, token }, 1200, identity());
  expect(resumed.reason).toBe("accepted");
  expect(resumed.state.sessions[0]!.generation).toBe(2);
  expect(disconnectRoom(resumed.state, "socket-a", 1300)).toBe(resumed.state);
  expect(reduceRoom(resumed.state, "socket-a", { type: "room.leave" }, 1300, identity()).reason).toBe("join-required");
});
it("expires a disconnected seat without deleting a connected member", () => {
  const state = reduceRoom(create(), "socket-b", { type: "room.join", build: CLIENT_BUILD, roomId: "ABCDEF", profile }, 1100, identity()).state;
  const disconnected = disconnectRoom(state, "socket-a", 1200);
  expect(tickRoom(disconnected, 61199)).toBe(disconnected);
  const expired = tickRoom(disconnected, 61200);
  expect(expired.sessions).toHaveLength(1);
  expect(expired.lobby!.members).toHaveLength(1);
  expect(expired.lobby!.ownerId).toBe(expired.sessions[0]!.playerId);
});
it("keeps room identities isolated and denies active-token reuse", () => {
  const state = create();
  expect(reduceRoom(state, "socket-b", { type: "room.join", build: CLIENT_BUILD, roomId: "FEDCBA", profile }, 1200, identity()).reason).toBe("wrong-room");
  expect(reduceRoom(state, "socket-b", { type: "room.resume", build: CLIENT_BUILD, token: state.sessions[0]!.token }, 1200, identity()).reason).toBe("invalid-session");
  expect(state.sessions).toHaveLength(1);
});
it("keeps spectators out of the roster and rejects every gameplay mutation", () => {
  const initial = create();
  const watched = reduceRoom(initial, "viewer", { type: "room.spectate", build: CLIENT_BUILD, roomId: "ABCDEF" }, 1100, identity());
  expect(watched.reason).toBe("accepted");
  expect(watched.welcome?.role).toBe("spectator");
  expect(watched.state.lobby).toBe(initial.lobby);
  expect(watched.state.lobby!.members).toHaveLength(1);
  const command = { type: "room.ready", version: 2, roomId: "ABCDEF", revision: initial.lobby!.revision, ready: true };
  expect(reduceRoom(watched.state, "viewer", command, 1200, identity()).reason).toBe("read-only");
  for (const action of [
    { type: "room.start", version: 2, roomId: "ABCDEF", revision: initial.lobby!.revision },
    { type: "lab.surrender", matchId: "m" },
    { type: "turn.fire", version: 2, matchId: "m", turnId: 1, commandId: "forged", ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power: 50 },
    { type: "move.command", version: 2, matchId: "m", turnId: 1, commandId: "forged", moveSeq: 1, direction: 1, steps: 1 },
  ]) expect(reduceRoom(watched.state, "viewer", action, 1200, identity()).reason).toBe("read-only");
  const left = reduceRoom(watched.state, "viewer", { type: "room.leave" }, 1300, identity());
  expect(left.state.lobby).toBe(initial.lobby);
});
it("caps spectators separately at eight and never assigns them ownership", () => {
  let state = create();
  for (let i = 0; i < 8; i++) state = reduceRoom(state, `viewer${i}`, { type: "room.spectate", build: CLIENT_BUILD, roomId: "ABCDEF" }, 1100, identity()).state;
  expect(state.sessions).toHaveLength(9);
  expect(reduceRoom(state, "extra", { type: "room.spectate", build: CLIENT_BUILD, roomId: "ABCDEF" }, 1200, identity()).reason).toBe("spectators-full");
  expect(disconnectRoom(state, "socket-a", 1300).lobby!.ownerId).toBeNull();
});
it("rejects an old build before assigning a seat or resuming a session", () => {
  const initial = createRoomState("ABCDEF");
  const message = { type: "room.create", build: { ...CLIENT_BUILD, sim: "old" }, profile };
  const rejected = reduceRoom(initial, "old", message, 1000, identity());
  expect(rejected.reason).toBe("version-mismatch"); expect(rejected.state).toBe(initial);
  expect(reduceRoom(initial, "old", { type: "room.create", profile }, 1000, identity()).reason).toBe("version-mismatch");
  const state = disconnectRoom(create(), "socket-a", 1100);
  expect(reduceRoom(state, "new", { type: "room.resume", token: state.sessions[0]!.token, build: { ...CLIENT_BUILD, assets: "old" } }, 1200, identity()).reason).toBe("version-mismatch");
});
