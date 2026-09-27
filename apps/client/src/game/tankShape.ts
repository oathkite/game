import { createGrid, fillRect, setPixel, TRANSPARENT, type PixelGrid } from "./pixelGrid";

// 機体の部品の形。設計書 40.5。右向き、傾き 0 の車体の座標（art px、原点は接地点）で、材質の番号を置く。
// 色はまだ決めない。回した後に tankSprite.ts が材質と縁から塗る。
// 横 32 × 縦 20 art px。履帯 6 行、車体 7 行、砲塔 6 行、ハッチ 1 行。車体（主色）を砲塔（副色）より大きくする。

export const MATERIAL = {
  linkA: 1, linkB: 2, treadInner: 3, wheelRim: 4, hubA: 5, hubB: 6,
  hullLight: 10, hullBase: 11, hullShadow: 12, skirt: 13, rivet: 14, lamp: 15, ember: 16,
  turretLight: 20, turretBase: 21, turretShadow: 22, turretDeep: 23, hatch: 24, shine: 25,
  antenna: 30, antennaTip: 31,
  barrelLight: 40, barrelShadow: 41, brakeLight: 42, brakeShadow: 43, rim: 44,
} as const;

/** 砲身の付け根。接地点から車体基準で真上 16 art px（BARREL_BASE_UP の 4 セル） */
export const BARREL_PIVOT_UP = 16;
/** 砲身の長さ（BARREL_LENGTH の 4 セル） */
export const BARREL_PX = 16;
/** 転輪の左端。幅 4 の転輪を 5 px おきに 5 つ */
const WHEEL_LEFT: readonly number[] = [-12, -7, -2, 3, 8];

/** 履帯の外形。行ごとの [左端, 右端の次]。上下の走りは両端を 2 px 落とし、丸く見せる */
const TREAD_ROWS: readonly (readonly [number, number, number])[] = [
  [-6, -13, 13], [-5, -14, 14], [-4, -15, 15], [-3, -15, 15], [-2, -14, 14], [-1, -13, 13],
];

const linkAt = (x: number, y: number, phase: number): number => {
  // 上の走りは進む向きへ、下の走りは逆へ送る。端の丸みは縦に交互
  if (y === -6) return ((x - phase) % 3 + 3) % 3 === 0 ? MATERIAL.linkA : MATERIAL.linkB;
  if (y === -1) return ((x + phase) % 3 + 3) % 3 === 0 ? MATERIAL.linkA : MATERIAL.linkB;
  return ((y + phase) % 2 + 2) % 2 === 0 ? MATERIAL.linkA : MATERIAL.linkB;
};

const drawWheel = (grid: PixelGrid, left: number, frame: number, broken: boolean): void => {
  for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
    const corner = (dx === 0 || dx === 3) && (dy === 0 || dy === 3);
    if (corner) continue;
    const hub = dx > 0 && dx < 3 && dy > 0 && dy < 3;
    const diagonal = (dx + dy) % 2 === (frame % 2 === 0 ? 0 : 1);
    const material = broken ? MATERIAL.treadInner : hub ? (diagonal ? MATERIAL.hubA : MATERIAL.hubB) : MATERIAL.wheelRim;
    setPixel(grid, left + dx, -5 + dy, material);
  }
};

/** 履帯と転輪。phase は進んだ距離（art px）、wheelFrame は転輪のスポークのコマ。壊れた履帯は 4 つに 1 つの輪を欠く */
export const treadMask = (phase: number, wheelFrame: number, wrecked: boolean): PixelGrid => {
  const grid = createGrid(-15, -6, 30, 6);
  for (const [y, from, to] of TREAD_ROWS) for (let x = from; x < to; x++) {
    const rim = y === -6 || y === -1 || x === from || x === to - 1;
    if (!rim) { setPixel(grid, x, y, MATERIAL.treadInner); continue; }
    const gap = wrecked && (y === -6 || y === -1) && ((x % 4) + 4) % 4 === 1;
    if (!gap) setPixel(grid, x, y, linkAt(x, y, phase));
  }
  WHEEL_LEFT.forEach((left, i) => drawWheel(grid, left, wheelFrame, wrecked && i === 2));
  return grid;
};

/** 車体の行。[y, 左端, 右端の次, 材質]。前（右）を急に、後ろをゆるく落とす */
const HULL_ROWS: readonly (readonly [number, number, number, number])[] = [
  [-13, -11, 8, MATERIAL.hullLight],
  [-12, -12, 10, MATERIAL.hullBase],
  [-11, -13, 12, MATERIAL.hullBase],
  [-10, -14, 13, MATERIAL.hullBase],
  [-9, -15, 14, MATERIAL.hullBase],
  [-8, -15, 15, MATERIAL.hullShadow],
  [-7, -15, 15, MATERIAL.skirt],
];

/** 車体。sink は手番の振動と着地の沈み込み（下へ art px）。残骸は装甲の欠けと熾火を持つ */
export const hullMask = (sink: number, wrecked: boolean): PixelGrid => {
  const grid = createGrid(-15, -13 + sink, 30, 7);
  for (const [y, from, to, material] of HULL_ROWS) fillRect(grid, from, y + sink, to - from, 1, material);
  // スカートの鋲は転輪の中心の上。前の角に前照灯、後ろに排気口の 3 つの溝
  for (const left of WHEEL_LEFT) setPixel(grid, left + 2, -7 + sink, MATERIAL.rivet);
  setPixel(grid, 11, -11 + sink, MATERIAL.lamp);
  setPixel(grid, 12, -10 + sink, MATERIAL.lamp);
  for (const x of [-12, -10, -8]) setPixel(grid, x, -11 + sink, MATERIAL.hullShadow);
  if (wrecked) {
    for (let x = 2; x < 6; x++) setPixel(grid, x, -13 + sink, TRANSPARENT);
    for (const [x, y] of [[-6, -10], [2, -12], [8, -9], [-11, -9]] as const) setPixel(grid, x, y + sink, MATERIAL.ember);
  }
  return grid;
};

/** 砲塔の行。[y, 左端, 右端の次, 材質] */
const TURRET_ROWS: readonly (readonly [number, number, number, number])[] = [
  [-20, -3, 1, MATERIAL.hatch],
  [-19, -5, 3, MATERIAL.turretLight],
  [-18, -6, 4, MATERIAL.turretBase],
  [-17, -7, 5, MATERIAL.turretBase],
  [-16, -7, 5, MATERIAL.turretBase],
  [-15, -8, 6, MATERIAL.turretShadow],
  [-14, -9, 7, MATERIAL.turretDeep],
];

/** 砲塔。付け根（0, −16）を含むドーム。残骸は前へ崩れて 3 px 沈み、ハッチを失う */
export const turretMask = (sink: number, wrecked: boolean): PixelGrid => {
  const dx = wrecked ? 1 : 0, dy = sink + (wrecked ? 3 : 0);
  const grid = createGrid(-9 + dx, -20 + dy, 16, 7);
  for (const [y, from, to, material] of TURRET_ROWS) {
    if (wrecked && material === MATERIAL.hatch) continue;
    fillRect(grid, from + dx, y + dy, to - from, 1, material);
  }
  if (!wrecked) for (const [x, y] of [[-4, -18], [-3, -18], [-5, -17]] as const) setPixel(grid, x, y + dy, MATERIAL.shine);
  return grid;
};

/** 砲塔の後ろに立つアンテナ。残骸には無い。sway は先端の横のずれ（art px）で、付け根から先へ 2 乗で曲げる（設計書 41 の段階 4） */
export const antennaMask = (sink: number, sway = 0): PixelGrid => {
  const reach = Math.abs(sway);
  const grid = createGrid(-6 - reach, -25 + sink, 1 + 2 * reach, 6);
  // 付け根（下）から先端（上）へ 6 行
  for (let k = 0; k < 6; k++) setPixel(grid, -6 + Math.round(sway * (k / 5) ** 2), -20 + sink - k, k === 5 ? MATERIAL.antennaTip : MATERIAL.antenna);
  return grid;
};
