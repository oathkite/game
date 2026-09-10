import { CLIENT_BUILD } from "@game/protocol/build";
import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileRoomStore } from "../src/rooms/fileStore";
import { createRoomState, reduceRoom } from "../src/rooms/core";
import { serializeRoom } from "../src/rooms/runtime";
it("reopens a persisted room with reconnect grace and preserves its private session", async () => {
  const dir = await mkdtemp(join(tmpdir(), "keropod-room-"));
  try {
    const store = fileRoomStore(dir);
    const id = { playerId: "p1", token: "00000000-0000-4000-8000-000000000001", matchId: "m", seed: 42 };
    const state = reduceRoom(createRoomState("ABCDEF"), "c1", { type: "room.create", build: CLIENT_BUILD, profile: { nickname: "Kero", loadout: ["cannon", "digger"] } }, 1000, id).state;
    await store.save(serializeRoom(state));
    const [restored] = await fileRoomStore(dir).load(2000);
    expect(restored!.sessions[0]).toMatchObject({ token: id.token, connectionId: null, disconnectedAt: 2000 });
    const resumed = reduceRoom(restored!, "c2", { type: "room.resume", build: CLIENT_BUILD, token: id.token }, 2100, id);
    expect(resumed.welcome?.generation).toBe(2);
    expect(resumed.state.lobby!.members).toHaveLength(1);
    expect(await fileRoomStore(dir).load(62000)).toEqual([]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
