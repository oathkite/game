import { COLOR_HEX, type CellPoint, type TankColors } from "@game/protocol";
import { applyOps, createMask, type TerrainMask } from "@game/sim";
import { blastCells } from "@/game/weaponArt";
import type { DemoFrame, Field } from "./weaponDemo";

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
export const terrainOf = (field: Field, frame: DemoFrame): TerrainMask => {
  const base = createMask(field.cols, field.rows);
  base.cells.fill(1, field.ground * field.cols);
  return applyOps(
    base,
    frame.craters.map((c) => ({ cx: Math.floor(c.x), cy: Math.floor(c.y), radius: c.radius })),
  );
};

/** 弾が占めるセル。中心 (x, y) の w × h の矩形に中心が入るセル。小さな弾でも中心のセルは塗る */
export const bulletCells = (b: CellPoint & { readonly w: number; readonly h: number }): readonly CellPoint[] => {
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
