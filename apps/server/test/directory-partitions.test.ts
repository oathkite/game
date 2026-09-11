import { expect, it } from "vitest";
import { directoryKey, directoryModes, directoryRegions, mergeRoomPages } from "../src/cf/directoryPartitions.js";
it("separates all nine initial queues and merges bounded pages with newest summaries", () => {
  expect(new Set(directoryRegions.flatMap(region => directoryModes.map(mode => directoryKey(region, mode)))).size).toBe(9);
  expect(directoryKey("europe", "2v2")).toBe("v1:europe:2v2:0");
  const rooms = Array.from({ length: 21 }, (_, i) => ({ roomId: i.toString(16).padStart(6, "0").toUpperCase(), mode: "custom" as const, region: "asia" as const, members: 1, spectators: 0, phase: "waiting" as const, mapId: "moss-valley", updatedAt: 1 }));
  const merged = mergeRoomPages([{ rooms: rooms.slice(0, 10), nextCursor: null }, { rooms: rooms.slice(10), nextCursor: null }, { rooms: [{ ...rooms[0]!, members: 2, updatedAt: 2 }], nextCursor: null }]);
  expect(merged.rooms).toHaveLength(20);
  expect(merged.rooms[0]!.members).toBe(2);
  expect(merged.nextCursor).toBe(rooms[19]!.roomId);
  expect(mergeRoomPages([{ rooms: rooms.slice(0, 20), nextCursor: rooms[19]!.roomId }]).nextCursor).toBe(rooms[19]!.roomId);
  expect(mergeRoomPages([{ rooms: [], nextCursor: null }])).toEqual({ rooms: [], nextCursor: null });
});
