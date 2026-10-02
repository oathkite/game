import type { WeaponId } from "@game/protocol";
import { PALETTE, type Ramp } from "./palette";
import { composeLayers, createGrid, opaqueBounds, rotateGrid, setPixel, type Edges, type PixelGrid } from "./pixelGrid";

// 弾の絵。設計書 40.8 と 10.5。右向きの材質のパターンを進む向きの 16 方向で描き直し、輪郭と上下の縁の陰影を付ける。
// 座標は弾の中心（画素の角）を原点とする art px。発射者の主色を帯や輪に残す。
// テレポートの手番は標準砲の物理で撃つが、絵だけをロケットにする（設計書 42.3）。

/** 弾の絵の種類。武器のほかにテレポートのロケットがある */
export type ProjectileArt = WeaponId | "teleport";

const M = {
  team: 1, body: 2, nose: 3, stripe: 4, core: 5, glow: 6, glowEdge: 7, glowLight: 8, bomb: 9, shine: 10, fuse: 11, sparkA: 12, sparkB: 13, sparkC: 14, flame: 15,
} as const;

const LEGEND: Readonly<Record<string, number>> = {
  t: M.team, b: M.body, n: M.nose, k: M.stripe, c: M.core, e: M.glow, E: M.glowEdge, l: M.glowLight, d: M.bomb, s: M.shine, f: M.fuse, F: M.flame,
};

type Pattern = { readonly rows: readonly string[]; readonly left: number; readonly top: number; readonly outline: boolean };

const PATTERNS: Readonly<Record<ProjectileArt, Pattern>> = {
  cannon: { left: -3, top: -2, outline: true, rows: [".ttbb.", "tttbbn", "tttbbn", ".ttbb."] },
  triple: { left: -2, top: -1, outline: true, rows: ["ttbn", "ttbn"] },
  multiple: { left: -2, top: -2, outline: true, rows: [".tt.", "tsbt", "tbbt", ".tt."] },
  drill: { left: -4, top: -2, outline: true, rows: [".ttbkb..", "tttbkbnn", "tttbkbnn", ".ttbkb.."] },
  laser: { left: -5, top: -1, outline: false, rows: ["EEeelccccc", "EEeelccccc"] },
  digger: { left: -3, top: -4, outline: true, rows: [".dddd.", "dsdddd", "dddddd", "tttttt", "dddddd", ".dddd."] },
  floater: { left: -5, top: -3, outline: true, rows: ["...eeee...", "..leeeeE..", "..eeeeeE..", "tttttttttt", "..EeeeEE..", "...EEEE..."] },
  stinger: { left: -5, top: -1, outline: true, rows: ["ttbbbbbbbn"] },
  // 主色の尾翼と先端、金属の胴に白い窓、尾に炎
  teleport: { left: -6, top: -2, outline: true, rows: [".tt........", "Ftbbbbbbtt.", "Fbbbbsbbttt", "Ftbbbbbbtt.", ".tt........"] },
};

/** 向きで描き直す武器。マルチ弾、掘削弾、浮遊弾は丸いので向きで変えない */
export const PROJECTILE_ROTATES: Readonly<Record<ProjectileArt, boolean>> = {
  cannon: true, triple: true, multiple: false, drill: true, laser: true, digger: false, floater: false, stinger: true, teleport: true,
};

/** 画面の角度（ラジアン、右が 0、y は下向き）を 22.5 度ごとの 16 方向に丸める */
export const directionBucket = (angle: number): number => ((Math.round(angle / (Math.PI / 8)) % 16) + 16) % 16;

const patternGrid = (weapon: ProjectileArt, frame: number): PixelGrid => {
  const p = PATTERNS[weapon];
  const width = Math.max(...p.rows.map(r => r.length));
  const extra = weapon === "digger" ? 3 : 0, tail = weapon === "teleport" ? 1 : 0;
  const grid = createGrid(p.left - tail, p.top - extra, width + tail, p.rows.length + extra);
  p.rows.forEach((row, y) => [...row].forEach((ch, x) => { const m = LEGEND[ch]; if (m !== undefined) setPixel(grid, p.left + x, p.top + y, m); }));
  if (weapon === "digger") {
    // 導火線と、コマで瞬く火花
    setPixel(grid, 0, p.top - 1, M.fuse);
    setPixel(grid, 1, p.top - 2, frame % 2 === 0 ? M.sparkA : M.sparkB);
    if (frame % 2 === 1) setPixel(grid, 2, p.top - 3, M.sparkC);
  }
  // ロケットの炎は、コマで尾の先に 1 px 伸びる
  if (weapon === "teleport" && frame % 2 === 1) setPixel(grid, p.left - 1, 0, M.sparkB);
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
    case M.flame: return edges.top || edges.bottom ? PALETTE.fire4 : PALETTE.fire2;
    default: return PALETTE.smoke2;
  }
};

const MAX_CACHE = 512;
const cache = new Map<string, PixelGrid>();

/** 弾の絵。angle は進む向き（ラジアン）、frame は掘削弾の火花とロケットの炎のコマ。同じ引数の絵は使い回す */
export const projectilePixels = (weapon: ProjectileArt, ramp: Ramp, angle: number, frame: number): PixelGrid => {
  const bucket = PROJECTILE_ROTATES[weapon] ? directionBucket(angle) : 0;
  const key = `${weapon}|${ramp.base}|${bucket}|${weapon === "digger" || weapon === "teleport" ? frame % 2 : 0}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const mask = rotateGrid(patternGrid(weapon, frame), -bucket * 22.5);
  const bounds = opaqueBounds(mask) ?? { left: 0, top: 0, width: 1, height: 1 };
  const grid = composeLayers([{ mask, outline: PATTERNS[weapon].outline ? PALETTE.outline : null, paint: painter(ramp) }],
    { left: bounds.left - 1, top: bounds.top - 1, width: bounds.width + 2, height: bounds.height + 2 });
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(key, grid);
  return grid;
};
