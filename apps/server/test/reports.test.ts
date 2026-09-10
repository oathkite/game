import { expect, it } from "vitest";
import { CLIENT_BUILD } from "@game/protocol/build";
import { createBattle, createBattleSession, createLobby, joinLobby } from "@game/engine/multiplayer";
import { MULTIPLAYER_MAPS } from "@game/maps";
import { createRoomState, reduceRoom, tickRoom, nextRoomDeadline } from "../src/rooms/core";
import { REPORT_RETENTION_MS } from "../src/rooms/reports";
import { restoreRoom, serializeRoom, RoomRuntime } from "../src/rooms/runtime";
const identity = { playerId: "unused", token: "unused", matchId: "unused", seed: 1 };
const initial = () => ({ ...createRoomState("ABCDEF"),
  lobby: joinLobby(createLobby("ABCDEF", "p1", { nickname: "ReportedName", loadout: ["cannon", "digger"] }, MULTIPLAYER_MAPS[0]!), "p2", { nickname: "PlayerTwo", loadout: ["cannon", "digger"] }),
  sessions: [{ build: CLIENT_BUILD, role: "spectator" as const, playerId: "viewer", token: "private", connectionId: "socket", disconnectedAt: 0, generation: 1 }],
  battle: createBattleSession(createBattle([{ playerId: "p1", teamId: "t0" }, { playerId: "p2", teamId: "t1" }], 1, MULTIPLAYER_MAPS[0]!), "match", 0),
});
const message = { type: "room.report", matchId: "match", targetId: "p1", reason: "name" };
it("requires an authenticated connection, the current match and a real target", () => {
  const state = initial();
  expect(reduceRoom(state, "unknown", message, 1000, identity).reason).toBe("join-required");
  expect(reduceRoom(state, "socket", { ...message, matchId: "another" }, 1000, identity).reason).toBe("wrong-turn");
  expect(reduceRoom(state, "socket", { ...message, targetId: "outside" }, 1000, identity).reason).toBe("invalid-report-target");
  expect(reduceRoom(state, "socket", { ...message, reason: "anything" }, 1000, identity).reason).toBe("invalid");
});
it("persists reports privately, deduplicates across restoration and expires them", () => {
  const result = reduceRoom(initial(), "socket", message, 1000, identity);
  expect(result.reported).toBe("saved");
  expect(result.state.reports).toHaveLength(1);
  expect(Object.keys(result.state.reports[0]!).sort()).toEqual(["matchId", "targetId", "reason", "reporterId", "createdAt", "targetName", "turnId", "eventSeq"].sort());
  expect(result.state.reports[0]!.targetName).toBe("ReportedName");
  expect(JSON.stringify(result.state.reports)).not.toContain("private");
  const restored = restoreRoom(JSON.parse(JSON.stringify(serializeRoom(result.state))));
  expect(reduceRoom(restored, "socket", message, 1100, identity).reported).toBe("duplicate");
  const archived = { ...restored, battle: null, sessions: [] };
  expect(nextRoomDeadline(archived)).toBe(1000 + REPORT_RETENTION_MS);
  expect(tickRoom(archived, 1000 + REPORT_RETENTION_MS).reports).toEqual([]);
});
it("does not acknowledge a report before durable storage succeeds", async () => {
  const runtime = new RoomRuntime(initial(), async () => { throw new Error("storage offline"); });
  await expect(runtime.update(state => reduceRoom(state, "socket", message, 1000, identity))).rejects.toThrow("storage offline");
  expect(runtime.state.reports).toEqual([]);
});
it("does not expose private reports in public frames", async () => {
  const { roomFrame } = await import("../src/rooms/frame");
  const result = reduceRoom(initial(), "socket", message, 1000, identity);
  expect(roomFrame(result.state, 1000)).not.toHaveProperty("reports");
});
it("caps stored reports and keeps expired entries from consuming capacity", () => {
  const saved = reduceRoom(initial(), "socket", message, 1000, identity).state;
  const reports = Array.from({ length: 256 }, (_, i) => ({ ...saved.reports[0]!, reporterId: `viewer-${i}` }));
  const full = { ...saved, reports };
  expect(reduceRoom(full, "socket", message, 1100, identity).reason).toBe("report-capacity");
  const afterExpiry = reduceRoom(full, "socket", message, 1000 + REPORT_RETENTION_MS, identity);
  expect(afterExpiry.reported).toBe("saved");
  expect(afterExpiry.state.reports).toHaveLength(1);
});
