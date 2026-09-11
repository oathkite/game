import { DEFAULT_CAMERA_SETTINGS, normalizeCameraSettings, type CameraSettings } from "./cameraSettings";
import { clampCamera, edgeVelocity, followCamera, panCamera, type Bounds, type Point, type Viewport } from "./camera";

const smootherstep = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
// Integral of 1 - smootherstep: frame-rate independent coast displacement.
const coastIntegral = (t: number): number => t - 2.5 * t ** 4 + 3 * t ** 5 - t ** 6;

export type CameraMode = "actor" | "manual" | "shot";
export const createCameraRig = () => {
  let viewport: Viewport = { width: 1, height: 1, scale: 6 };
  let bounds: Bounds = { left: 0, top: -100, right: 400, bottom: 225 };
  let center: Point = { x: 90, y: 130 }, target = center;
  let mode: CameraMode = "actor";
  let edge: Point | null = null, edgeSince = 0;
  let remaining = 0, duration = 0, edgeElapsed = 0;
  let origin = center, easeFocus = false;
  let settings = DEFAULT_CAMERA_SETTINGS;
  // CSS px/ms。短い余韻に抑え、画面倍率にかかわらず同じ距離感にする。
  let velocity: Point = { x: 0, y: 0 }, coast = false, sampledAt = 0, coastMs = 0;
  const stop = (): void => { edge = null; edgeElapsed = 0; coast = false; velocity = { x: 0, y: 0 }; };
  const drift = (elapsed: number): void => {
    const from = coastMs / settings.inertiaMs;
    coastMs = Math.min(settings.inertiaMs, coastMs + elapsed);
    const to = coastMs / settings.inertiaMs;
    const distance = settings.inertiaMs * (coastIntegral(to) - coastIntegral(from)) / viewport.scale;
    const next = { x: center.x + velocity.x * distance, y: center.y + velocity.y * distance };
    center = clampCamera(next, viewport, bounds); target = center;
    velocity = { x: center.x === next.x ? velocity.x : 0, y: center.y === next.y ? velocity.y : 0 };
    if (coastMs >= settings.inertiaMs || (velocity.x === 0 && velocity.y === 0)) stop();
  };
  const setTarget = (point: Point, milliseconds: number, eased = false): void => {
    target = clampCamera(point, viewport, bounds);
    remaining = milliseconds; duration = milliseconds; origin = center; easeFocus = eased;
  };
  return {
    configure: (next: CameraSettings) => { stop(); settings = normalizeCameraSettings(next); },
    get: () => ({ center, viewport, bounds, mode }),
    resize: (v: Viewport, b: Bounds) => { stop(); viewport = v; bounds = b; center = clampCamera(center, v, b); origin = center; duration = remaining; target = clampCamera(target, v, b); },
    focus: (point: Point, next: CameraMode = "actor", reduced = false) => { stop(); mode = next; setTarget(point, reduced ? 0 : 300, true); if (reduced) center = target; edge = null; },
    actor: (point: Point) => { if (mode === "actor" && remaining === 0) { center = followCamera(center, point, viewport, bounds); target = center; easeFocus = false; } },
    shot: (point: Point) => { if (mode === "shot") setTarget(point, 80); },
    pan: (delta: Point, sampleMs?: number, now = 0) => {
      stop(); mode = "manual"; remaining = 0;
      const movement = { x: delta.x * settings.speed, y: delta.y * settings.speed };
      center = panCamera(center, movement, viewport, bounds); target = center;
      if (sampleMs !== undefined) {
        const length = Math.max(1, Math.hypot(delta.x, delta.y) / Math.max(8, sampleMs) / 0.48);
        velocity = { x: -movement.x / Math.max(8, sampleMs) / length, y: -movement.y / Math.max(8, sampleMs) / length };
        sampledAt = now;
      }
    },
    releasePan: (now: number) => { coast = settings.inertiaMs > 0 && now - sampledAt <= 80; coastMs = 0; },
    edge: (point: Point | null, now: number) => {
      const velocity = point ? edgeVelocity(point, viewport) : null;
      if (!velocity || (velocity.x === 0 && velocity.y === 0)) { edge = null; return; }
      if (!edge || edge.x * velocity.x < 0 || edge.y * velocity.y < 0) { edgeSince = now; edgeElapsed = 0; }
      edge = { x: velocity.x * settings.speed, y: velocity.y * settings.speed };
    },
    stop,
    tick: (dt: number, now: number, reduced: boolean) => {
      const elapsed = Math.min(50, dt);
      if (reduced) { coast = false; velocity = { x: 0, y: 0 }; }
      if (edge && now - edgeSince >= 120) {
        mode = "manual"; remaining = 0;
        edgeElapsed += elapsed;
        const gain = reduced ? 1 : smootherstep(Math.min(1, edgeElapsed / 180));
        center = clampCamera({ x: center.x + edge.x * gain * elapsed / 1000 / viewport.scale, y: center.y + edge.y * gain * elapsed / 1000 / viewport.scale }, viewport, bounds);
        target = center;
        velocity = { x: edge.x * gain / 1000, y: edge.y * gain / 1000 }; coast = !reduced && settings.inertiaMs > 0; coastMs = 0;
      } else if (coast && mode === "manual") {
        drift(elapsed);
      } else if (mode !== "manual" || remaining > 0) {
        const ratio = reduced || remaining <= elapsed ? 1 : elapsed / remaining;
        const progress = reduced || duration === 0 ? 1 : smootherstep(Math.min(1, (duration - remaining + elapsed) / duration));
        center = easeFocus
          ? { x: origin.x + (target.x - origin.x) * progress, y: origin.y + (target.y - origin.y) * progress }
          : { x: center.x + (target.x - center.x) * ratio, y: center.y + (target.y - center.y) * ratio };
        remaining = Math.max(0, remaining - elapsed);
      }
      return center;
    },
  };
};
export type CameraRig = ReturnType<typeof createCameraRig>;
