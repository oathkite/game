import { clampCamera, edgeVelocity, followCamera, panCamera, type Bounds, type Point, type Viewport } from "./camera";

export type CameraMode = "actor" | "manual" | "shot";
export const createCameraRig = () => {
  let viewport: Viewport = { width: 1, height: 1, scale: 6 };
  let bounds: Bounds = { left: 0, top: -100, right: 400, bottom: 225 };
  let center: Point = { x: 90, y: 130 }, target = center;
  let mode: CameraMode = "actor";
  let edge: Point | null = null, edgeSince = 0;
  let remaining = 0;
  // CSS px/ms。短い余韻に抑え、画面倍率にかかわらず同じ距離感にする。
  let velocity: Point = { x: 0, y: 0 }, coast = false, sampledAt = 0, coastMs = 0;
  const stop = (): void => { edge = null; coast = false; velocity = { x: 0, y: 0 }; };
  const drift = (elapsed: number): void => {
    const decay = Math.exp(-elapsed / 80);
    const next = { x: center.x + velocity.x * 80 * (1 - decay) / viewport.scale, y: center.y + velocity.y * 80 * (1 - decay) / viewport.scale };
    center = clampCamera(next, viewport, bounds); target = center;
    velocity = { x: center.x === next.x ? velocity.x * decay : 0, y: center.y === next.y ? velocity.y * decay : 0 };
    coastMs += elapsed;
    if (coastMs >= 320 || Math.hypot(velocity.x, velocity.y) < 0.01) stop();
  };
  const setTarget = (point: Point, duration: number): void => {
    target = clampCamera(point, viewport, bounds);
    remaining = duration;
  };
  return {
    get: () => ({ center, viewport, bounds, mode }),
    resize: (v: Viewport, b: Bounds) => { stop(); viewport = v; bounds = b; center = clampCamera(center, v, b); target = clampCamera(target, v, b); },
    focus: (point: Point, next: CameraMode = "actor", reduced = false) => { stop(); mode = next; setTarget(point, reduced ? 0 : 300); if (reduced) center = target; edge = null; },
    actor: (point: Point) => { if (mode === "actor" && remaining === 0) { center = followCamera(center, point, viewport, bounds); target = center; } },
    shot: (point: Point) => { if (mode === "shot") setTarget(point, 80); },
    pan: (delta: Point, sampleMs?: number, now = 0) => {
      stop(); mode = "manual"; remaining = 0;
      center = panCamera(center, delta, viewport, bounds); target = center;
      if (sampleMs !== undefined) {
        const length = Math.max(1, Math.hypot(delta.x, delta.y) / Math.max(8, sampleMs) / 0.48);
        velocity = { x: -delta.x / Math.max(8, sampleMs) / length, y: -delta.y / Math.max(8, sampleMs) / length };
        sampledAt = now;
      }
    },
    releasePan: (now: number) => { coast = now - sampledAt <= 80; coastMs = 0; },
    edge: (point: Point | null, now: number) => {
      const velocity = point ? edgeVelocity(point, viewport) : null;
      if (!velocity || (velocity.x === 0 && velocity.y === 0)) { edge = null; return; }
      if (!edge) edgeSince = now;
      edge = velocity;
    },
    stop,
    tick: (dt: number, now: number, reduced: boolean) => {
      const elapsed = Math.min(50, dt);
      if (reduced) { coast = false; velocity = { x: 0, y: 0 }; }
      if (edge && now - edgeSince >= 120) {
        mode = "manual"; remaining = 0;
        center = clampCamera({ x: center.x + edge.x * elapsed / 1000 / viewport.scale, y: center.y + edge.y * elapsed / 1000 / viewport.scale }, viewport, bounds);
        target = center;
        velocity = { x: edge.x / 1000, y: edge.y / 1000 }; coast = !reduced; coastMs = 0;
      } else if (coast && mode === "manual") {
        drift(elapsed);
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
