import type { ItemId, WeaponId } from "@game/protocol";
import { PALETTE, type Ramp } from "./palette";
import { composeLayers, createGrid, opaqueBounds, rotateGrid, setPixel, type Edges, type PixelGrid } from "./pixelGrid";

// 弾の絵。設計書 40.8 と 10.5。右向きの材質のパターンを進む向きの 16 方向で描き直し、輪郭と上下の縁の陰影を付ける。
// 座標は弾の中心（画素の角）を原点とする art px。発射者の主色を帯や輪に残す。
// テレポートの手番は標準砲の物理で撃つが、絵だけをロケットにする（設計書 42.3）。

/** 弾の絵の種類。武器のほかにテレポートのロケットがある */
export type ProjectileArt = WeaponId | "teleport";
/** 撃った武器とアイテムから弾の絵を決める。テレポートの手番は標準砲で撃つが、絵はロケット */
export const projectileArtOf = (weapon: WeaponId, item?: ItemId): ProjectileArt => (item === "teleport" ? "teleport" : weapon);

const M = {
  team: 1, body: 2, nose: 3, stripe: 4, core: 5, glow: 6, glowEdge: 7, glowLight: 8, bomb: 9, shine: 10, fuse: 11, sparkA: 12, sparkB: 13, sparkC: 14, fireHot: 15,
} as const;

const LEGEND: Readonly<Record<string, number>> = {
  t: M.team, b: M.body, n: M.nose, k: M.stripe, c: M.core, e: M.glow, E: M.glowEdge, l: M.glowLight, d: M.bomb, s: M.shine, f: M.fuse,
};

type Pattern = { readonly rows: readonly string[]; readonly left: number; readonly top: number; readonly outline: boolean };

const PATTERNS: Readonly<Record<ProjectileArt, Pattern>> = {
  cannon: { left: -3, top: -2, outline: true, rows: [".ttbb.", "tttbbn", "tttbbn", ".ttbb."] },
  triple: { left: -2, top: -1, outline: true, rows: ["ttbn", "ttbn"] },
  multiple: { left: -2, top: -2, outline: true, rows: [".tt.", "tsbt", "tbbt", ".tt."] },
  drill: { left: -4, top: -2, outline: true, rows: [".ttbkb..", "tttbkbnn", "tttbkbnn", ".ttbkb.."] },
  laser: { left: -5, top: -1, outline: false, rows: ["EEeelccccc", "EEeelccccc"] },
  digger: { left: -3, top: -4, outline: true, rows: [".dddd.", "dsdddd", "dddddd", "tttttt", "dddddd", ".dddd."] },
  // 主色の帯を巻いた丸いゴム球
  bouncer: { left: -3, top: -3, outline: true, rows: [".bbbb.", "bsbbbb", "tttttt", "tttttt", "bbbbbn", ".bnnn."] },
  stinger: { left: -5, top: -1, outline: true, rows: ["ttbbbbbbbn"] },
  // 中央でふくらむ金属の胴に、主色の丸い鼻と尾翼、縁どりのある丸窓、尾に暗いノズル。炎は ROCKET_FLAMES で別に描く
  teleport: { left: -7, top: -4, outline: true, rows: ["..tt...........", "..ttbbbbb......", ".ttbbbbbbbbt...", "ktbbbbkkbbbbtt.", "kbbbbkkskbbbtt.", "ktbbbbkkbbbbtt.", ".ttbbbbbbbbt...", "..ttbbbbb......", "..tt..........."] },
};

/** 向きで描き直す武器。マルチ弾、掘削弾、跳ね弾は丸いので向きで変えない */
export const PROJECTILE_ROTATES: Readonly<Record<ProjectileArt, boolean>> = {
  cannon: true, triple: true, multiple: false, drill: true, laser: true, digger: false, bouncer: false, stinger: true, teleport: true,
};

/** 画面の角度（ラジアン、右が 0、y は下向き）を 22.5 度ごとの 16 方向に丸める */
export const directionBucket = (angle: number): number => ((Math.round(angle / (Math.PI / 8)) % 16) + 16) % 16;

/** ロケットの炎のコマ。ノズルの上、中、下の段で、右端がノズルのすぐ後ろ。W は白い芯、Y は黄、O は橙、R は赤。. は火の切れ目 */
const ROCKET_FLAMES: readonly (readonly string[])[] = [
  ["RO", "ROYW", "RO"],
  ["RROO", "RROOYW", "RROO"],
  ["ROO", "R.ROYW", "ROO"],
];
const FLAME_LEGEND: Readonly<Record<string, number>> = { W: M.core, Y: M.fireHot, O: M.sparkA, R: M.sparkB };

/** ロケットの炎の格子。輪郭を付けずに胴の上へ重ね、光って見せる */
/** コマの番号。弾がマップの上や左にいると負になるので、0 以上に丸める */
const flameFrame = (frame: number): number => ((frame % ROCKET_FLAMES.length) + ROCKET_FLAMES.length) % ROCKET_FLAMES.length;

const flameGrid = (frame: number): PixelGrid => {
  const rows = ROCKET_FLAMES[flameFrame(frame)]!, nozzle = PATTERNS.teleport.left, length = Math.max(...rows.map(r => r.length));
  const grid = createGrid(nozzle - length, -1, length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, i) => { const m = FLAME_LEGEND[ch]; if (m !== undefined) setPixel(grid, nozzle - row.length + i, y - 1, m); }));
  return grid;
};

const patternGrid = (weapon: ProjectileArt, frame: number): PixelGrid => {
  const p = PATTERNS[weapon];
  const width = Math.max(...p.rows.map(r => r.length));
  const extra = weapon === "digger" ? 3 : 0;
  const grid = createGrid(p.left, p.top - extra, width, p.rows.length + extra);
  p.rows.forEach((row, y) => [...row].forEach((ch, x) => { const m = LEGEND[ch]; if (m !== undefined) setPixel(grid, p.left + x, p.top + y, m); }));
  if (weapon === "digger") {
    // 導火線と、コマで瞬く火花
    setPixel(grid, 0, p.top - 1, M.fuse);
    setPixel(grid, 1, p.top - 2, frame % 2 === 0 ? M.sparkA : M.sparkB);
    if (frame % 2 === 1) setPixel(grid, 2, p.top - 3, M.sparkC);
  }
  return grid;
};

const painter = (ramp: Ramp) => (m: number, edges: Edges): number => {
  switch (m) {
    case M.team: return edges.top ? ramp.light : edges.bottom ? ramp.shadow : ramp.base;
    case M.body: return edges.top ? PALETTE.metal0 : edges.bottom ? PALETTE.metal2 : PALETTE.metal1;
    case M.nose: return edges.bottom ? PALETTE.metal1 : PALETTE.metal0;
    case M.stripe: return PALETTE.metal3;
    case M.core: case M.shine: case M.sparkC: return PALETTE.white;
    case M.glow: return PALETTE.energy1;
    case M.glowEdge: return PALETTE.energy2;
    case M.glowLight: return PALETTE.energy0;
    case M.bomb: return edges.top ? PALETTE.metal2 : PALETTE.metal3;
    case M.fuse: return PALETTE.metal1;
    case M.sparkA: return PALETTE.fire2;
    case M.sparkB: return PALETTE.fire4;
    case M.fireHot: return PALETTE.fire1;
    default: return PALETTE.smoke2;
  }
};

const MAX_CACHE = 512;
const cache = new Map<string, PixelGrid>();

/** 弾の絵。angle は進む向き（ラジアン）、frame は掘削弾の火花とロケットの炎のコマ。同じ引数の絵は使い回す */
export const projectilePixels = (weapon: ProjectileArt, ramp: Ramp, angle: number, frame: number): PixelGrid => {
  const bucket = PROJECTILE_ROTATES[weapon] ? directionBucket(angle) : 0;
  const key = `${weapon}|${ramp.base}|${bucket}|${weapon === "digger" ? frame % 2 : weapon === "teleport" ? flameFrame(frame) : 0}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const paint = painter(ramp);
  const layers = [{ mask: rotateGrid(patternGrid(weapon, frame), -bucket * 22.5), outline: PATTERNS[weapon].outline ? PALETTE.outline : null, paint },
    ...(weapon === "teleport" ? [{ mask: rotateGrid(flameGrid(frame), -bucket * 22.5), outline: null, paint }] : [])];
  const boxes = layers.map(l => opaqueBounds(l.mask) ?? { left: 0, top: 0, width: 1, height: 1 });
  const left = Math.min(...boxes.map(b => b.left)), top = Math.min(...boxes.map(b => b.top));
  const right = Math.max(...boxes.map(b => b.left + b.width)), bottom = Math.max(...boxes.map(b => b.top + b.height));
  const grid = composeLayers(layers, { left: left - 1, top: top - 1, width: right - left + 2, height: bottom - top + 2 });
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(key, grid);
  return grid;
};
