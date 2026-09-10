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
it("retains reports after everyone leaves and deletes the file after expiry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "keropod-report-"));
  try {
    const { REPORT_RETENTION_MS } = await import("../src/rooms/reports");
    const store = fileRoomStore(dir);
    const report = { matchId: "m", reporterId: "p1", targetId: "p2", reason: "name" as const, createdAt: 1000, targetName: "Kero", turnId: 1, eventSeq: 0 };
    await store.save(serializeRoom({ ...createRoomState("ABCDEF"), reports: [report] }));
    expect((await store.load(2000))[0]!.reports).toEqual([report]);
    expect(await store.load(1000 + REPORT_RETENTION_MS)).toEqual([]);
    const { readdir } = await import("node:fs/promises");
    expect(await readdir(dir)).toEqual([]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
