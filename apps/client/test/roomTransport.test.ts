import { expect, it, vi } from "vitest";
import { english } from "../src/i18n/messages";
import { INVALID_ROOM_SETTINGS_STATUS, resolveRoomUrl, ROOM_RATE_LIMIT_STATUS, ROOM_UNREACHABLE_STATUS, roomFailureStatus } from "../src/worldUi/roomTransport";
it("routes joins and resumes to the same room and uses secure WebSockets for HTTPS", async () => {
  expect(await resolveRoomUrl({ type: "room.join", roomId: "ABCDEF" }, "https://game.example", null)).toBe("wss://game.example/v2/rooms/ABCDEF");
  expect(await resolveRoomUrl({ type: "room.resume" }, "https://game.example", "ABCDEF")).toBe("wss://game.example/v2/rooms/ABCDEF");
  await expect(resolveRoomUrl({ type: "room.resume" }, "https://game.example", null)).rejects.toThrow("missing room");
});
it("allocates a server room before opening the create socket", async () => {
  const request = vi.fn(async () => new Response(JSON.stringify({ roomId: "FEDCBA" })));
  expect(await resolveRoomUrl({ type: "room.create" }, "http://localhost:8796", null, request)).toBe("ws://localhost:8796/v2/rooms/FEDCBA");
  expect(request).toHaveBeenCalledWith("http://localhost:8796/v2/rooms", { method: "POST" });
});
it("keeps the requested mode and region when allocating a quick room", async () => {
  const request = vi.fn(async () => new Response(JSON.stringify({ roomId: "FEDCBA" })));
  expect(await resolveRoomUrl({ type: "room.quick", mode: "2v2", region: "europe" }, "https://game.example", null, request)).toBe("wss://game.example/v2/rooms/FEDCBA");
  expect(request).toHaveBeenCalledWith("https://game.example/v2/quick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "2v2", region: "europe" }) });
});
const failing = (status: number, body: string, headers: Record<string, string> = {}) => vi.fn(async () => new Response(body, { status, headers }));
const failureOf = async (initial: Parameters<typeof resolveRoomUrl>[0], request: typeof fetch): Promise<string> =>
  roomFailureStatus(await resolveRoomUrl(initial, "https://game.example", null, request).then(() => null, (error: unknown) => error));
const create = { type: "room.create" } as const, quick = { type: "room.quick", mode: "1v1", region: "asia" } as const;
it("tells rejected room settings apart from a lost server", async () => {
  expect(await failureOf(create, failing(400, "invalid room settings"))).toBe(INVALID_ROOM_SETTINGS_STATUS);
  expect(await failureOf(quick, failing(400, "invalid mode"))).toBe(INVALID_ROOM_SETTINGS_STATUS);
});
it("asks to wait when room allocation is rate limited", async () => {
  expect(await failureOf(create, failing(429, "allocation rate limit", { "Retry-After": "60" }))).toBe(ROOM_RATE_LIMIT_STATUS);
  expect(await failureOf(quick, failing(429, "allocation rate limit", { "Retry-After": "60" }))).toBe(ROOM_RATE_LIMIT_STATUS);
});
it("keeps the connection failure message for network errors, server errors and broken replies", async () => {
  expect(await failureOf(create, vi.fn(async () => { throw new TypeError("Failed to fetch"); }))).toBe(ROOM_UNREACHABLE_STATUS);
  expect(await failureOf(create, failing(500, "internal error"))).toBe(ROOM_UNREACHABLE_STATUS);
  expect(await failureOf(quick, failing(503, ""))).toBe(ROOM_UNREACHABLE_STATUS);
  expect(await failureOf(create, vi.fn(async () => new Response(JSON.stringify({ roomId: "bad" }))))).toBe(ROOM_UNREACHABLE_STATUS);
});
it("has an English entry for every allocation failure message", () => {
  expect([INVALID_ROOM_SETTINGS_STATUS, ROOM_RATE_LIMIT_STATUS, ROOM_UNREACHABLE_STATUS].filter(text => !Object.hasOwn(english, text))).toEqual([]);
});
