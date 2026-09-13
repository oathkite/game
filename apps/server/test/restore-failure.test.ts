import { expect, it } from "vitest";
import { restoreStoredRoom, UnrecoverableRoom } from "../src/rooms/restoreFailure.js";
import { createRoomState } from "../src/rooms/core.js";
import { serializeRoom } from "../src/rooms/runtime.js";
it("restores valid data and returns a safe error for corrupt or unsupported data", () => {
  const state = createRoomState("ABCDEF");
  expect(restoreStoredRoom(JSON.stringify(serializeRoom(state)))).toEqual(state);
  for (const value of ["invalid secret-token", "null", JSON.stringify({ version: 999, state })]) {
    expect(() => restoreStoredRoom(value)).toThrow(UnrecoverableRoom);
    expect(() => restoreStoredRoom(value)).toThrow("room-unrecoverable");
  }
});
