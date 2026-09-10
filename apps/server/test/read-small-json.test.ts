import { expect, it } from "vitest";
import { readSmallJson } from "../src/rooms/readSmallJson";
it("accepts a bounded allocation and rejects malformed or oversized bodies", async () => {
  const request = (body: string) => new Request("http://localhost", { method: "POST", body });
  expect(await readSmallJson(request('{"mode":"1v1","region":"asia"}'))).toEqual({ mode: "1v1", region: "asia" });
  expect(await readSmallJson(request("{"))).toBeNull();
  expect(await readSmallJson(request(JSON.stringify({ value: "x".repeat(513) })))).toBeNull();
});
