import { describe, expect, it } from "vitest";
import { createCameraRig } from "../src/prototype/cameraRig";

const setup = () => {
  const rig = createCameraRig();
  rig.resize({ width: 900, height: 450, scale: 9 }, { left: 0, top: -100, right: 400, bottom: 225 });
  rig.focus({ x: 100, y: 100 }, "actor", true);
  return rig;
};
describe("camera state transitions", () => {
  it("finishes focus within 300ms at 30/60/120fps", () => {
    for (const dt of [1000 / 30, 1000 / 60, 1000 / 120]) {
      const rig = setup(); rig.focus({ x: 300, y: 100 });
      for (let t = 0; t < 301; t += dt) rig.tick(dt, t, false);
      expect(rig.get().center.x).toBeCloseTo(300);
    }
  });
  it("allows manual focus and ignores actor and shot updates after pan", () => {
    const rig = setup();
    rig.pan({ x: -90, y: 0 });
    rig.actor({ x: 300, y: 100 }); rig.shot({ x: 300, y: 100 });
    rig.tick(16, 16, false);
    expect(rig.get().center.x).toBe(110);
    rig.focus({ x: 300, y: 100 }, "manual", true);
    rig.tick(16, 32, true);
    expect(rig.get().center.x).toBe(300);
  });
  it("waits 120ms before edge scroll, and stop cancels continued motion", () => {
    const rig = setup(); rig.edge({ x: 900, y: 200 }, 0);
    rig.tick(16, 119, false); expect(rig.get().center.x).toBe(100);
    rig.tick(16, 120, false); expect(rig.get().center.x).toBeGreaterThan(100);
    rig.stop(); const stopped = rig.get().center;
    rig.tick(16, 300, false); expect(rig.get().center).toEqual(stopped);
  });
  it("keeps actor dead-zone movement across ticks", () => {
    const rig = setup(); rig.actor({ x: 160, y: 100 });
    expect(rig.get().center.x).toBe(130);
    rig.tick(16, 16, false); expect(rig.get().center.x).toBe(130);
  });
  it("clamps a manual view when the viewport resizes", () => {
    const rig = setup(); rig.focus({ x: 350, y: 200 }, "manual", true);
    rig.resize({ width: 1800, height: 900, scale: 9 }, rig.get().bounds);
    expect(rig.get().center).toEqual({ x: 300, y: 175 });
  });
});

describe("manual camera inertia", () => {
  it("coasts briefly after release but never while a finger remains down", () => {
    const rig = setup();
    rig.pan({ x: -20, y: 0 }, 20, 20);
    const held = rig.get().center.x;
    rig.tick(16, 36, false); expect(rig.get().center.x).toBe(held);
    rig.releasePan(40);
    rig.tick(16, 56, false); expect(rig.get().center.x).toBeGreaterThan(held);
    for (let t = 72; t <= 456; t += 16) rig.tick(16, t, false);
    const stopped = rig.get().center.x;
    expect(stopped - held).toBeLessThan(5);
    rig.tick(16, 472, false); expect(rig.get().center.x).toBe(stopped);
  });
  it("does not fling after holding still, or with reduced motion", () => {
    for (const [releaseAt, reduced] of [[150, false], [25, true]] as const) {
      const rig = setup(); rig.pan({ x: -20, y: 0 }, 20, 20);
      const x = rig.get().center.x;
      rig.releasePan(releaseAt); rig.tick(16, releaseAt + 16, reduced);
      expect(rig.get().center.x).toBe(x);
    }
  });
  it("stops inertia on cancellation, new focus, and resize", () => {
    for (const stop of [(r: ReturnType<typeof setup>) => r.stop(), (r: ReturnType<typeof setup>) => r.focus(r.get().center, "manual", true), (r: ReturnType<typeof setup>) => r.resize(r.get().viewport, r.get().bounds)]) {
      const rig = setup(); rig.pan({ x: -20, y: 0 }, 20, 20); rig.releasePan(25);
      stop(rig); const point = rig.get().center;
      rig.tick(16, 41, false); expect(rig.get().center).toEqual(point);
    }
  });
  it("coasts when leaving the edge band and clamps at map limits", () => {
    const rig = setup(); rig.edge({ x: 900, y: 200 }, 0); rig.tick(16, 120, false);
    rig.edge({ x: 450, y: 200 }, 121); const x = rig.get().center.x;
    rig.tick(16, 137, false); expect(rig.get().center.x).toBeGreaterThan(x);
    rig.focus({ x: 350, y: 100 }, "manual", true);
    rig.pan({ x: -20, y: 0 }, 20, 150); rig.releasePan(155);
    rig.tick(16, 171, false); expect(rig.get().center.x).toBe(350);
  });
});
