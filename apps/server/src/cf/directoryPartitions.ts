import type { RoomMode, RoomRegion, RoomPage } from "@game/protocol/v2-rooms";
export const directoryRegions = ["asia", "europe", "americas"] as const;
export const directoryModes = ["custom", "1v1", "2v2"] as const;
export const directoryLocation = (region: RoomRegion) => ({ asia: "apac", europe: "weur", americas: "enam" } as const)[region];
export const directoryKey = (region: RoomRegion, mode: RoomMode): string => `v1:${region}:${mode}:0`;
export const mergeRoomPages = (pages: readonly RoomPage[]): RoomPage => {
  const latest = new Map<string, RoomPage["rooms"][number]>();
  for (const page of pages) for (const room of page.rooms) {
    if (!latest.has(room.roomId) || latest.get(room.roomId)!.updatedAt < room.updatedAt) latest.set(room.roomId, room);
  }
  const all = [...latest.values()].sort((a, b) => a.roomId.localeCompare(b.roomId));
  const rooms = all.slice(0, 20);
  return { rooms, nextCursor: all.length > 20 || pages.some(page => page.nextCursor) ? rooms.at(-1)?.roomId ?? null : null };
};
