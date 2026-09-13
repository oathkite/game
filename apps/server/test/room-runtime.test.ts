import { CLIENT_BUILD } from "@game/protocol/build";
import { expect, it } from "vitest";
import { createRoomState, reduceRoom } from "../src/rooms/core";
import { RoomRuntime, restoreRoom, serializeRoom } from "../src/rooms/runtime";
const id = { playerId: "p1", token: "00000000-0000-4000-8000-000000000001", matchId: "m", seed: 42 };
const join = (state: ReturnType<typeof createRoomState>) => reduceRoom(state, "c1", { type: "room.create", build: CLIENT_BUILD, profile: { nickname: "Kero", loadout: ["cannon", "digger"] } }, 1000, id);
it("publishes committed state only after durable storage succeeds", async () => {
  let release!: () => void;
  const runtime = new RoomRuntime(createRoomState("ABCDEF"), () => new Promise<void>(r => { release = r; }));
  const pending = runtime.update(join);
  await Promise.resolve();
  expect(runtime.state.lobby).toBeNull();
  release(); await pending;
  expect(runtime.state.lobby?.ownerId).toBe("p1");
  expect(restoreRoom(JSON.parse(JSON.stringify(serializeRoom(runtime.state))))).toEqual(runtime.state);
});
it("keeps the previous state on storage failure and permits a later retry", async () => {
  let failed = true;
  const runtime = new RoomRuntime(createRoomState("ABCDEF"), async () => { if (failed) throw new Error("disk unavailable"); });
  await expect(runtime.update(join)).rejects.toThrow("disk unavailable");
  expect(runtime.state.lobby).toBeNull();
  failed = false;
  await runtime.update(join);
  expect(runtime.state.sessions).toHaveLength(1);
});
