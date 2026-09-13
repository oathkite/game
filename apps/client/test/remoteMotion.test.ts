import { expect, it } from "vitest";
import { createRemoteMotion } from "../src/networkLab/remoteMotion";
it("buffers interpolation, rejects stale frames and never extrapolates", () => {
  const motion = createRemoteMotion();
  motion.push({ x: 10, y: 150 }, 0, 1, false);
  motion.push({ x: 20, y: 150 }, 100, 2, false);
  expect(motion.at(175)).toEqual({ x: 15, y: 150 });
  motion.push({ x: 0, y: 150 }, 150, 1, false);
  expect(motion.at(500)).toEqual({ x: 20, y: 150 });
  motion.push({ x: 21, y: 225 }, 550, 3, true);
  expect(motion.at(550)).toEqual({ x: 21, y: 225 });
});
