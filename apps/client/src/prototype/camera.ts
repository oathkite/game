import type { Layout } from "@/game/scale";

export type Point = { readonly x: number; readonly y: number };
export type Viewport = { readonly width: number; readonly height: number; readonly scale: number };
export type Bounds = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

export const cameraLayout = (width: number, height: number): Layout => {
  const compact = height < 500 || width < 1000;
  return { cell: 9, mapWidth: width, mapHeight: Math.max(1, height - (compact ? 116 : 144)), panelWidth: 0, panelCell: 1 };
};
export const viewportOf = (layout: Layout): Viewport => ({ width: layout.mapWidth, height: layout.mapHeight, scale: layout.cell });
export const worldToScreen = (point: Point, center: Point, v: Viewport): Point => ({ x: (point.x - center.x) * v.scale + v.width / 2, y: (point.y - center.y) * v.scale + v.height / 2 });
export const screenToWorld = (point: Point, center: Point, v: Viewport): Point => ({ x: (point.x - v.width / 2) / v.scale + center.x, y: (point.y - v.height / 2) / v.scale + center.y });
const clampAxis = (value: number, min: number, max: number, span: number): number => max - min <= span ? (min + max) / 2 : Math.max(min + span / 2, Math.min(max - span / 2, value));
export const clampCamera = (point: Point, v: Viewport, b: Bounds): Point => ({ x: clampAxis(point.x, b.left, b.right, v.width / v.scale), y: clampAxis(point.y, b.top, b.bottom, v.height / v.scale) });
export const panCamera = (center: Point, delta: Point, v: Viewport, b: Bounds): Point => clampCamera({ x: center.x - delta.x / v.scale, y: center.y - delta.y / v.scale }, v, b);
export const followCamera = (center: Point, actor: Point, v: Viewport, b: Bounds): Point => {
  const dx = actor.x - center.x, dy = actor.y - center.y;
  const halfW = v.width * 0.3 / v.scale, halfH = v.height * 0.3 / v.scale;
  return clampCamera({ x: center.x + Math.sign(dx) * Math.max(0, Math.abs(dx) - halfW), y: center.y + Math.sign(dy) * Math.max(0, Math.abs(dy) - halfH) }, v, b);
};
export const edgeVelocity = (point: Point, v: Viewport): Point => {
  if (point.x < 0 || point.y < 0 || point.x > v.width || point.y > v.height) return { x: 0, y: 0 };
  const axis = (p: number, size: number): number => p < 24 ? -(1 - p / 24) : p > size - 24 ? 1 - (size - p) / 24 : 0;
  const x = axis(point.x, v.width), y = axis(point.y, v.height), length = Math.max(1, Math.hypot(x, y));
  return { x: x * 480 / length, y: y * 480 / length };
};
