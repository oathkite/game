import { expect, it } from "vitest";
import { labFrameSchema } from "../src/v2Lab";
const map = { id: "bridge", version: 1, width: 1, height: 12, surface: [2], solidColumns: [[[2, 4], [8, 11]]] };
it("retains authored terrain on the wire", () => {
  expect(labFrameSchema.shape.map.parse(map)).toEqual(map);
});
it("rejects invalid spans and preserves legacy map compatibility", () => {
  for (const solidColumns of [[], [[[4, 2]]], [[[2, 7], [6, 9]]], [[[2, 13]]]]) {
    expect(labFrameSchema.shape.map.safeParse({ ...map, solidColumns }).success).toBe(false);
  }
  const { solidColumns: _, ...legacy } = map;
  expect(labFrameSchema.shape.map.parse(legacy)).toEqual(legacy);
});
