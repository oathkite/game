import { expect, it } from "vitest";
import { createRoomOptionsSchema } from "../src/v2Rooms";
it("defaults old room requests and bounds the turn limit", () => {
  expect(createRoomOptionsSchema.parse({}).turnLimit).toBe(12);
  for (const turnLimit of [0, 1, 7, 50]) expect(createRoomOptionsSchema.parse({ turnLimit }).turnLimit).toBe(turnLimit);
  for (const turnLimit of [-1, 51, 1.5, "12", null]) expect(createRoomOptionsSchema.safeParse({ turnLimit }).success).toBe(false);
});
