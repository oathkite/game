import { describe, expect, it } from "vitest";
import { DEFAULT_CAMERA_SETTINGS, normalizeCameraSettings } from "../src/prototype/cameraSettings";
import { createCameraRig } from "../src/prototype/cameraRig";

const rigAtCenter = () => {
  const rig = createCameraRig();
  rig.resize({ width: 900, height: 450, scale: 9 }, { left: 0, top: -100, right: 400, bottom: 225 });
  rig.focus({ x: 200, y: 100 }, "manual", true);
  return rig;
};
describe("camera tuning", () => {
  it("uses the approved speed and inertia on a fresh browser", () => {
    expect(normalizeCameraSettings(null)).toEqual({ speed: 2.8, inertiaMs: 1000 });
  });
  it("validates saved values and bounds", () => {
    for (const value of [null, "bad", [], { speed: NaN, inertiaMs: Infinity }]) expect(normalizeCameraSettings(value)).toEqual(DEFAULT_CAMERA_SETTINGS);
    expect(normalizeCameraSettings({ speed: 100, inertiaMs: -1 })).toEqual({ speed: 3, inertiaMs: 0 });
  });
  it("changes drag and edge speed immediately", () => {
    const rig = rigAtCenter(); rig.configure({ speed: 2, inertiaMs: 320 });
    rig.pan({ x: 90, y: 0 }); expect(rig.get().center.x).toBe(180);
    rig.edge({ x: 900, y: 200 }, 0); rig.tick(30, 120, true);
    expect(rig.get().center.x).toBeCloseTo(180 + 960 * .03 / 9);
  });
  it("zero inertia stops on release; longer inertia travels farther", () => {
    const distances = [0, 320, 640].map(inertiaMs => {
      const rig = rigAtCenter(); rig.configure({ speed: 1, inertiaMs });
      rig.pan({ x: -20, y: 0 }, 20, 20); const x = rig.get().center.x;
      rig.releasePan(25);
      for (let t = 0; t < 800; t += 16) rig.tick(16, t + 25, false);
      return rig.get().center.x - x;
    });
    expect(distances[0]).toBe(0);
    expect(distances[1]).toBeGreaterThan(0);
    expect(distances[2]).toBeGreaterThan(distances[1]!);
  });
  it("changing parameters cancels existing momentum", () => {
    const rig = rigAtCenter(); rig.pan({ x: -20, y: 0 }, 20, 20); rig.releasePan(25);
    rig.configure({ speed: 2, inertiaMs: 640 }); const x = rig.get().center.x;
    rig.tick(16, 41, false); expect(rig.get().center.x).toBe(x);
  });
});
