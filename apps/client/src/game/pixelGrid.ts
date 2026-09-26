// 画素の格子。設計書 40.3。座標は art px（1/4 セル）で、原点は格子の外にあってもよい。
// 絵を回すときは Container を回さず、ここで画素ごとに描き直して格子に揃える。
// 格子は組み立てる関数の中でだけ書き換え、返した後は読むだけにする。

/** 透明の画素 */
export const TRANSPARENT = -1;

export type PixelGrid = {
  /** 左上の画素の art px 座標 */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** 色（0xRRGGBB）か、部品の中の材質の番号。TRANSPARENT は空 */
  readonly pixels: Int32Array;
};

export type Rect = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };

export const createGrid = (left: number, top: number, width: number, height: number): PixelGrid =>
  ({ left, top, width, height, pixels: new Int32Array(width * height).fill(TRANSPARENT) });

const indexOf = (grid: PixelGrid, x: number, y: number): number => {
  const col = x - grid.left, row = y - grid.top;
  return col < 0 || row < 0 || col >= grid.width || row >= grid.height ? -1 : row * grid.width + col;
};

export const getPixel = (grid: PixelGrid, x: number, y: number): number => {
  const i = indexOf(grid, x, y);
  return i < 0 ? TRANSPARENT : grid.pixels[i]!;
};

/** 格子の外は黙って捨てる */
export const setPixel = (grid: PixelGrid, x: number, y: number, value: number): void => {
  const i = indexOf(grid, x, y);
  if (i >= 0) grid.pixels[i] = value;
};

export const fillRect = (grid: PixelGrid, x: number, y: number, w: number, h: number, value: number): void => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPixel(grid, xx, yy, value);
};

const rotateCorners = (grid: PixelGrid, c: number, s: number): Rect => {
  const xs: number[] = [], ys: number[] = [];
  for (const [x, y] of [[grid.left, grid.top], [grid.left + grid.width, grid.top], [grid.left, grid.top + grid.height], [grid.left + grid.width, grid.top + grid.height]] as const) {
    xs.push(x * c + y * s);
    ys.push(-x * s + y * c);
  }
  const left = Math.floor(Math.min(...xs)), top = Math.floor(Math.min(...ys));
  return { left, top, width: Math.ceil(Math.max(...xs)) - left, height: Math.ceil(Math.max(...ys)) - top };
};

/**
 * 原点（画素の角）の周りに、画面で反時計回りに degrees 度回した格子。画素の中心から元の画素を引く最近傍で、角度によらず格子に揃う。
 * y が下向きなので、上向きの単位ベクトル (0, -1) は (−sin t, −cos t) に移る。`packages/sim` の muzzleOf と同じ向き
 */
export const rotateGrid = (grid: PixelGrid, degrees: number): PixelGrid => {
  if (degrees === 0) return grid;
  const rad = (degrees * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
  const bounds = rotateCorners(grid, c, s);
  const out = createGrid(bounds.left, bounds.top, bounds.width, bounds.height);
  for (let y = bounds.top; y < bounds.top + bounds.height; y++) for (let x = bounds.left; x < bounds.left + bounds.width; x++) {
    const cx = x + 0.5, cy = y + 0.5;
    const value = getPixel(grid, Math.floor(cx * c - cy * s), Math.floor(cx * s + cy * c));
    if (value !== TRANSPARENT) setPixel(out, x, y, value);
  }
  return out;
};

/** 原点の縦線で左右を入れ替える。x は −1 − x に移る */
export const mirrorGrid = (grid: PixelGrid): PixelGrid => {
  const out = createGrid(-(grid.left + grid.width), grid.top, grid.width, grid.height);
  for (let row = 0; row < grid.height; row++) for (let col = 0; col < grid.width; col++) {
    out.pixels[row * grid.width + (grid.width - 1 - col)] = grid.pixels[row * grid.width + col]!;
  }
  return out;
};

export type Edges = { readonly top: boolean; readonly bottom: boolean; readonly left: boolean; readonly right: boolean };

export type Layer = {
  /** 材質の番号の格子。TRANSPARENT は層の外 */
  readonly mask: PixelGrid;
  /** 層の外側 4 近傍に付ける輪郭の色。null なら付けない */
  readonly outline: number | null;
  /** 材質と、上下左右が層の外かどうかから色を決める。TRANSPARENT を返すと塗らない */
  readonly paint: (material: number, edges: Edges, x: number, y: number) => number;
};

const inMask = (mask: PixelGrid, x: number, y: number): boolean => getPixel(mask, x, y) !== TRANSPARENT;

const drawOutline = (out: PixelGrid, mask: PixelGrid, color: number): void => {
  for (let y = mask.top - 1; y <= mask.top + mask.height; y++) for (let x = mask.left - 1; x <= mask.left + mask.width; x++) {
    if (inMask(mask, x, y)) continue;
    if (inMask(mask, x, y - 1) || inMask(mask, x, y + 1) || inMask(mask, x - 1, y) || inMask(mask, x + 1, y)) setPixel(out, x, y, color);
  }
};

const drawFill = (out: PixelGrid, layer: Layer): void => {
  const { mask } = layer;
  for (let y = mask.top; y < mask.top + mask.height; y++) for (let x = mask.left; x < mask.left + mask.width; x++) {
    const material = getPixel(mask, x, y);
    if (material === TRANSPARENT) continue;
    const edges = { top: !inMask(mask, x, y - 1), bottom: !inMask(mask, x, y + 1), left: !inMask(mask, x - 1, y), right: !inMask(mask, x + 1, y) };
    const color = layer.paint(material, edges, x, y);
    if (color !== TRANSPARENT) setPixel(out, x, y, color);
  }
};

/** 下の層から順に、輪郭、塗りの順で重ねる。上の層の輪郭は下の層を塗り替えるので、部品の境目が 1 画素の線で見える */
export const composeLayers = (layers: readonly Layer[], bounds: Rect): PixelGrid => {
  const out = createGrid(bounds.left, bounds.top, bounds.width, bounds.height);
  for (const layer of layers) {
    if (layer.outline !== null) drawOutline(out, layer.mask, layer.outline);
    drawFill(out, layer);
  }
  return out;
};

/** 不透明な画素を囲む最小の矩形。空なら null */
export const opaqueBounds = (grid: PixelGrid): Rect | null => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let row = 0; row < grid.height; row++) for (let col = 0; col < grid.width; col++) {
    if (grid.pixels[row * grid.width + col] === TRANSPARENT) continue;
    minX = Math.min(minX, col); maxX = Math.max(maxX, col); minY = Math.min(minY, row); maxY = Math.max(maxY, row);
  }
  return minX === Infinity ? null : { left: grid.left + minX, top: grid.top + minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

/** canvas の ImageData に渡す RGBA。透明は alpha 0 */
export const toRgba = (grid: PixelGrid, out: Uint8ClampedArray = new Uint8ClampedArray(grid.width * grid.height * 4)): Uint8ClampedArray => {
  for (let i = 0; i < grid.pixels.length; i++) {
    const color = grid.pixels[i]!;
    const o = i * 4;
    if (color === TRANSPARENT) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; continue; }
    out[o] = Math.floor(color / 0x10000);
    out[o + 1] = Math.floor(color / 0x100) % 0x100;
    out[o + 2] = color % 0x100;
    out[o + 3] = 255;
  }
  return out;
};
