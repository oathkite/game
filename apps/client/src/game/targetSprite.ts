import { TANK_RADIUS } from "@game/sim";
import { TARGET_HEIGHT } from "@/practice/rules";
import { PALETTE } from "./palette";
import { ART_PER_CELL, composeLayers, createGrid, setPixel, type Edges, type PixelGrid } from "./pixelGrid";

// 練習の的。設計書 40.8。的の中心（地面から TARGET_HEIGHT セル上）を原点とする art px。
// 赤と白の同心円を輪郭で囲み、木の柱で地面に立てる。円は当たりの半径（TANK_RADIUS）に収める。

const RADIUS = TANK_RADIUS * ART_PER_CELL - 1;
const POST = 1, DISC = 2;

const discColor = (d: number): number => {
  const ring = Math.floor((d / RADIUS) * 4);
  return ring % 2 === 0 ? PALETTE.fire4 : PALETTE.white;
};

let cached: PixelGrid | null = null;

export const targetPixels = (): PixelGrid => {
  if (cached) return cached;
  const bottom = TARGET_HEIGHT * ART_PER_CELL;
  const post = createGrid(-1, RADIUS - 1, 2, bottom - RADIUS);
  for (let y = RADIUS - 1; y < bottom - 1; y++) for (let x = -1; x < 1; x++) setPixel(post, x, y, POST);
  const disc = createGrid(-RADIUS, -RADIUS, RADIUS * 2, RADIUS * 2);
  for (let y = -RADIUS; y < RADIUS; y++) for (let x = -RADIUS; x < RADIUS; x++) if (Math.hypot(x + 0.5, y + 0.5) <= RADIUS) setPixel(disc, x, y, DISC);
  const paint = (m: number, edges: Edges, x: number, y: number): number => {
    if (m === POST) return edges.left ? PALETTE.loam0 : PALETTE.loam1;
    const d = Math.hypot(x + 0.5, y + 0.5);
    return edges.top && d > RADIUS - 2 ? PALETTE.fire1 : discColor(d);
  };
  cached = composeLayers([{ mask: post, outline: PALETTE.outline, paint }, { mask: disc, outline: PALETTE.outline, paint }],
    { left: -RADIUS - 1, top: -RADIUS - 1, width: RADIUS * 2 + 2, height: bottom + RADIUS + 1 });
  return cached;
};
