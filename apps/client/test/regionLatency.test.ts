import { expect, it, vi } from "vitest";
import { fastestRegion, measureRegions } from "../src/worldUi/regionLatency";
it("chooses the lowest valid response and leaves an unavailable selection unknown", () => {
  expect(fastestRegion([{ region: "asia", milliseconds: null }, { region: "europe", milliseconds: 50 }, { region: "americas", milliseconds: 200 }])).toBe("europe");
  expect(fastestRegion([{ region: "asia", milliseconds: null }])).toBeNull();
});
it("takes three measurements per region without allocating a room", async () => {
  let clock = 0;
  const request = vi.fn(async (url: string) => ({ ok: true, json: async () => ({ region: new URL(url).pathname.split("/")[3], mode: "2v2" }) })) as unknown as typeof fetch;
  const result = await measureRegions("https://game.test", "2v2", new AbortController().signal, request, () => ++clock);
  expect(request).toHaveBeenCalledTimes(9);
  expect(result.every(t => t.milliseconds !== null)).toBe(true);
  const aborted = new AbortController(); aborted.abort();
  expect((await measureRegions("https://game.test", "2v2", aborted.signal, request)).every(t => t.milliseconds === null)).toBe(true);
  expect(request).toHaveBeenCalledTimes(9);
});
