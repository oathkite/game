import { expect, it } from "vitest";
import { createFallMotion } from "../src/worldUi/fallMotion";
it("starts at the spawn, accelerates downward and lands exactly", () => {
  const motion = createFallMotion();
  expect(motion.sample("a", 100, 0).y).toBe(100);
  expect(motion.sample("a", 170, 10).y).toBe(100);
  const first = motion.sample("a", 170, 110);
  const second = motion.sample("a", 170, 210);
  expect(first.falling).toBe(true);
  expect(second.y - first.y).toBeGreaterThan(first.y - 100);
  expect(motion.sample("a", 170, 1500)).toEqual({ y: 170, falling: false });
});
it("does not animate slopes, replay poses or reduced motion", () => {
  const motion = createFallMotion();
  motion.sample("a", 100, 0);
  expect(motion.sample("a", 102, 10).falling).toBe(false);
  expect(motion.sample("a", 180, 20, true)).toEqual({ y: 180, falling: false });
  motion.reset();
  expect(motion.sample("a", 80, 30)).toEqual({ y: 80, falling: false });
});
