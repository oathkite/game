import type { TerrainOp } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { PALETTE } from "../palette";
import { ART_PER_CELL } from "../pixelGrid";
import { hash32, unit } from "./hash";
import { BAYER4 } from "./impactFx";
import { allocBatch, type ParticleBatch } from "./particles";

// 余韻と地形への光。設計書 41 の評価と改善（1 回目）。
// クレーターの底の小さな炎と昇る火の粉、撃破した機体の黒煙の柱、爆発が地形の表面を照らす光。どれも閉じた式の粒。

const FLAME = 12, EMBER = 13, COLUMN = 14, GLOW = 15;

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

/** 炎の舌。粒を 1 art px ずつ上へ重ね、上の粒ほど寿命を短くして、舌の先から冷まして消す。
 * 舌は幅 1〜2 art px、高さはその 2〜3 倍になる（評価の 3 回目で、炎の床が塊に見えた） */
const TONGUE: readonly number[] = [1, 0.8, 0.6];

/** 小さな炎と昇る火の粉。炎は 48 本/秒の舌を 2.5 秒、火の粉は 6 粒をゆっくり昇らせる */
export const craterFlames = (after: TerrainMask, op: TerrainOp, seed: number): ParticleBatch => {
  const floor = craterFloor(after, op, seed);
  const flamePer = Math.round((FLAME_RATE * FLAME_MS) / 1000), per = flamePer * TONGUE.length + EMBERS_PER_FLAME;
  // 炎の舌は細く（2 art px の芯から 1 art px へ）、淡い黄は芯の最初の段だけ。大きさの表はまとまりで共有するので、火の粉も生まれた直後だけ太い
  const b = allocBatch(floor.length * per, { ramps: [[PALETTE.fire1, PALETTE.fire2, PALETTE.fire3, PALETTE.fire5], [PALETTE.fire2, PALETTE.fire3, PALETTE.fire5, PALETTE.fire5]], gravity: -30, drag: 0, sizes: [2, 1, 1, 1] });
  floor.forEach((f, k) => {
    const x = (f.x + 0.5) * ART_PER_CELL, y = f.y * ART_PER_CELL - 1;
    for (let j = 0; j < flamePer; j++) {
      const h = hash32(seed, FLAME, k, j);
      // 炎は根元の幅いっぱいから中央へ寄りながら昇る
      const spread = (unit(hash32(h, 1)) * 2 - 1) * FLAME_HALF_WIDTH;
      const vx = -spread * 1.2 + (unit(hash32(h, 2)) * 2 - 1) * 4, vy = -(40 + 30 * unit(hash32(h, 3)));
      const at = j * (FLAME_MS / flamePer) + 20 * unit(hash32(h, 4));
      // 炎の最後の 1/3 は勢いを落とすため、生まれる間隔を広げずに寿命を縮める
      const life = (250 + 200 * unit(hash32(h, 5))) * (at > FLAME_MS * 0.66 ? 0.6 : 1);
      TONGUE.forEach((share, m) => {
        const i = k * per + j * TONGUE.length + m;
        b.x0[i] = x + spread; b.y0[i] = y - m;
        b.vx[i] = vx; b.vy[i] = vy;
        b.t0[i] = at; b.life[i] = life * share;
        b.ramp[i] = 0; b.size[i] = 1; b.fade[i] = unit(hash32(h, 7));
      });
    }
    for (let e = 0; e < EMBERS_PER_FLAME; e++) {
      const i = k * per + flamePer * TONGUE.length + e, h = hash32(seed, EMBER, k, e);
      b.x0[i] = x + (unit(hash32(h, 1)) * 2 - 1); b.y0[i] = y;
      b.vx[i] = (unit(hash32(h, 2)) * 2 - 1) * 12; b.vy[i] = -(15 + 15 * unit(hash32(h, 3)));
      b.t0[i] = (e + 0.5) * (FLAME_MS / EMBERS_PER_FLAME);
      b.life[i] = 1300 + 400 * unit(hash32(h, 5));
      b.ramp[i] = 1; b.size[i] = 1; b.fade[i] = unit(hash32(h, 7));
    }
  });
  return b;
};

/** 煙の柱の粒の数と、出し終えるまでの長さ（ms） */
export const WRECK_SMOKE_COUNT = 40;
const WRECK_SMOKE_MS = 3500;

/** 煙の柱の粒 i が、柱の始まりから生まれるまでの ms */
export const wreckSmokeBirth = (i: number): number => (i / WRECK_SMOKE_COUNT) * WRECK_SMOKE_MS;

/** 撃破した機体の煙の柱。3.5 秒かけて 40 粒を昇らせ、根元の中くらいの灰から上ほど明るく、4 → 6 → 8 art px と膨らませる。位置はセルで接地点。
 * from〜to の粒だけを作れる。残骸が落ちても根元が離れないよう、少しずつその時の残骸の位置から出すのに使う（評価の 4 回目） */
export const wreckSmokeColumn = (x: number, y: number, seed: number, from = 0, to = WRECK_SMOKE_COUNT): ParticleBatch => {
  // 根元を中くらいの灰にして、暗い木の帯に溶けずに残骸から切れ目なく出して見せる（評価の 3 回目）
  const first = Math.max(0, from), last = Math.min(WRECK_SMOKE_COUNT, to);
  const b = allocBatch(Math.max(0, last - first), { ramps: [[PALETTE.smoke2, PALETTE.smoke1, PALETTE.smoke1]], gravity: -6, drag: 0.4, sizes: [4, 6, 8] });
  for (let n = first; n < last; n++) {
    const i = n - first, h = hash32(seed, COLUMN, n);
    b.x0[i] = (x + 0.5) * ART_PER_CELL + (unit(hash32(h, 1)) * 2 - 1) * 3;
    b.y0[i] = (y - 2.5) * ART_PER_CELL;
    b.vx[i] = (unit(hash32(h, 2)) * 2 - 1) * 5;
    b.vy[i] = -(26 + 12 * unit(hash32(h, 3)));
    b.t0[i] = wreckSmokeBirth(n);
    b.life[i] = 1400 + 400 * unit(hash32(h, 4));
    b.size[i] = 4;
    b.fade[i] = unit(hash32(h, 6));
  }
  return b;
};

const bayer = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;

/** 地形の照り返しの濃さの段。爆風の縁から外へ、半径の 1/4、1/2、3/4 まで（3、6、9 セルを超えない）を 100、50、25% のドットで照らす。
 * 爆心からの距離の倍率で測ると、大きな爆風（掘削弾）では濃い段がクレーターの中に収まり、残る地表を照らさなかった（評価の 3 回目） */
const SURFACE_LEVELS: readonly { readonly share: number; readonly maxCells: number; readonly level: number }[] = [
  { share: 0.25, maxCells: 3, level: 1 },
  { share: 0.5, maxCells: 6, level: 0.5 },
  { share: 0.75, maxCells: 9, level: 0.25 },
];
/** 照り返しを 3 段で弱める 1 段の長さ（ms）。3 段で 450 ms */
export const SURFACE_STEP_MS = 150;

/** 爆風の縁から d − radius（art px）の外にある面の濃さ */
const levelAt = (d: number, radius: number): number =>
  SURFACE_LEVELS.find(s => d - radius < Math.min(radius * s.share, s.maxCells * ART_PER_CELL))?.level ?? 0;

/** 面の縁から数えた texel の深さ。0 が空気に接する texel */
type Depths = { readonly from: number; readonly to: number };
const RIM: Depths = { from: 0, to: 2 };

/** 空気に面した面のうち、上面と、爆心を向いた横と下の面の、depths の深さの texel（art px）と、その面の向き */
const litFaces = (mask: TerrainMask, x: number, y: number, depths: Depths): readonly { readonly tx: number; readonly ty: number; readonly nx: number; readonly ny: number }[] => {
  const faces: { tx: number; ty: number; nx: number; ny: number }[] = [];
  const add = (nx: number, ny: number): void => {
    for (let depth = depths.from; depth < depths.to; depth++) for (let k = 0; k < ART_PER_CELL; k++) {
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

type LitFace = { readonly tx: number; readonly ty: number; readonly d: number };

/** 光源 c（art px）から range（art px）までにある、上面と光源を向いた横と下の面の depths の深さの texel。skip のセルは除く */
const facesToward = (mask: TerrainMask, c: { readonly x: number; readonly y: number }, range: number, skip: (x: number, y: number) => boolean, depths: Depths = RIM): LitFace[] => {
  const cells = Math.ceil(range / ART_PER_CELL) + 1, cx = Math.floor(c.x / ART_PER_CELL), cy = Math.floor(c.y / ART_PER_CELL);
  const out: LitFace[] = [];
  for (let y = cy - cells; y <= cy + cells; y++) for (let x = cx - cells; x <= cx + cells; x++) {
    if (!solid(mask, x, y) || skip(x, y)) continue;
    for (const f of litFaces(mask, x, y, depths)) {
      const dx = c.x - (f.tx + 0.5), dy = c.y - (f.ty + 0.5), d = Math.hypot(dx, dy);
      // 上面はいつも、横と下の面は光源を向いているときだけ照らす
      if (d >= range || (f.ny !== -1 && (f.nx * dx + f.ny * dy) / Math.max(1, d) < 0.2)) continue;
      out.push({ tx: f.tx, ty: f.ty, d });
    }
  }
  return out;
};

/** 爆発が地形を照らす光。上面と爆心を向いた面の縁に、爆風の縁に近いほど濃い 3 段の Bayer のドットで光の色を置き、450 ms で 3 段に弱める。
 * 爆風の内側のセルは削れるので照らさない（削れた後に宙に光が残らないようにする）。
 * 位置はセル、radius は爆風半径（art px）。濃さ 50% 以上の段は内側の色 */
export const surfaceLight = (mask: TerrainMask, cx: number, cy: number, radius: number, inner: number, outer: number): ParticleBatch => {
  const c = { x: (cx + 0.5) * ART_PER_CELL, y: (cy + 0.5) * ART_PER_CELL }, R = Math.max(1, radius);
  const outermost = SURFACE_LEVELS[SURFACE_LEVELS.length - 1]!, carved = (R / ART_PER_CELL) ** 2;
  // 削る範囲は sim の carve と同じく、セルの中心の距離が半径以下
  const faces = facesToward(mask, c, R + Math.min(R * outermost.share, outermost.maxCells * ART_PER_CELL), (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= carved);
  const dots: { x: number; y: number; life: number; inner: boolean }[] = [];
  for (const f of faces) {
    const level = levelAt(f.d, R), threshold = bayer(f.tx, f.ty);
    // 強さ 1、2/3、1/3 の 3 段のうち、level × 強さが閾値を超える段の数だけ光る
    const steps = [1, 2 / 3, 1 / 3].filter(s => level * s > threshold).length;
    if (steps > 0) dots.push({ x: f.tx, y: f.ty, life: steps * SURFACE_STEP_MS, inner: level >= 0.5 });
  }
  const b = allocBatch(dots.length, { ramps: [[outer], [inner]], gravity: 0, drag: 0 });
  dots.forEach((d, i) => {
    b.x0[i] = d.x; b.y0[i] = d.y; b.life[i] = d.life; b.size[i] = 1; b.fade[i] = 0;
    b.ramp[i] = d.inner ? 1 : 0;
  });
  return b;
};

/** 炎が照らす範囲の半径（セル）と、炎の根元での強さ。評価の 3 回目の「照り返しの仕組みを 25〜50% の強さで」に合わせる */
const FLAME_LIGHT_CELLS = 6;
const FLAME_LIGHT_STRENGTH = 0.5;
/** 炎の光の揺らぎの 1 コマ（ms）。コマごとに強さを 60〜100% で変える */
export const FLAME_FLICKER_MS = 120;

/** 炎が照らす土の深さ。縁の 1 texel は赤熱する縁（I3）と焦げた縁の色で塗られていて光が見えないので、その内側の 1〜3 texel を照らす（評価の 4 回目） */
const FLAME_LIT: Depths = { from: 1, to: 4 };

/** texel の上下左右のどれかが空気のセルにある（縁の texel）。段になった壁の角では、上面から 1 texel 内側でも横の面の縁になる */
const touchesAir = (mask: TerrainMask, tx: number, ty: number): boolean =>
  [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => !solid(mask, Math.floor((tx + dx!) / ART_PER_CELL), Math.floor((ty + dy!) / ART_PER_CELL)));

/** 炎がクレーターの床と壁を照らす光。炎を向いた面の内側の土に、炎に近いほど濃い Bayer のドットを置く。強い所は橙、弱い所は暗い橙。
 * 120 ms のコマごとに強さを揺らし、炎が燃える 2.5 秒で弱める。宙には光を置かない（評価の 3 回目） */
export const flameGlow = (after: TerrainMask, op: TerrainOp, seed: number): ParticleBatch => {
  const R = FLAME_LIGHT_CELLS * ART_PER_CELL, frames = Math.ceil(FLAME_MS / FLAME_FLICKER_MS);
  const dots: { x: number; y: number; t0: number; bright: boolean }[] = [];
  craterFloor(after, op, seed).forEach((f, k) => {
    const faces = facesToward(after, { x: (f.x + 0.5) * ART_PER_CELL, y: f.y * ART_PER_CELL - 2 }, R, () => false, FLAME_LIT).filter(face => !touchesAir(after, face.tx, face.ty));
    for (let n = 0; n < frames; n++) {
      const t0 = n * FLAME_FLICKER_MS, strength = FLAME_LIGHT_STRENGTH * (1 - t0 / FLAME_MS) * (0.6 + 0.4 * unit(hash32(seed, GLOW, k, n)));
      for (const face of faces) {
        const level = strength * (1 - face.d / R);
        if (level > bayer(face.tx, face.ty)) dots.push({ x: face.tx, y: face.ty, t0, bright: level > 0.25 });
      }
    }
  });
  const b = allocBatch(dots.length, { ramps: [[PALETTE.fire4], [PALETTE.fire3]], gravity: 0, drag: 0 });
  dots.forEach((d, i) => {
    b.x0[i] = d.x; b.y0[i] = d.y; b.t0[i] = d.t0; b.life[i] = FLAME_FLICKER_MS; b.size[i] = 1; b.ramp[i] = d.bright ? 1 : 0;
    // 光は間引かずにコマの終わりで消える
    b.fade[i] = 0;
  });
  return b;
};
