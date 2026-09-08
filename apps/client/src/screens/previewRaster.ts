import { COLOR_HEX, type CellPoint, type TankColors } from "@game/protocol";
import { applyOps, type TerrainMask } from "@game/sim";
import { blastCells } from "@/game/weaponArt";
import { groundMask, type DemoFrame, type Field } from "./weaponDemo";

// 設定画面のプレビューを 1 セル 1 ピクセルのラスターに描く。設計書 08 の 8.2、8.6。
// 対戦画面と同じく、地形は sim の carve でセル単位に削り、爆風は projectileView と同じセルの円、弾と破片はセルの正方形で描く。
// DOM を触らない純関数なので、TankPreview が ImageData に流し込み、最近傍で整数倍に拡大する。

export type Rgb = readonly [number, number, number];

/** #RRGGBB を RGB に分ける */
export const rgbOf = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

const WHITE: Rgb = [255, 255, 255];

/** 幅 7、高さ 5 の絵。1 が車体、2 が砲塔 */
const TANK_ROWS: readonly string[] = ["..222..", ".22222.", "1111111", "1111111", "1111111"];
/** 45 度の主砲。付け根（接地点の真上 4 セル）から右上へ 1 セルずつの階段 */
const BARREL_CELLS = 4;

type Painted = CellPoint & { readonly rgb: Rgb };

/** 戦車の絵と主砲のセル */
export const tankCells = (field: Field, colors: TankColors): readonly Painted[] => {
  const primary = rgbOf(COLOR_HEX[colors.primary]);
  const secondary = rgbOf(COLOR_HEX[colors.secondary]);
  const body = TANK_ROWS.flatMap((row, ry) =>
    [...row].flatMap((ch, rx) => (ch === "." ? [] : [{ x: field.tank.x + rx, y: field.tank.y + ry, rgb: ch === "1" ? primary : secondary }])),
  );
  const barrel = Array.from({ length: BARREL_CELLS }, (_, i) => ({ x: field.tank.x + 4 + i + 1, y: field.tank.y - i - 1, rgb: secondary }));
  return [...body, ...barrel];
};

/** 切れ端の地形。地面の行から下を埋め、削れた穴を sim と同じ規則で抜く */
export const terrainOf = (field: Field, frame: DemoFrame): TerrainMask =>
  applyOps(
    groundMask(field),
    frame.craters.map((c) => ({ cx: Math.floor(c.x), cy: Math.floor(c.y), radius: c.radius })),
  );

/** 進む向きに沿って描く弾の長さの下限（セル）。これより短い弾は向きを無視した矩形で足りる */
const LINE_MIN = 2;
/** 線分に沿って調べる刻み（セル）。セルを飛ばさない値 */
const LINE_STEP = 0.5;

type BulletBox = CellPoint & { readonly w: number; readonly h: number; readonly angle?: number };

/** 長い弾のセル。中心から前後に w / 2 だけ angle の向きへ伸びる線分が通るセル。矩形と同じく両端を半セル内側で見るので、水平なら長さ w でちょうど w 個になる。太さ 1 セル未満は 1 セルに切り上げる */
const lineCells = (b: BulletBox & { readonly angle: number }): readonly CellPoint[] => {
  const dx = Math.cos(b.angle);
  const dy = Math.sin(b.angle);
  const cells: CellPoint[] = [];
  const half = b.w / 2 - 0.5;
  for (let s = -half; s <= half; s += LINE_STEP) {
    const c = { x: Math.floor(b.x + dx * s), y: Math.floor(b.y + dy * s) };
    // 直線に沿って進むので、重なるのは直前のセルだけ
    const prev = cells[cells.length - 1];
    if (prev && prev.x === c.x && prev.y === c.y) continue;
    cells.push(c);
  }
  return cells;
};

/** 弾が占めるセル。中心 (x, y) の w × h の矩形に中心が入るセル。小さな弾でも中心のセルは塗る。向きのある長い弾は線分として塗る */
export const bulletCells = (b: BulletBox): readonly CellPoint[] => {
  if (b.angle !== undefined && b.w >= LINE_MIN) return lineCells({ ...b, angle: b.angle });
  const x0 = Math.floor(b.x - b.w / 2 + 0.5);
  const x1 = Math.floor(b.x + b.w / 2 - 0.5);
  const y0 = Math.floor(b.y - b.h / 2 + 0.5);
  const y1 = Math.floor(b.y + b.h / 2 - 0.5);
  const cells: CellPoint[] = [];
  for (let y = Math.min(y0, Math.floor(b.y)); y <= Math.max(y1, Math.floor(b.y)); y++) {
    for (let x = Math.min(x0, Math.floor(b.x)); x <= Math.max(x1, Math.floor(b.x)); x++) cells.push({ x, y });
  }
  return cells;
};

/** 主色で塗るセル。弾、爆風、破片の順（後が上に乗る） */
export const effectCells = (frame: DemoFrame): readonly CellPoint[] => [
  ...frame.bullets.flatMap(bulletCells),
  ...frame.blasts.flatMap((b) => blastCells(Math.floor(b.x), Math.floor(b.y), b.radius, b.ring)),
  ...frame.debris,
];

export type Raster = { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray };

/** 1 セル 1 ピクセルの RGBA。地は透明（黒地に載せる） */
export const rasterize = (field: Field, frame: DemoFrame, colors: TankColors): Raster => {
  const { cols: width, rows: height } = field;
  const data = new Uint8ClampedArray(width * height * 4);
  const put = (x: number, y: number, rgb: Rgb): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const o = (y * width + x) * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = 255;
  };
  const terrain = terrainOf(field, frame);
  terrain.cells.forEach((solid, i) => {
    if (solid === 1) put(i % width, Math.floor(i / width), WHITE);
  });
  for (const c of tankCells(field, colors)) put(c.x, c.y, c.rgb);
  const primary = rgbOf(COLOR_HEX[colors.primary]);
  for (const c of effectCells(frame)) put(c.x, c.y, primary);
  return { width, height, data };
};
