import { clampCamera, edgeVelocity, followCamera, panCamera, type Bounds, type Point, type Viewport } from "./camera";

export type CameraMode = "actor" | "manual" | "shot";
export const createCameraRig = () => {
  let viewport: Viewport = { width: 1, height: 1, scale: 6 };
  let bounds: Bounds = { left: 0, top: -100, right: 400, bottom: 225 };
  let center: Point = { x: 90, y: 130 }, target = center;
  let mode: CameraMode = "actor";
  let edge: Point | null = null, edgeSince = 0;
  let remaining = 0;
  const setTarget = (point: Point, duration: number): void => {
    target = clampCamera(point, viewport, bounds);
    remaining = duration;
  };
  return {
    get: () => ({ center, viewport, bounds, mode }),
    resize: (v: Viewport, b: Bounds) => { viewport = v; bounds = b; center = clampCamera(center, v, b); target = clampCamera(target, v, b); },
    focus: (point: Point, next: CameraMode = "actor", reduced = false) => { mode = next; setTarget(point, reduced ? 0 : 300); if (reduced) center = target; edge = null; },
    actor: (point: Point) => { if (mode === "actor" && remaining === 0) { center = followCamera(center, point, viewport, bounds); target = center; } },
    shot: (point: Point) => { if (mode === "shot") setTarget(point, 80); },
    pan: (delta: Point) => { mode = "manual"; remaining = 0; center = panCamera(center, delta, viewport, bounds); target = center; },
    edge: (point: Point | null, now: number) => {
      const velocity = point ? edgeVelocity(point, viewport) : null;
      if (!velocity || (velocity.x === 0 && velocity.y === 0)) { edge = null; return; }
      if (!edge) edgeSince = now;
      edge = velocity;
    },
    stop: () => { edge = null; },
    tick: (dt: number, now: number, reduced: boolean) => {
      const elapsed = Math.min(50, dt);
      if (edge && now - edgeSince >= 120) {
        mode = "manual"; remaining = 0;
        center = clampCamera({ x: center.x + edge.x * elapsed / 1000 / viewport.scale, y: center.y + edge.y * elapsed / 1000 / viewport.scale }, viewport, bounds);
        target = center;
      } else if (mode !== "manual" || remaining > 0) {
        const ratio = reduced || remaining <= elapsed ? 1 : elapsed / remaining;
        center = { x: center.x + (target.x - center.x) * ratio, y: center.y + (target.y - center.y) * ratio };
        remaining = Math.max(0, remaining - elapsed);
      }
      return center;
    },
  };
};
export type CameraRig = ReturnType<typeof createCameraRig>;
