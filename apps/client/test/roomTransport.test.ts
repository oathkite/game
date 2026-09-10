import { expect, it, vi } from "vitest";
import { resolveRoomUrl } from "../src/worldUi/roomTransport";
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
