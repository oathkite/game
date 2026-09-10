import { expect, it } from "vitest";
import { createTankAnimation } from "../src/prototype/tankAnimation";
it("starts idle and follows movement with a short stop tail", () => {
  const animate = createTankAnimation();
  expect(animate({ x: 10, hp: 100, flash: false }, 0)).toEqual({ tracks: 0, pilot: 0 });
  expect(animate({ x: 11, hp: 100, flash: false }, 20).pilot).toBe(3);
  expect(animate({ x: 11, hp: 100, flash: false }, 100).pilot).toBe(3);
  expect(animate({ x: 11, hp: 100, flash: false }, 200).tracks).toBe(0);
});
it("uses authored idle and low-health poses with hit and wreck priority", () => {
  const animate = createTankAnimation();
  const pose = { x: 0, hp: 100, flash: false };
  animate(pose, 0);
  expect(animate(pose, 500).pilot).toBe(1);
  expect(animate(pose, 1000).pilot).toBe(2);
  expect(animate({ ...pose, hp: 25 }, 1200).pilot).toBe(9);
  expect(animate({ ...pose, hp: 25 }, 1800).pilot).toBe(10);
  expect(animate({ ...pose, hp: 25, flash: true }, 1810).pilot).toBe(7);
  expect(animate({ ...pose, hp: 0, flash: true }, 1820).pilot).toBe(7);
});
it("keeps optional frame cycling still when reduced motion is enabled", () => {
  const animate = createTankAnimation();
  const pose = { x: 0, hp: 100, flash: false };
  animate(pose, 0, true);
  expect(animate(pose, 1000, true)).toEqual({ tracks: 0, pilot: 0 });
  expect(animate({ ...pose, hp: 0 }, 1100, true).pilot).toBe(15);
});
it("plays fall then landing from frame zero without mistaking ground movement for falling", () => {
  const animate = createTankAnimation();
  const pose = { x: 0, hp: 100, flash: false, falling: false };
  animate(pose, 0);
  expect(animate({ ...pose, x: 1 }, 20).pilot).toBe(3);
  expect(animate({ ...pose, falling: true }, 40).pilot).toBe(11);
  expect(animate({ ...pose, falling: true }, 500).pilot).toBe(11);
  expect(animate(pose, 600).pilot).toBe(12);
  expect(animate(pose, 750).pilot).toBe(0);
  expect(animate(pose, 780).pilot).toBe(0);
  expect(animate({ ...pose, falling: true, hp: 0 }, 800).pilot).toBe(7);
});
it("plays destruction once on a live-to-dead transition and skips it for existing wrecks", () => {
  const animate = createTankAnimation(), pose = { x: 0, hp: 100, flash: false };
  expect(createTankAnimation()({ ...pose, hp: 0 }, 0).pilot).toBe(15);
  animate(pose, 0);
  expect(animate({ ...pose, hp: 0 }, 20).pilot).toBe(7);
  expect(animate({ ...pose, hp: 0 }, 140).pilot).toBe(13);
  expect(animate({ ...pose, hp: 0 }, 470).pilot).toBe(14);
  expect(animate({ ...pose, hp: 0 }, 620).pilot).toBe(15);
  expect(animate({ ...pose, hp: 0, flash: true }, 1000).pilot).toBe(15);
  animate(pose, 1100);
  expect(animate({ ...pose, hp: 0 }, 1200).pilot).toBe(7);
});
