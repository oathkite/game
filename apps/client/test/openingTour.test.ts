import { expect, it } from "vitest";
import { openingDuration, openingPose } from "../src/worldUi/openingTour";
const players = [{ x: 50, y: 130 }, { x: 350, y: 160 }];
const pose = (time: number, reduced = false) => openingPose(time, players, { width: 400, height: 225 }, { width: 1000, height: 500, scale: 12 }, reduced);
it("shows the entire map, visits turn order, returns to the first actor then START", () => {
  expect(pose(0).scale).toBeCloseTo(500 / 225);
  expect(pose(1450).center.x).toBe(50);
  expect(pose(2150).center.x).toBe(350);
  expect(pose(2850).center.x).toBe(50);
  expect(pose(3000).start).toBe(true);
  expect(pose(openingDuration(2))).toMatchObject({ done: true, start: false, scale: 12 });
});
it("reduced motion holds the first actor and keeps the same start deadline", () => {
  expect(pose(0, true).center.x).toBe(50);
  expect(pose(3000, true).start).toBe(true);
  expect(pose(openingDuration(2), true).done).toBe(true);
});
