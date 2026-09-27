import type { TerrainOp } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { PALETTE } from "../palette";
import { ART_PER_CELL } from "../pixelGrid";
import { hash32, unit } from "./hash";
import { BAYER4 } from "./impactFx";
import { allocBatch, type ParticleBatch } from "./particles";

// 余韻と地形への光。設計書 41 の評価と改善（1 回目）。
// クレーターの底の小さな炎と昇る火の粉、撃破した機体の黒煙の柱、爆発が地形の表面を照らす光。どれも閉じた式の粒。

const FLAME = 12, EMBER = 13, COLUMN = 14;

/** クレーターの底の炎が燃える長さ（ms） */
export const FLAME_MS = 2500;
/** 炎 1 つが 1 秒に出す粒。評価の 2 回目で、粒にしか見えなかったので増やした */
const FLAME_RATE = 48;
/** 炎の幅の半分と、昇る速さ（art px、art px/秒） */
const FLAME_HALF_WIDTH = 6;
/** 炎 1 つが燃える間に出す火の粉 */
const EMBERS_PER_FLAME = 6;

const solid = (mask: TerrainMask, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.cells[y * mask.width + x] === 1;

/** クレーターの底の地表（セル）。爆心の左右の半径の半分の列で、削れた後にいちばん低い地表を 3 つまで、3 セル以上離して選ぶ */
export const craterFloor = (after: TerrainMask, op: TerrainOp, seed: number): { readonly x: number; readonly y: number }[] => {
  const half = Math.max(1, Math.floor(op.radius / 2)), columns: { x: number; y: number }[] = [];
  for (let x = op.cx - half; x <= op.cx + half; x++) {
    let y = Math.max(0, op.cy - op.radius);
    while (y < after.height && !solid(after, x, y)) y++;
    if (y < after.height && y <= op.cy + op.radius + 1) columns.push({ x, y });
  }
  columns.sort((a, b) => b.y - a.y || hash32(seed, a.x) - hash32(seed, b.x));
  const picked: { x: number; y: number }[] = [];
  for (const c of columns) if (picked.length < 3 && picked.every(p => Math.abs(p.x - c.x) >= 3)) picked.push(c);
  return picked;
};

/** 小さな炎と昇る火の粉。炎は 28 粒/秒を 2.5 秒、火の粉は 6 粒をゆっくり昇らせる */
export const craterFlames = (after: TerrainMask, op: TerrainOp, seed: number): ParticleBatch => {
  const floor = craterFloor(after, op, seed);
  const flamePer = Math.round((FLAME_RATE * FLAME_MS) / 1000), per = flamePer + EMBERS_PER_FLAME;
  // 炎の粒は根元で太く（3 art px）、昇って冷めるほど細くなる。大きさの表はまとまりで共有するので、火の粉も生まれた直後だけ太い
  const b = allocBatch(floor.length * per, { ramps: [[PALETTE.fire1, PALETTE.fire2, PALETTE.fire3, PALETTE.fire5], [PALETTE.fire1, PALETTE.fire3, PALETTE.fire5, PALETTE.fire5]], gravity: -30, drag: 0, sizes: [3, 2, 2, 1] });
  floor.forEach((f, k) => {
    const x = (f.x + 0.5) * ART_PER_CELL, y = f.y * ART_PER_CELL - 1;
    for (let j = 0; j < per; j++) {
      const i = k * per + j, ember = j >= flamePer, h = hash32(seed, ember ? EMBER : FLAME, k, j);
      // 炎は根元の幅いっぱいから中央へ寄りながら昇る
      const spread = (unit(hash32(h, 1)) * 2 - 1) * (ember ? 1 : FLAME_HALF_WIDTH);
      b.x0[i] = x + spread;
      b.y0[i] = y;
      b.vx[i] = ember ? (unit(hash32(h, 2)) * 2 - 1) * 12 : -spread * 1.2 + (unit(hash32(h, 2)) * 2 - 1) * 4;
      b.vy[i] = -(ember ? 15 + 15 * unit(hash32(h, 3)) : 40 + 30 * unit(hash32(h, 3)));
      // 炎の最後の 1/3 は勢いを落とすため、生まれる間隔を広げずに寿命を縮める
      const at = ember ? (j - flamePer + 0.5) * (FLAME_MS / EMBERS_PER_FLAME) : j * (FLAME_MS / flamePer) + 20 * unit(hash32(h, 4));
      b.t0[i] = at;
      b.life[i] = ember ? 1300 + 400 * unit(hash32(h, 5)) : (250 + 200 * unit(hash32(h, 5))) * (at > FLAME_MS * 0.66 ? 0.6 : 1);
      b.ramp[i] = ember ? 1 : 0;
      b.size[i] = 1;
      b.fade[i] = unit(hash32(h, 7));
    }
  });
  return b;
};

/** 撃破した機体の黒煙の柱。3.5 秒かけて 40 粒を昇らせ、根元の暗い灰から上ほど明るく、4 → 6 → 8 art px と膨らませる。位置はセルで接地点 */
export const wreckSmokeColumn = (x: number, y: number, seed: number): ParticleBatch => {
  const count = 40, b = allocBatch(count, { ramps: [[PALETTE.smoke3, PALETTE.smoke2, PALETTE.smoke1]], gravity: -6, drag: 0.4, sizes: [4, 6, 8] });
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, COLUMN, i);
    b.x0[i] = (x + 0.5) * ART_PER_CELL + (unit(hash32(h, 1)) * 2 - 1) * 3;
    b.y0[i] = (y - 4) * ART_PER_CELL;
    b.vx[i] = (unit(hash32(h, 2)) * 2 - 1) * 5;
    b.vy[i] = -(26 + 12 * unit(hash32(h, 3)));
    b.t0[i] = (i / count) * 3500;
    b.life[i] = 1400 + 400 * unit(hash32(h, 4));
    b.size[i] = 4;
    b.fade[i] = unit(hash32(h, 6));
  }
  return b;
};

const bayer = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;

/** 地形の照り返しの濃さの段。爆風半径の 0.6、1.2、1.8 倍までを 100、50、25% のドットで照らす（設計書 41.13 の評価の 2 回目） */
const SURFACE_LEVELS: readonly (readonly [number, number])[] = [[0.6, 1], [1.2, 0.5], [1.8, 0.25]];
/** 照り返しを 3 段で弱める 1 段の長さ（ms）。3 段で 450 ms */
export const SURFACE_STEP_MS = 150;

const levelAt = (d: number, radius: number): number => SURFACE_LEVELS.find(([scale]) => d < radius * scale)?.[1] ?? 0;

/** 空気に面した面のうち、上面と、爆心を向いた横と下の面の縁の 2 texel（art px）と、その面の向き */
const litFaces = (mask: TerrainMask, x: number, y: number): readonly { readonly tx: number; readonly ty: number; readonly nx: number; readonly ny: number }[] => {
  const faces: { tx: number; ty: number; nx: number; ny: number }[] = [];
  const add = (nx: number, ny: number): void => {
    for (let depth = 0; depth < 2; depth++) for (let k = 0; k < ART_PER_CELL; k++) {
      const tx = nx === 0 ? x * ART_PER_CELL + k : x * ART_PER_CELL + (nx > 0 ? ART_PER_CELL - 1 - depth : depth);
      const ty = ny === 0 ? y * ART_PER_CELL + k : y * ART_PER_CELL + (ny > 0 ? ART_PER_CELL - 1 - depth : depth);
      faces.push({ tx, ty, nx, ny });
    }
  };
  if (!solid(mask, x, y - 1)) add(0, -1);
  if (!solid(mask, x - 1, y)) add(-1, 0);
  if (!solid(mask, x + 1, y)) add(1, 0);
  if (!solid(mask, x, y + 1)) add(0, 1);
  return faces;
};

/** 爆発が地形を照らす光。上面と爆心を向いた面の縁に、中心ほど濃い 3 段の Bayer のドットで光の色を置き、450 ms で 3 段に弱める。
 * 位置はセル、radius は爆風半径（art px）。濃さ 50% 以上の段は内側の色 */
export const surfaceLight = (mask: TerrainMask, cx: number, cy: number, radius: number, inner: number, outer: number): ParticleBatch => {
  const c = { x: (cx + 0.5) * ART_PER_CELL, y: (cy + 0.5) * ART_PER_CELL }, R = Math.max(1, radius);
  const cells = Math.ceil((R * 1.8) / ART_PER_CELL) + 1;
  const dots: { x: number; y: number; life: number; inner: boolean }[] = [];
  for (let y = cy - cells; y <= cy + cells; y++) for (let x = cx - cells; x <= cx + cells; x++) {
    if (!solid(mask, x, y)) continue;
    for (const f of litFaces(mask, x, y)) {
      const dx = c.x - (f.tx + 0.5), dy = c.y - (f.ty + 0.5), d = Math.hypot(dx, dy);
      // 上面はいつも、横と下の面は爆心を向いているときだけ照らす
      if (f.ny !== -1 && (f.nx * dx + f.ny * dy) / Math.max(1, d) < 0.2) continue;
      const level = levelAt(d, R), threshold = bayer(f.tx, f.ty);
      // 強さ 1、2/3、1/3 の 3 段のうち、level × 強さが閾値を超える段の数だけ光る
      const steps = [1, 2 / 3, 1 / 3].filter(s => level * s > threshold).length;
      if (steps > 0) dots.push({ x: f.tx, y: f.ty, life: steps * SURFACE_STEP_MS, inner: level >= 0.5 });
    }
  }
  const b = allocBatch(dots.length, { ramps: [[outer], [inner]], gravity: 0, drag: 0 });
  dots.forEach((d, i) => {
    b.x0[i] = d.x; b.y0[i] = d.y; b.life[i] = d.life; b.size[i] = 1; b.fade[i] = 0;
    b.ramp[i] = d.inner ? 1 : 0;
  });
  return b;
};
