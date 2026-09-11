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
it("keeps the requested mode and region when allocating a quick room", async () => {
  const request = vi.fn(async () => new Response(JSON.stringify({ roomId: "FEDCBA" })));
  expect(await resolveRoomUrl({ type: "room.quick", mode: "2v2", region: "europe" }, "https://game.example", null, request)).toBe("wss://game.example/v2/rooms/FEDCBA");
  expect(request).toHaveBeenCalledWith("https://game.example/v2/quick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "2v2", region: "europe" }) });
});
