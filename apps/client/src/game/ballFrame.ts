import { createGrid, fillRect, setPixel, type PixelGrid } from "./pixelGrid";
import { A, C, dots, E, F, mod, rows, wreckChips, type FrameParts } from "./frameDraw";
import { MATERIAL as M } from "./tankShape";

// 大玉のフレーム（設計書 43.6）。半径 8 の 1 つの球に乗る一輪車。
// 球の面が進んだ距離 ÷ 半径だけ回り、球の上半分を覆う泥よけと、中心の軸の蓋は回らない。
// 着地の沈み込みでは車体と泥よけだけが沈み、球と軸の蓋は地面に残る。

const R = 8;
const CY = -8;

/** 球。6 つの面のうち 2 つおきが主色の帯で、継ぎ目が回る。残骸は潰れて底が平たくなり、金属の面が割れる */
const sphere = (phase: number, drop: number, wrecked: boolean): PixelGrid => {
  const grid = createGrid(-9, -17, 18, 17);
  const angle = phase / R, cy = CY + drop;
  for (let y = -17; y < 0; y++) for (let x = -9; x < 9; x++) {
    const dx = x + 0.5, dy = y + 0.5 - cy;
    const d = Math.hypot(dx, wrecked && dy > 0 ? dy * 1.5 : dy);
    if (d > R) continue;
    const turn = (Math.atan2(dy, dx) - angle) / (2 * Math.PI) * 6;
    const lit = dx + dy < -2, rim = d > R - 1.2;
    if (Math.abs(mod(turn, 1) - 0.5) > 0.42 && d > 2) { setPixel(grid, x, y, M.metalDeep); continue; }
    const panel = mod(Math.floor(turn), 3);
    if (wrecked && panel === 1 && d > 5) { setPixel(grid, x, y, M.hole); continue; }
    if (panel === 0) setPixel(grid, x, y, rim ? E : lit ? A : C);
    else setPixel(grid, x, y, rim ? M.metalShadow : lit ? M.metalLight : M.metalBase);
  }
  return grid;
};

/** 球の上半分を覆う泥よけの弧。車体と一緒に沈み、着地でサスペンションが縮んで見える */
const guard = (dy: number): PixelGrid => {
  const grid = createGrid(-11, -12 + dy, 22, 12);
  for (let y = -12; y <= -4; y++) for (let x = -11; x < 11; x++) {
    const ox = x + 0.5, oy = y + 0.5 - CY, d = Math.hypot(ox, oy);
    if (d > R + 0.3 && d <= R + 2 && oy < -1.5) setPixel(grid, x, y + dy, y < -9 ? E : F);
  }
  return grid;
};

/** 球の中心の軸の蓋。回らず、車体と一緒には沈まない（軸は球と一緒に動く） */
const hub = (drop: number): PixelGrid => {
  const grid = createGrid(-3, -12 + drop, 6, 8);
  fillRect(grid, -2, -10 + drop, 4, 4, C);
  fillRect(grid, -1, -11 + drop, 2, 6, C);
  setPixel(grid, -1, -9 + drop, A);
  setPixel(grid, 0, -8 + drop, M.rivet);
  return grid;
};

const chassis = (dy: number, wrecked: boolean): PixelGrid => {
  const body = createGrid(-17, -14 + dy, 34, 8);
  rows(body, [[-13, -11, 9, A], [-12, -14, 12, C], [-11, -16, 14, C], [-10, -16, 15, E], [-9, -14, 13, F]], dy);
  // 前の灯、後ろの吸気口、鋲、後ろのバンパー
  dots(body, [[13, -11, M.lamp], [14, -10, M.lamp], [-13, -11, M.hole], [-12, -11, M.hole], [-6, -10, M.rivet], [5, -10, M.rivet]], dy);
  fillRect(body, -16, -9 + dy, 3, 1, M.metalShadow);
  if (wrecked) wreckChips(body, -13, dy);
  return body;
};

export const ballFrame = (phase: number, sink: number, wrecked: boolean): FrameParts => {
  const drop = wrecked ? 3 : 0, dy = sink + drop;
  return {
    under: [{ mask: sphere(phase, drop, wrecked), outline: true }],
    hull: chassis(dy, wrecked),
    over: [{ mask: guard(dy), outline: true }, { mask: hub(drop), outline: true }],
  };
};
