import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { expect, it } from "vitest";
import type { RoomSummary } from "@game/protocol/v2-rooms";
import {
  createDirectoryTables, createRoomEntry, listRooms, quickRoom, roomExists, updateRoomEntry,
  DIRECTORY_ROOM_LIMIT, NEW_ROOM_TTL_MS, RESERVATION_TTL_MS, UPDATED_ROOM_TTL_MS, type DirectorySql,
} from "../src/cf/directoryStore.js";

// Durable Object の sql.exec と同じ呼び方を node:sqlite で再現する。時刻は now として渡す（偽の時計）。
const directory = () => {
  const db = new DatabaseSync(":memory:");
  const sql: DirectorySql = {
    exec: <T,>(query: string, ...bindings: (string | number | null)[]) => {
      const rows = db.prepare(query).all(...(bindings as SQLInputValue[])) as T[];
      return { toArray: () => rows, one: () => { if (rows.length !== 1) throw new Error(`expected one row, got ${rows.length}`); return rows[0]!; } };
    },
  };
  createDirectoryTables(sql);
  let codes = 0;
  const reserveCode = async (): Promise<string> => (++codes).toString(16).toUpperCase().padStart(6, "0");
  return { sql, reserveCode, close: () => db.close() };
};
const summary = (roomId: string, updatedAt: number, members = 1): RoomSummary =>
  ({ roomId, mode: "custom", region: "asia", members, spectators: 0, phase: "waiting", mapId: "moss-valley", updatedAt });

it("fixes the directory limits as named constants", () => {
  expect([RESERVATION_TTL_MS, NEW_ROOM_TTL_MS, UPDATED_ROOM_TTL_MS, DIRECTORY_ROOM_LIMIT]).toEqual([10_000, 120_000, 1_800_000, 1_000]);
});

it("keeps quick seat reservations for ten seconds and frees them afterwards", async () => {
  const { sql, reserveCode, close } = directory();
  try {
    const first = await quickRoom(sql, 0, "1v1", "asia", reserveCode);
    expect(await quickRoom(sql, 0, "1v1", "asia", reserveCode)).toBe(first);
    // 10 秒ちょうどは予約が残るので、2 席とも埋まったまま別の部屋へ回す
    expect(await quickRoom(sql, RESERVATION_TTL_MS, "1v1", "asia", reserveCode)).not.toBe(first);
    // 10 秒を過ぎると予約が消え、最初の部屋に空きが戻る
    expect(await quickRoom(sql, RESERVATION_TTL_MS + 1, "1v1", "asia", reserveCode)).toBe(first);
  } finally { close(); }
});

it("drops an unused new room after 120 seconds", async () => {
  const { sql, reserveCode, close } = directory();
  try {
    const roomId = await createRoomEntry(sql, 0, "custom", "asia", reserveCode);
    expect(roomExists(sql, NEW_ROOM_TTL_MS, roomId)).toBe(true);
    expect(roomExists(sql, NEW_ROOM_TTL_MS + 1, roomId)).toBe(false);
    expect(listRooms(sql, NEW_ROOM_TTL_MS).map(room => room.roomId)).toEqual([roomId]);
    expect(listRooms(sql, NEW_ROOM_TTL_MS + 1)).toEqual([]);
  } finally { close(); }
});

it("extends an updated room for thirty minutes and forgets it once empty", async () => {
  const { sql, reserveCode, close } = directory();
  try {
    const roomId = await createRoomEntry(sql, 0, "custom", "asia", reserveCode);
    updateRoomEntry(sql, 60_000, summary(roomId, 60_000));
    expect(roomExists(sql, NEW_ROOM_TTL_MS + 1, roomId)).toBe(true);
    expect(roomExists(sql, 60_000 + UPDATED_ROOM_TTL_MS, roomId)).toBe(true);
    expect(roomExists(sql, 60_000 + UPDATED_ROOM_TTL_MS + 1, roomId)).toBe(false);
    // 作成時刻は最初の登録のまま。古い更新は無視する
    expect(listRooms(sql, 60_000)[0]).toMatchObject({ createdAt: 0, updatedAt: 60_000 });
    updateRoomEntry(sql, 61_000, summary(roomId, 50_000, 3));
    expect(listRooms(sql, 61_000)[0]).toMatchObject({ members: 1, updatedAt: 60_000 });
    // 参加者も観戦者もいなくなった部屋は一覧から消す
    updateRoomEntry(sql, 70_000, summary(roomId, 70_000, 0));
    expect(roomExists(sql, 70_000, roomId)).toBe(false);
  } finally { close(); }
});

it("refuses the 1001st live room until older rooms expire", async () => {
  const { sql, reserveCode, close } = directory();
  try {
    for (let i = 0; i < DIRECTORY_ROOM_LIMIT; i++) await createRoomEntry(sql, 0, "custom", "asia", reserveCode);
    await expect(createRoomEntry(sql, NEW_ROOM_TTL_MS, "custom", "asia", reserveCode)).rejects.toThrow("directory capacity");
    // 期限の切れた部屋は数えない
    await expect(createRoomEntry(sql, NEW_ROOM_TTL_MS + 1, "custom", "asia", reserveCode)).resolves.toBeTypeOf("string");
    expect(listRooms(sql, NEW_ROOM_TTL_MS + 1)).toHaveLength(1);
  } finally { close(); }
});
