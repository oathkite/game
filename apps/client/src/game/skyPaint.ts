import { PALETTE } from "./palette";
import { createGrid, setPixel, type PixelGrid } from "./pixelGrid";

// 背景の夜空、月、星、山並み。設計書 40.7。画面の art px（2 CSS px）で描き、当たり判定には含めない。
// 空の色の移り変わりはグラデーションを使わず、帯の境目を 2 色の市松でつなぐ。乱数は使わず、座標のハッシュで散らす。

export type SkyTheme = "ridge" | "canyon" | "basin" | "islands";

type Tone = { readonly fill: number; readonly rim: number };
type Moon = { readonly x: number; readonly y: number; readonly radius: number; readonly phase: number; readonly light: number; readonly shade: number };
type SkyStyle = {
  /** 上から 5 段の帯 */
  readonly bands: readonly number[];
  readonly far: Tone;
  readonly near: Tone;
  /** x は画面の幅に対する割合、y は art px。phase は影の円のずれ（半径に対する割合、0 なら満月） */
  readonly moon: Moon;
  /** ハッシュの格子の何マスに 1 つ星を置くか */
  readonly starEvery: number;
};

const moon = (x: number, y: number, radius: number, phase: number): Moon => ({ x, y, radius, phase, light: PALETTE.moon, shade: PALETTE.moonShade });

export const SKY_THEMES: Readonly<Record<SkyTheme, SkyStyle>> = {
  ridge: { bands: [PALETTE.sky0, PALETTE.sky1, PALETTE.sky2, PALETTE.sky3, PALETTE.sky4], far: { fill: PALETTE.sky3, rim: PALETTE.starFaint }, near: { fill: PALETTE.sky1, rim: PALETTE.sky4 }, moon: moon(0.78, 22, 9, 0), starEvery: 9 },
  canyon: { bands: [PALETTE.sky0, PALETTE.sky1, PALETTE.sky2, PALETTE.sky3, PALETTE.violet2], far: { fill: PALETTE.violet1, rim: PALETTE.violet0 }, near: { fill: PALETTE.sky1, rim: PALETTE.violet2 }, moon: moon(0.2, 18, 8, 0.6), starEvery: 10 },
  basin: { bands: [PALETTE.sky0, PALETTE.sky1, PALETTE.sky2, PALETTE.violet2, PALETTE.fire6], far: { fill: PALETTE.sky1, rim: PALETTE.fire6 }, near: { fill: PALETTE.sky0, rim: PALETTE.violet2 }, moon: moon(0.62, 34, 12, 0), starEvery: 12 },
  islands: { bands: [PALETTE.sky0, PALETTE.sky0, PALETTE.sky1, PALETTE.sky2, PALETTE.sky3], far: { fill: PALETTE.violet2, rim: PALETTE.violet0 }, near: { fill: PALETTE.sky0, rim: PALETTE.violet1 }, moon: moon(0.36, 16, 6, 0.35), starEvery: 6 },
};

const hash = (x: number, y: number): number => {
  let value = Math.imul(x + 11, 374761393) ^ Math.imul(y + 3, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
};

/** 帯の境目（画面の高さに対する割合）と、境目の上に市松で混ぜる行数 */
const BAND_EDGES: readonly number[] = [0.22, 0.42, 0.6, 0.78];
const DITHER_ROWS = 2;

const bandColor = (bands: readonly number[], x: number, y: number, height: number): number => {
  const edges = BAND_EDGES.map(e => Math.round(e * height));
  let band = edges.findIndex(edge => y < edge);
  if (band < 0) band = bands.length - 1;
  const edge = edges[band];
  const mix = edge !== undefined && y >= edge - DITHER_ROWS && (x + y) % 2 === 0;
  return bands[Math.min(bands.length - 1, band + (mix ? 1 : 0))]!;
};

/** 月の画素。影の円に入る画素は塗らず、欠けて見せる。縁の影と 2 つのクレーター。月でなければ null */
const moonColor = (m: Moon, cx: number, cy: number, x: number, y: number): number | null => {
  const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = m.radius;
  if (dx * dx + dy * dy > r * r) return null;
  const sx = dx + m.phase * r * 1.4;
  if (m.phase > 0 && sx * sx + dy * dy < r * r) return null;
  const crater = (ox: number, oy: number, cr: number) => (dx - ox * r) ** 2 + (dy - oy * r) ** 2 <= cr * cr;
  if (crater(-0.3, -0.25, r * 0.22) || crater(0.25, 0.3, r * 0.16)) return m.shade;
  return (dx + 0.35 * r) ** 2 + (dy + 0.35 * r) ** 2 > (r * 1.05) ** 2 ? m.shade : m.light;
};

/** 画面の大きさ（art px）の夜空。帯と月を描く。星は skyStars で別に描く */
export const paintSky = (theme: SkyTheme, width: number, height: number): PixelGrid => {
  const style = SKY_THEMES[theme], grid = createGrid(0, 0, width, height);
  const cx = Math.round(style.moon.x * width), cy = style.moon.y;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    setPixel(grid, x, y, moonColor(style.moon, cx, cy, x, y) ?? bandColor(style.bands, x, y, height));
  }
  return grid;
};

export type Star = { readonly x: number; readonly y: number; readonly color: number; readonly twinkle: boolean; readonly index: number };

const STAR_CELL = 8;

/** 画面の上 7 割に、ハッシュの格子で星を置く。月の上には置かない。4 つに 1 つを白、瞬く星は 5 つに 1 つ */
export const skyStars = (theme: SkyTheme, width: number, height: number): readonly Star[] => {
  const style = SKY_THEMES[theme], stars: Star[] = [];
  const cx = style.moon.x * width, cy = style.moon.y, clear = style.moon.radius + 3;
  for (let gy = 0; gy < Math.floor((height * 0.72) / STAR_CELL); gy++) for (let gx = 0; gx < Math.ceil(width / STAR_CELL); gx++) {
    const h = hash(gx, gy + style.starEvery * 97);
    if (h % style.starEvery !== 0) continue;
    const x = gx * STAR_CELL + ((h >>> 5) % STAR_CELL), y = gy * STAR_CELL + ((h >>> 9) % STAR_CELL);
    if (x >= width || (x - cx) ** 2 + (y - cy) ** 2 < clear * clear) continue;
    const color = (h >>> 13) % 4 === 0 ? PALETTE.white : (h >>> 15) % 2 === 0 ? PALETTE.starDim : PALETTE.starFaint;
    stars.push({ x, y, color, twinkle: (h >>> 17) % 5 === 0, index: stars.length });
  }
  return stars;
};

/** 瞬く星が明るいか。400〜1200 ms の周期のうち 4 分の 1 だけ暗くなる。動きを減らす設定では明るいまま */
export const twinkleOn = (index: number, elapsedMs: number, reduced: boolean): boolean => {
  if (reduced) return true;
  const period = 400 + (hash(index, 9) % 5) * 200, offset = hash(index, 21) % period;
  return (Math.max(0, elapsedMs) + offset) % period >= period / 4;
};

/** 山並みの繰り返しの幅（art px）。この幅で横に並べても継ぎ目が出ないよう、形は整数の周波数の正弦で作る */
export const MOUNTAIN_PERIOD = 512;

const wave = (x: number, k: number, shift: number): number => Math.sin((2 * Math.PI * k * x) / MOUNTAIN_PERIOD + shift);
const wrap = (x: number, period: number): number => ((x % period) + period) % period;

/** 稜線の尖った峰。3 つの周波数を重ね、2 px の段に揃える */
const ridgeTop = (x: number, height: number, layer: 0 | 1): number => {
  const shift = layer * 1.7;
  return Math.round(height * (0.45 + 0.22 * wave(x, 2, shift) + 0.1 * wave(x, 7, shift) + 0.05 * wave(x, 13, shift)) / 2) * 2;
};

/** 段丘の丘。6 px の段に揃えて棚田のように見せる */
const basinTop = (x: number, height: number, layer: 0 | 1): number => {
  const y = height * (0.5 + 0.18 * wave(x, 2, layer * 1.3) + 0.08 * wave(x, 5, layer * 1.3));
  return Math.round(y / 6) * 6;
};

/** 台地。平らな頂と低い地面の 2 段を、崖が 1 列に 2 行ずつ下がるように削る */
const mesaTop = (x: number, height: number, level: number, shift: number): number => {
  const raw = (at: number) => (wave(at, 3, shift) + 0.35 * wave(at, 7, shift) > 0.15 ? height * (level - 0.24) : height * level);
  let top = Infinity;
  for (let dx = -12; dx <= 12; dx++) top = Math.min(top, raw(wrap(x + dx, MOUNTAIN_PERIOD)) + 2 * Math.abs(dx));
  return Math.round(top);
};

/** 石橋の遠くの水道橋。64 px ごとの橋脚、橋桁、半円に近いアーチ、点線の手すり */
const aqueduct = (x: number, y: number, height: number): boolean => {
  const deckTop = Math.round(height * 0.34), deckBottom = deckTop + 4, local = wrap(x, 64);
  if (y === deckTop - 1) return local % 4 < 2;
  if (y < deckTop) return false;
  if (y < deckBottom || local < 10) return true;
  const t = (local - 37) / 27;
  return y < deckBottom + Math.round(9 * (1 - Math.sqrt(Math.max(0, 1 - t * t))));
};

/** 浮島。128 px ごとに 1 つ、平らな頂から下へ尖る岩 */
const island = (x: number, y: number, height: number, layer: 0 | 1): boolean => {
  const slot = Math.floor(x / 128), local = x - slot * 128, h = hash(slot, layer + 40);
  const half = (30 + (h % 34)) / 2, t = (local - 64) / half;
  if (Math.abs(t) > 1) return false;
  const top = Math.round(height * (0.2 + ((h >>> 6) % 45) / 100) + t * t * 2);
  return y >= top && y < top + 4 + Math.round((1 - Math.abs(t) ** 1.5) * (14 + (h % 10)));
};

/** 列 x、行 y が山並みの中か。0 は遠景、1 は中景 */
const inside = (theme: SkyTheme, layer: 0 | 1, x: number, y: number, height: number): boolean => {
  if (y < 0 || y >= height) return false;
  if (theme === "canyon") return layer === 0 ? aqueduct(x, y, height) || y >= mesaTop(x, height, 0.72, 1.7) : y >= mesaTop(x, height, 0.55, 0);
  if (theme === "islands") return island(x, y, height, layer);
  if (theme === "basin") return y >= basinTop(x, height, layer);
  return y >= ridgeTop(x, height, layer);
};

/** 横 MOUNTAIN_PERIOD、縦 height の山並みの繰り返しの絵。上の縁を月明かりの線にする */
export const paintMountains = (theme: SkyTheme, layer: 0 | 1, height: number): PixelGrid => {
  const style = SKY_THEMES[theme], tone = layer === 0 ? style.far : style.near;
  const grid = createGrid(0, 0, MOUNTAIN_PERIOD, height);
  for (let x = 0; x < MOUNTAIN_PERIOD; x++) {
    let above = false;
    for (let y = 0; y < height; y++) {
      const solid = inside(theme, layer, x, y, height);
      if (solid) setPixel(grid, x, y, above ? tone.fill : tone.rim);
      above = solid;
    }
  }
  return grid;
};
