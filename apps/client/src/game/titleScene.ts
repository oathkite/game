import { maskFromHeights } from "@game/sim";
import { PALETTE, TEAM_RAMPS } from "./palette";
import { ART_PER_CELL, createGrid, getPixel, setPixel, TRANSPARENT, type PixelGrid } from "./pixelGrid";
import { projectilePixels } from "./projectileSprite";
import { MOUNTAIN_PERIOD, paintMountains, paintSky, SKY_THEMES, skyStars } from "./skyPaint";
import { composeTank, type TankSpriteInput } from "./tankSprite";
import { paintTerrain, terrainDepth } from "./terrainPaint";

// タイトル画面の背景。設計書 40.10。対戦と同じ夜空、山並み、地形、機体を、画面の art px の 1 枚の絵に描く。
// 丘の上で 2 台の機体が向かい合い、左の機体の弾が弧を描いて飛んでいる場面にする。

/** src を (dx, dy) だけずらして out に重ねる。透明は飛ばす */
const overlay = (out: PixelGrid, src: PixelGrid, dx: number, dy: number): void => {
  for (let y = src.top; y < src.top + src.height; y++) for (let x = src.left; x < src.left + src.width; x++) {
    const color = getPixel(src, x, y);
    if (color !== TRANSPARENT) setPixel(out, x + dx, y + dy, color);
  }
};

/** 山並みを横に繰り返して置き、下は同じ色で塗りつぶす */
const placeMountains = (out: PixelGrid, layer: 0 | 1, top: number, height: number, shift: number): void => {
  const m = paintMountains("ridge", layer, height), fill = layer === 0 ? SKY_THEMES.ridge.far.fill : SKY_THEMES.ridge.near.fill;
  for (let x = 0; x < out.width; x++) {
    for (let y = 0; y < height; y++) {
      const color = getPixel(m, (x + shift) % MOUNTAIN_PERIOD, y);
      if (color !== TRANSPARENT) setPixel(out, x, top + y, color);
    }
    for (let y = top + height; y < out.height; y++) setPixel(out, x, y, fill);
  }
};

const tank = (hull: keyof typeof TEAM_RAMPS, turret: keyof typeof TEAM_RAMPS, facing: 1 | -1, elevation: number): TankSpriteInput => ({
  hull: TEAM_RAMPS[hull], turret: TEAM_RAMPS[turret], facing, tilt: 0, elevation, recoil: 0, sink: 0, treadPhase: 0,
  white: false, wrecked: false, rim: "none", flash: null, sparks: [],
});

/** 左の機体から右へ飛ぶ弾の弧。2 px おきの軌跡の点と、先頭の砲弾 */
const drawShot = (out: PixelGrid, from: { x: number; y: number }, to: { x: number; y: number }, lift: number): void => {
  const at = (t: number) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t - lift * 4 * t * (1 - t) });
  const head = 0.62;
  for (let i = 0; i < 40; i++) {
    const t = (i / 40) * head, p = at(t), color = head - t < 0.12 ? PALETTE.greenPale : PALETTE.greenMid;
    if (i % 2 === 0) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) setPixel(out, Math.round(p.x) + ox, Math.round(p.y) + oy, color);
  }
  const p = at(head), q = at(head + 0.01);
  overlay(out, projectilePixels("cannon", TEAM_RAMPS.red, Math.atan2(q.y - p.y, q.x - p.x), 0), Math.round(p.x), Math.round(p.y));
};

/** 横 width、縦 height（art px）の背景の絵 */
export const paintTitleScene = (width: number, height: number): PixelGrid => {
  const out = createGrid(0, 0, width, height);
  out.pixels.set(paintSky("ridge", width, height).pixels);
  for (const s of skyStars("ridge", width, height)) setPixel(out, s.x, s.y, s.color);
  placeMountains(out, 0, Math.round(height * 0.34), Math.round(height * 0.4), 37);
  placeMountains(out, 1, Math.round(height * 0.52), Math.round(height * 0.3), 211);
  const cols = Math.ceil(width / ART_PER_CELL), rows = Math.ceil(height / ART_PER_CELL);
  const left = Math.floor(cols * 0.26), right = Math.floor(cols * 0.74);
  const wavy = Array.from({ length: cols }, (_, x) => Math.round(rows * 0.74 + 2 * Math.sin(x / 5) + 1.5 * Math.sin(x / 2.3 + 1)));
  // 機体の幅（左右 4 セル）の地面は平らにならし、機体を浮かせない
  const ground = wavy.map((y, x) => (Math.abs(x - left) <= 4 ? wavy[left]! : Math.abs(x - right) <= 4 ? wavy[right]! : y));
  const mask = maskFromHeights(ground, rows);
  const terrain = createGrid(0, 0, width, height);
  paintTerrain({ mask, original: mask, depth: terrainDepth(mask), theme: "ridge" }, terrain);
  overlay(out, terrain, 0, 0);
  const leftTank = tank("red", "yellow", 1, 40), rightTank = tank("blue", "cyan", -1, 35);
  overlay(out, composeTank(leftTank), left * ART_PER_CELL + 2, ground[left]! * ART_PER_CELL);
  overlay(out, composeTank(rightTank), right * ART_PER_CELL + 2, ground[right]! * ART_PER_CELL);
  drawShot(out, { x: left * ART_PER_CELL + 14, y: ground[left]! * ART_PER_CELL - 26 }, { x: right * ART_PER_CELL, y: ground[right]! * ART_PER_CELL - 10 }, height * 0.28);
  return out;
};
