import { expect, it, vi } from "vitest";
import { measureRoomRtt } from "../src/worldUi/roomProbe";
it("measures the actual room endpoint with a monotonic clock", async () => {
  const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ roomId: "ABCDEF" }) });
  const clock = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(451.4);
  expect(await measureRoomRtt("wss://game.test/v2/rooms/ABCDEF", request, clock)).toBe(351);
  expect(request.mock.calls[0]![0]).toBe("https://game.test/v2/rooms/ABCDEF/probe");
  expect(request.mock.calls[0]![1].cache).toBe("no-store");
});
it("does not label failures or mismatched responses as low latency", async () => {
  expect(await measureRoomRtt("ws://game.test/v2/rooms/ABCDEF", vi.fn().mockRejectedValue(new Error("offline")))).toBeNull();
  expect(await measureRoomRtt("ws://game.test/v2/rooms/ABCDEF", vi.fn().mockResolvedValue({ ok: false }))).toBeNull();
  expect(await measureRoomRtt("ws://game.test/v2/rooms/ABCDEF", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ roomId: "000000" }) }))).toBeNull();
});
it("abandons a stalled probe after two seconds", async () => {
  vi.useFakeTimers();
  try {
    const request = vi.fn((_url, options) => new Promise<Response>((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))));
    const result = measureRoomRtt("ws://game.test/v2/rooms/ABCDEF", request);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await result).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});
