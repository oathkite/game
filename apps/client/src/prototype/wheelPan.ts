import type { CameraRig } from "./cameraRig";
// Normalize line/page devices and cap a single event without changing zoom.
export const wheelPan = (rig: CameraRig, deltaX: number, deltaY: number, deltaMode: number): void => {
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? rig.get().viewport.height : 1;
  const limit = (delta: number) => Math.max(-80, Math.min(80, delta * unit));
  const now = performance.now();
  rig.pan({ x: -limit(deltaX), y: -limit(deltaY) }, 32, now);
  rig.releasePan(now);
};
