import type { TerrainMask } from "@game/sim";
import { PALETTE } from "./palette";
import { ART_PER_CELL, setPixel, TRANSPARENT, type PixelGrid, type Rect } from "./pixelGrid";

// 地形の塗り分け。設計書 40.6。1 セルを 4 × 4 texel で塗り、地形 mask の中だけを塗るので、表示と当たり判定は一致する。
// 最初の地形（original）で地表だった面には草を生やし、削られて出てきた面は焦げた縁にする。
// 色は texel の座標とセルのハッシュだけで決まり、どの範囲を塗り直しても同じ絵になる。

/** 1 セルの texel。art px と同じ */
export const TEXELS = ART_PER_CELL;

export type TerrainTheme = "ridge" | "canyon" | "basin" | "islands";

type Palette = {
  /** 草の先端、光る葉、中、暗い、草の下の影 */
  readonly grass: readonly [number, number, number, number, number];
  /** 地表に近い順の土の 3 段と、最も暗い色 */
  readonly soil: readonly [number, number, number, number];
  /** 削れた口の縁 */
  readonly charred: number;
};

export const TERRAIN_THEMES: Readonly<Record<TerrainTheme, Palette>> = {
  ridge: { grass: [PALETTE.green, PALETTE.greenLight, PALETTE.greenMid, PALETTE.greenDark, PALETTE.greenDeep], soil: [PALETTE.loam0, PALETTE.loam1, PALETTE.loam2, PALETTE.loam3], charred: PALETTE.loam3 },
  canyon: { grass: [PALETTE.greenMid, PALETTE.green, PALETTE.greenDark, PALETTE.greenDeep, PALETTE.greenBlack], soil: [PALETTE.stone0, PALETTE.stone1, PALETTE.stone2, PALETTE.stone3], charred: PALETTE.smoke3 },
  basin: { grass: [PALETTE.green, PALETTE.greenLight, PALETTE.greenMid, PALETTE.greenDark, PALETTE.greenDeep], soil: [PALETTE.ochre0, PALETTE.ochre1, PALETTE.ochre2, PALETTE.loam3], charred: PALETTE.loam3 },
  islands: { grass: [PALETTE.green, PALETTE.greenLight, PALETTE.greenMid, PALETTE.greenDark, PALETTE.greenDeep], soil: [PALETTE.violet0, PALETTE.violet1, PALETTE.violet2, PALETTE.sky1], charred: PALETTE.sky1 },
};

export type TerrainContext = {
  readonly mask: TerrainMask;
  readonly original: TerrainMask;
  /** terrainDepth(original) */
  readonly depth: Uint8Array;
  readonly theme: TerrainTheme;
};

const DEPTH_MAX = 15;

const solid = (mask: TerrainMask, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.cells[y * mask.width + x] === 1;

/** 最初の地形で、真上の空気から何セル下か。空気のセルは 0、上限は 15。地中の色の深さに使う */
export const terrainDepth = (original: TerrainMask): Uint8Array => {
  const depth = new Uint8Array(original.width * original.height);
  for (let x = 0; x < original.width; x++) {
    let run = 0;
    for (let y = 0; y < original.height; y++) {
      const i = y * original.width + x;
      run = original.cells[i] === 1 ? run + 1 : 0;
      depth[i] = run === 0 ? 0 : Math.min(DEPTH_MAX, run - 1);
    }
  }
  return depth;
};

const hash = (x: number, y: number): number => {
  let value = Math.imul(x + 1, 374761393) ^ Math.imul(y + 7, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
};

/** セルの周りの様子。上下左右が今は空気か、最初は地面だったか（削れた口か）、草の生える地表か */
type Cell = {
  readonly x: number; readonly y: number;
  readonly airUp: boolean; readonly airDown: boolean; readonly airLeft: boolean; readonly airRight: boolean;
  readonly cutUp: boolean; readonly cutDown: boolean; readonly cutLeft: boolean; readonly cutRight: boolean;
  readonly grass: boolean; readonly grassAbove: boolean; readonly depth: number; readonly hash: number;
};

/** 最初の地形で上が空気で、今も上が空気のセル。草が生える */
const isGrass = (c: TerrainContext, x: number, y: number): boolean =>
  solid(c.mask, x, y) && !solid(c.mask, x, y - 1) && !solid(c.original, x, y - 1);

const cellAt = (c: TerrainContext, x: number, y: number): Cell => {
  const air = (dx: number, dy: number) => !solid(c.mask, x + dx, y + dy);
  const cut = (dx: number, dy: number) => air(dx, dy) && solid(c.original, x + dx, y + dy);
  return {
    x, y, airUp: air(0, -1), airDown: air(0, 1), airLeft: air(-1, 0), airRight: air(1, 0),
    cutUp: cut(0, -1), cutDown: cut(0, 1), cutLeft: cut(-1, 0), cutRight: cut(1, 0),
    grass: isGrass(c, x, y), grassAbove: isGrass(c, x, y - 1), depth: c.depth[y * c.mask.width + x] ?? 0, hash: hash(x, y),
  };
};

/** 空気に面した縁の texel。削れた口は焦げた 2 texel、もとからの縁は横を明るく、下を暗くする。縁でなければ null */
const edgeColor = (cell: Cell, sx: number, sy: number, p: Palette): number | null => {
  if ((cell.cutUp && sy === 0) || (cell.cutDown && sy === 3) || (cell.cutLeft && sx === 0) || (cell.cutRight && sx === 3)) return p.charred;
  if ((cell.cutUp && sy === 1) || (cell.cutDown && sy === 2) || (cell.cutLeft && sx === 1) || (cell.cutRight && sx === 2)) return p.soil[2];
  if (cell.airDown && sy === 3) return p.soil[3];
  if (cell.airDown && sy === 2) return p.soil[2];
  if (!cell.grass && ((cell.airLeft && sx === 0) || (cell.airRight && sx === 3))) return p.soil[0];
  return null;
};

/** 草の texel。列ごとに 3〜5 texel の深さで、下端をぎざぎざにする。先端の行にところどころ花 */
const grassColor = (cell: Cell, tx: number, sy: number, p: Palette): number | null => {
  const d = cell.grass ? sy : cell.grassAbove ? TEXELS + sy : -1;
  if (d < 0) return null;
  const column = hash(tx, 0), depth = 3 + (column % 3);
  if (d >= depth) return null;
  if (d === 0) {
    if (column % 23 === 0) return [PALETTE.fire2, PALETTE.white, PALETTE.energy1][column % 3]!;
    return column % 4 === 0 ? p.grass[1] : p.grass[0];
  }
  if (d === depth - 1) return p.grass[4];
  return d === 1 ? p.grass[2] : p.grass[3];
};

/** 石橋の石積み。3 × 2 セルの石を半分ずらして積み、目地と上の縁の光、右下の影を付ける */
const masonryColor = (tx: number, ty: number, p: Palette): number => {
  const row = Math.floor(ty / 8), bx = (((tx + (row % 2) * 6) % 12) + 12) % 12, by = ty % 8;
  if (bx === 0 || by === 0) return p.soil[3];
  if (by === 1) return p.soil[0];
  if (bx === 11 || by === 7) return p.soil[2];
  return hash(tx, ty) % 13 === 0 ? p.soil[2] : p.soil[1];
};

/** 石と結晶。セルのハッシュで置く 2 × 2 の粒。左上を光、右下を影。無ければ null */
const specColor = (cell: Cell, sx: number, sy: number, theme: TerrainTheme): number | null => {
  const crystal = theme === "islands" && cell.depth >= 2 && cell.hash % 61 === 0;
  const stone = theme !== "canyon" && cell.depth >= 1 && cell.hash % 23 === 0;
  if (!crystal && !stone) return null;
  const ox = (cell.hash >>> 8) % 3, oy = (cell.hash >>> 12) % 3, dx = sx - ox, dy = sy - oy;
  if (dx < 0 || dy < 0 || dx > 1 || dy > 1) return null;
  const tones = crystal ? [PALETTE.energy0, PALETTE.energy1, PALETTE.energy2] : [PALETTE.stone0, PALETTE.stone1, PALETTE.stone2];
  return dx + dy === 0 ? tones[0]! : dx + dy === 1 ? tones[1]! : tones[2]!;
};

/**
 * 地中の土。最初の地表からの深さで、明るい表土、中の土、深い層に分け、境目を市松でつなぐ。
 * 深い層は暗い土に中の土の帯を不規則に挟み、一色に潰れないようにする。地層の線と段丘の畝を重ねる
 */
const soilColor = (cell: Cell, tx: number, ty: number, sy: number, p: Palette, theme: TerrainTheme): number => {
  const wave = Math.round(3 * Math.sin(tx / 23) + 2 * Math.sin(tx / 7));
  const dither = ((tx + ty) % 2) * 2 - 1;
  const depth = cell.depth * TEXELS + sy + wave + dither;
  // 深い層の帯は 11 texel ごとに区切り、明るい帯を 4 本に 1 本ほど、層のハッシュで不規則に置く
  const layer = Math.floor((ty + wave + dither) / 11);
  let tone = depth < 10 ? 0 : depth < 26 ? 1 : hash(layer, 3) % 4 === 0 ? 1 : 2;
  const seam = ((ty + wave) % 9 + 9) % 9 === 0;
  const furrow = theme === "basin" && cell.depth >= 1 && ty % 6 === 0;
  if (seam || furrow) tone = Math.min(2, tone + 1);
  return p.soil[tone]!;
};

const texelColor = (c: TerrainContext, cell: Cell, sx: number, sy: number): number => {
  const p = TERRAIN_THEMES[c.theme];
  const tx = cell.x * TEXELS + sx, ty = cell.y * TEXELS + sy;
  const grass = grassColor(cell, tx, sy, p);
  if (grass !== null && !(cell.cutLeft && sx === 0) && !(cell.cutRight && sx === 3)) return grass;
  const edge = edgeColor(cell, sx, sy, p);
  if (edge !== null) return edge;
  if (c.theme === "canyon" && cell.depth >= 1) return masonryColor(tx, ty, p);
  return specColor(cell, sx, sy, c.theme) ?? soilColor(cell, tx, ty, sy, p, c.theme);
};

/** target（texel の座標の格子）の範囲を塗る。空気のセルは透明にする */
export const paintTerrain = (c: TerrainContext, target: PixelGrid): void => {
  const x0 = Math.floor(target.left / TEXELS), y0 = Math.floor(target.top / TEXELS);
  const x1 = Math.ceil((target.left + target.width) / TEXELS), y1 = Math.ceil((target.top + target.height) / TEXELS);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const filled = solid(c.mask, x, y);
    const cell = filled ? cellAt(c, x, y) : null;
    for (let sy = 0; sy < TEXELS; sy++) for (let sx = 0; sx < TEXELS; sx++) {
      setPixel(target, x * TEXELS + sx, y * TEXELS + sy, cell ? texelColor(c, cell, sx, sy) : TRANSPARENT);
    }
  }
};

/** before と after で変わったセルを囲む矩形（セル）に margin セルの余白を足し、地形の範囲に収める。変わっていなければ null */
export const changedRect = (before: TerrainMask, after: TerrainMask, margin: number): Rect | null => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = 0; y < after.height; y++) for (let x = 0; x < after.width; x++) {
    const i = y * after.width + x;
    if (before.cells[i] === after.cells[i]) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (minX === Infinity) return null;
  const left = Math.max(0, minX - margin), top = Math.max(0, minY - margin);
  const right = Math.min(after.width, maxX + margin + 1), bottom = Math.min(after.height, maxY + margin + 1);
  return { left, top, width: right - left, height: bottom - top };
};
