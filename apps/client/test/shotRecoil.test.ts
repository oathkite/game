import { expect, it } from "vitest";
import { shotRecoil } from "../src/game/shotRecoil";
it("uses the authored 180ms pulse and does not accumulate simultaneous barrels", () => {
  expect(shotRecoil(-1, [0])).toBe(0);
  expect(shotRecoil(0, [0])).toBe(0);
  expect(shotRecoil(90, [0, 0, 0])).toBe(3);
  expect(shotRecoil(180, [0])).toBe(0);
  expect(shotRecoil(290, [0, 200])).toBe(3);
  expect(shotRecoil(380, [0, 200])).toBe(0);
  expect(shotRecoil(90, [])).toBe(0);
});
