import { PALETTE } from "./palette";
import { composeLayers, createGrid, fillRect, type PixelGrid } from "./pixelGrid";

// ダメージ数字のドット文字。設計書 41 の評価と改善（1 回目）。5 × 7 のグリフを 1 画素 dot × dot で描き、1 px の暗い輪郭を付ける。
// これまでの DotGothic16 の Text は拡大しない層で滑らかに描かれ、格子に乗らなかった。

export const DIGITS: Readonly<Record<string, readonly string[]>> = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  "-": [".....", ".....", ".....", "####.", ".....", ".....", "....."],
};

const FACE = 1;

/** 文字列の面。dot は 1 画素の大きさ（px）、字間は dot */
const faceOf = (text: string, dot: number): PixelGrid => {
  const glyphs = [...text].map(ch => DIGITS[ch]).filter((g): g is readonly string[] => g !== undefined);
  const width = Math.max(1, glyphs.length * 6 * dot - dot);
  const grid = createGrid(0, 0, width, 7 * dot);
  glyphs.forEach((glyph, i) => glyph.forEach((row, gy) => [...row].forEach((cell, gx) => {
    if (cell === "#") fillRect(grid, i * 6 * dot + gx * dot, gy * dot, dot, dot, FACE);
  })));
  return grid;
};

/** 数字の絵（px の格子）。面の色 color、外側に 1 px の輪郭。数字と「-」以外は描かない */
export const damagePixels = (text: string, dot: number, color: number): PixelGrid => {
  const face = faceOf(text, dot);
  return composeLayers([{ mask: face, outline: PALETTE.outline, paint: () => color }], { left: -1, top: -1, width: face.width + 2, height: face.height + 2 });
};
