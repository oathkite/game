export type CameraSettings = { readonly speed: number; readonly inertiaMs: number };
export const DEFAULT_CAMERA_SETTINGS: CameraSettings = { speed: 2.8, inertiaMs: 1000 };
const KEY = "keropod.camera-prototype.v1";
const finite = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

export const normalizeCameraSettings = (value: unknown): CameraSettings => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_CAMERA_SETTINGS;
  const saved = value as Record<string, unknown>;
  return { speed: finite(saved.speed, DEFAULT_CAMERA_SETTINGS.speed, 0.25, 3), inertiaMs: finite(saved.inertiaMs, DEFAULT_CAMERA_SETTINGS.inertiaMs, 0, 1000) };
};
export const loadCameraSettings = (): CameraSettings => {
  try { return normalizeCameraSettings(JSON.parse(localStorage.getItem(KEY) ?? "null")); }
  catch { return DEFAULT_CAMERA_SETTINGS; }
};
export const saveCameraSettings = (settings: CameraSettings): void => {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); }
  catch { /* 保存できない環境でも、その場の調整は使える。 */ }
};
