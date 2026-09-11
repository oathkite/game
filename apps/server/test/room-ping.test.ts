import { expect, it } from "vitest";
import { CLIENT_BUILD } from "@game/protocol/build";
import { createRoomState, reduceRoom } from "../src/rooms/core";
it("echoes authenticated probes without changing room state", () => {
  const identity = { playerId: "p", token: "token", matchId: "m", seed: 1 };
  const probe = { type: "room.ping", nonce: 17 };
  const empty = createRoomState("ABCDEF");
  expect(reduceRoom(empty, "socket", probe, 10, identity).reason).toBe("join-required");
  const state = { ...empty, sessions: [{ ...identity, role: "spectator" as const, connectionId: "socket", disconnectedAt: 0, generation: 1, build: CLIENT_BUILD }] };
  const result = reduceRoom(state, "socket", probe, 20, identity);
  expect(result.pong).toBe(17);
  expect(result.state).toBe(state);
  expect(reduceRoom(state, "socket", { ...probe, nonce: -1 }, 20, identity).reason).toBe("invalid");
});
