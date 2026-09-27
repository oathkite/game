import { PALETTE } from "./palette";
import { composeLayers, createGrid, fillRect, opaqueBounds, type Edges, type PixelGrid } from "./pixelGrid";

// 題名のドット文字。設計書 40.10。5 × 7 のグリフを 1 画素 2 × 2 の太さで描き、
// 右下へ 2 px の押し出し（暗い緑）と 1 px の輪郭を付け、字の面を上から明るい緑、緑、中の緑の 3 段に塗る。

export const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
};

const DOT = 2;
/** 1 文字の送り（art px）。5 画素 × 2 と 2 px の字間 */
const ADVANCE = 5 * DOT + 2;
const SPACE = 6;
const DEPTH = 2;
const FACE = 1, EXTRUDE = 2;

const faceMask = (text: string): PixelGrid => {
  const width = [...text].reduce((w, ch) => w + (GLYPHS[ch] ? ADVANCE : SPACE), 0);
  const grid = createGrid(0, 0, Math.max(1, width), 7 * DOT);
  let x = 0;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) { x += SPACE; continue; }
    glyph.forEach((row, gy) => [...row].forEach((cell, gx) => { if (cell === "#") fillRect(grid, x + gx * DOT, gy * DOT, DOT, DOT, FACE); }));
    x += ADVANCE;
  }
  return grid;
};

/** 字の面を右下へ DEPTH px ずらして重ねた押し出し */
const extrudeMask = (face: PixelGrid): PixelGrid => {
  const grid = createGrid(face.left, face.top, face.width + DEPTH, face.height + DEPTH);
  for (let d = 1; d <= DEPTH; d++) for (let y = 0; y < face.height; y++) for (let x = 0; x < face.width; x++) {
    if (face.pixels[y * face.width + x] !== -1) fillRect(grid, x + d, y + d, 1, 1, EXTRUDE);
  }
  return grid;
};

const paint = (m: number, _edges: Edges, _x: number, y: number): number => {
  if (m === EXTRUDE) return PALETTE.greenDeep;
  return y < 4 ? PALETTE.greenLight : y < 10 ? PALETTE.green : PALETTE.greenMid;
};

/** 題名の絵。GLYPHS に無い文字は空白にする */
export const logoPixels = (text: string): PixelGrid => {
  const face = faceMask(text), extrude = extrudeMask(face);
  const out = composeLayers([{ mask: extrude, outline: PALETTE.outline, paint }, { mask: face, outline: null, paint }],
    { left: -1, top: -1, width: face.width + DEPTH + 2, height: face.height + DEPTH + 2 });
  return opaqueBounds(out) ? out : createGrid(0, 0, 1, 1);
};
