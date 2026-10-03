import { createGrid, fillRect, setPixel, type PixelGrid } from "./pixelGrid";
import { MATERIAL as M } from "./tankShape";

// フレームのスキン（設計書 43）を描く共通の道具。右向き、傾き 0、接地点が原点の art px。

/** 1 層。outline が false の層（噴射の光）は輪郭を付けない */
export type FrameLayer = { readonly mask: PixelGrid; readonly outline: boolean };
export type FrameParts = {
  /** 車体より奥（履帯、奥の脚、車輪） */
  readonly under: readonly FrameLayer[];
  /** 車体。手番の振動と着地の沈み込みで沈む */
  readonly hull: PixelGrid;
  /** 車体より手前（手前の脚、噴射の光） */
  readonly over: readonly FrameLayer[];
};

export type Point = { readonly x: number; readonly y: number };
export type Row = readonly [number, number, number, number];
export const mod = (n: number, m: number) => ((n % m) + m) % m;
export const A = M.hullLight, C = M.hullBase, E = M.hullShadow, F = M.skirt;

export const rows = (grid: PixelGrid, table: readonly Row[], dy = 0): void => {
  for (const [y, from, to, m] of table) fillRect(grid, from, y + dy, to - from, 1, m);
};
export const dots = (grid: PixelGrid, list: readonly (readonly [number, number, number])[], dy = 0): void => {
  for (const [x, y, m] of list) setPixel(grid, x, y + dy, m);
};
export const inPolygon = (pts: readonly Point[], x: number, y: number): boolean => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!, b = pts[j]!;
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};
export const stroke = (grid: PixelGrid, a: Point, b: Point, width: number, material: number): void => {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    fillRect(grid, Math.round(a.x + (b.x - a.x) * t - (width - 1) / 2), Math.round(a.y + (b.y - a.y) * t - (width - 1) / 2), width, width, material);
  }
};
export const wreckChips = (grid: PixelGrid, top: number, dy: number): void => {
  for (let x = 2; x < 6; x++) setPixel(grid, x, top + dy, -1);
  for (const [x, y] of [[-6, -10], [2, -12], [8, -9], [-11, -9]] as const) setPixel(grid, x, y + dy, M.ember);
};

/** 進んだ距離のぶん回る大きな車輪。r は半径。タイヤの溝とスポークが回転角で動く */
export const bigWheel = (grid: PixelGrid, cx: number, cy: number, r: number, phase: number, flat: boolean): void => {
  const angle = phase / r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const squash = flat && dy > 0 ? dy * 1.6 : dy;
    const d = Math.hypot(dx, squash);
    if (d > r) continue;
    const a = Math.atan2(dy, dx) + angle;
    if (d > r - 2) { setPixel(grid, x, y, mod(Math.floor((a / (2 * Math.PI)) * 12), 2) === 0 && d > r - 1 ? M.metalDeep : M.treadInner); continue; }
    if (d > r - 3) { setPixel(grid, x, y, dy < 0 ? M.metalLight : M.metalBase); continue; }
    if (d < 1.2) { setPixel(grid, x, y, M.metalDeep); continue; }
    const spoke = mod(a, Math.PI / 2) < 0.5;
    setPixel(grid, x, y, spoke ? M.metalLight : M.metalShadow);
  }
};

/** 石の車輪。回転で動くひびと、木の軸。flat なら割れて欠ける */
export const stoneWheel = (grid: PixelGrid, cx: number, cy: number, r: number, phase: number, broken: boolean): void => {
  const angle = phase / r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy);
    if (d > r) continue;
    const a = Math.atan2(dy, dx) + angle;
    if (broken && mod(a, 2 * Math.PI) < 1.1) continue;
    if (d < 1.3) { setPixel(grid, x, y, M.wood); continue; }
    // ひびは中心から外へ 3 本。回転角で回る
    const crack = d > 2 && d < r - 1 && [0, 2.1, 4.2].some(c => Math.abs(mod(a - c + Math.PI, 2 * Math.PI) - Math.PI) < 0.5 / d);
    if (crack) { setPixel(grid, x, y, M.stoneDeep); continue; }
    const lit = dx + dy < -r * 0.4;
    setPixel(grid, x, y, d > r - 1 ? (lit ? M.stone : M.stoneShadow) : lit ? M.stoneLight : M.stone);
  }
};
