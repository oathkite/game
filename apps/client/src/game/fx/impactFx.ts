import type { TerrainOp } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { PALETTE, SMOKE_RAMP } from "../palette";
import { ART_PER_CELL } from "../pixelGrid";
import { hash32, unit } from "./hash";
import { allocBatch, type ParticleBatch } from "./particles";

// 着弾の層。設計書 41.6 の I1〜I4 と 41.7 の光。どれも閉じた式の粒のまとまりを返す純関数で、描くのは fxLayer。
// 位置は art px、爆心はセルの中心。散らし方はハッシュで決める（41.3）。

/** 用途の番号。ハッシュの入力を演出ごとに分ける */
const SPARK = 2, SMOKE = 3, GLOW = 4;

const artCenter = (cx: number, cy: number): { readonly x: number; readonly y: number } => ({ x: (cx + 0.5) * ART_PER_CELL, y: (cy + 0.5) * ART_PER_CELL });

/** 火花の段。白、淡い黄、黄、橙、赤 */
const SPARK_RAMP: readonly number[] = [PALETTE.white, PALETTE.fire1, PALETTE.fire2, PALETTE.fire3, PALETTE.fire5];
export const SPARK_PER_RADIUS = 4;
export const SPARK_LIMIT = 64;
export const SPARK_GRAVITY = 420;

/** I1 火花。爆風半径（セル）× 4 粒、上限 64。上へ寄せた全方向に飛び、炎の段で冷える */
export const impactSparks = (cx: number, cy: number, radius: number, seed: number, ramp: readonly number[] = SPARK_RAMP): ParticleBatch => {
  const count = Math.min(SPARK_LIMIT, Math.round(radius * SPARK_PER_RADIUS));
  const b = allocBatch(count, { ramps: [ramp], gravity: SPARK_GRAVITY, drag: 0 });
  const c = artCenter(cx, cy);
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, SPARK, i);
    // 上半分に 3/4、下半分に 1/4
    const angle = unit(hash32(h, 1)) < 0.75 ? -Math.PI * unit(hash32(h, 2)) : Math.PI * unit(hash32(h, 2));
    const speed = 150 + 180 * unit(hash32(h, 3));
    b.x0[i] = c.x; b.y0[i] = c.y;
    b.vx[i] = Math.cos(angle) * speed; b.vy[i] = Math.sin(angle) * speed;
    b.life[i] = 250 + 300 * unit(hash32(h, 4));
    b.size[i] = 1; b.fade[i] = unit(hash32(h, 5));
  }
  return b;
};

/** 煙の段。明るい灰から暗い灰へ。白に近い段は使わない */
const SMOKE_STEPS: readonly number[] = SMOKE_RAMP.slice(1);
export const SMOKE_PER_RADIUS = 2.5;
export const SMOKE_LIMIT = 40;

/** I2 煙。爆風半径 × 1.5 粒、上限 24。爆風の中から昇り、横へ少し広がって暗くなる。風では流さない（8.5） */
export const impactSmoke = (cx: number, cy: number, radius: number, seed: number): ParticleBatch => {
  const count = Math.min(SMOKE_LIMIT, Math.max(2, Math.round(radius * SMOKE_PER_RADIUS)));
  const b = allocBatch(count, { ramps: [SMOKE_STEPS], gravity: -12, drag: 0.9 });
  const c = artCenter(cx, cy), r = radius * ART_PER_CELL;
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, SMOKE, i);
    b.x0[i] = c.x + (unit(hash32(h, 1)) * 2 - 1) * r * 0.6;
    b.y0[i] = c.y - unit(hash32(h, 2)) * r * 0.5;
    b.vx[i] = (unit(hash32(h, 3)) * 2 - 1) * 14;
    b.vy[i] = -(20 + 20 * unit(hash32(h, 4)));
    b.t0[i] = 120 + 200 * unit(hash32(h, 5));
    b.life[i] = 1200 + 1200 * unit(hash32(h, 6));
    // 2 と 4 の 2 種類に揃える。大きさがばらばらだと格子から浮いて見えた（設計書 41.13）
    b.size[i] = unit(hash32(h, 7)) < 0.6 ? 2 : 4;
    b.fade[i] = unit(hash32(h, 8));
  }
  return b;
};

/** 赤熱の段。橙から暗い赤へ冷め、最後は地形の焦げた縁（40.6）が見える */
const GLOW_RAMP: readonly number[] = [PALETTE.fire2, PALETTE.fire3, PALETTE.fire4, PALETTE.fire5, PALETTE.fire6];
export const GLOW_MS = 2400;

const solid = (mask: TerrainMask, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.cells[y * mask.width + x] === 1;

const NEIGHBORS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 削れた後も残ったセルのうち、削れたセルに面した縁の texel（art px） */
const rimTexels = (before: TerrainMask, after: TerrainMask, op: TerrainOp): { x: number; y: number }[] => {
  const found: { x: number; y: number }[] = [], r = Math.ceil(op.radius) + 2;
  for (let y = op.cy - r; y <= op.cy + r; y++) for (let x = op.cx - r; x <= op.cx + r; x++) {
    if (!solid(after, x, y)) continue;
    for (const [dx, dy] of NEIGHBORS) {
      if (!solid(before, x + dx, y + dy) || solid(after, x + dx, y + dy)) continue;
      // 面した辺の 4 texel
      for (let k = 0; k < ART_PER_CELL; k++) {
        const tx = dx === 0 ? x * ART_PER_CELL + k : x * ART_PER_CELL + (dx > 0 ? ART_PER_CELL - 1 : 0);
        const ty = dy === 0 ? y * ART_PER_CELL + k : y * ART_PER_CELL + (dy > 0 ? ART_PER_CELL - 1 : 0);
        found.push({ x: tx, y: ty });
      }
    }
  }
  return found;
};

/** I3 赤熱する縁。削れた口の texel を炎の段から 2400 ms かけて冷ます。冷める速さを texel ごとに ±30% ずらす */
export const craterGlow = (before: TerrainMask, after: TerrainMask, op: TerrainOp, seed: number): ParticleBatch => {
  const texels = rimTexels(before, after, op);
  const b = allocBatch(texels.length, { ramps: [GLOW_RAMP], gravity: 0, drag: 0 });
  texels.forEach((t, i) => {
    const h = hash32(seed, GLOW, t.x, t.y);
    b.x0[i] = t.x; b.y0[i] = t.y;
    b.life[i] = GLOW_MS * (0.7 + 0.6 * unit(h));
    b.size[i] = 1; b.fade[i] = unit(hash32(h, 1));
  });
  return b;
};

/** 4 × 4 の Bayer の閾値（0〜15） */
export const BAYER4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;

export type LightSpec = {
  /** 光源の中心（セル） */
  readonly cx: number;
  readonly cy: number;
  /** 光の半径（art px） */
  readonly radius: number;
  /** 光が消えるまで（ms）。強さは 1 から 0 へ直線で弱まる */
  readonly duration: number;
  /** 最初の強さ（0〜1） */
  readonly strength: number;
  readonly inner: number;
  readonly outer: number;
};

/** 41.7 の光。強さ I = 0.5 × s(t) × (1 − d/R) が Bayer の閾値を超えるドットに光の色を置く。
 * s(t) が直線で弱まるので、ドットごとに消える時刻と内側の色から外側の色へ変わる時刻が決まり、閉じた式の粒で描ける。
 * 閾値は world の art px の座標で引くので、カメラが動いても模様が這わない */
export const lightBurst = (spec: LightSpec): ParticleBatch => {
  const c = artCenter(spec.cx, spec.cy), R = Math.max(1, spec.radius);
  const dots: { x: number; y: number; life: number; innerMs: number }[] = [];
  for (let y = Math.floor(c.y - R); y <= Math.ceil(c.y + R); y++) for (let x = Math.floor(c.x - R); x <= Math.ceil(c.x + R); x++) {
    const falloff = 0.5 * Math.max(0, 1 - Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) / R);
    const s0 = spec.strength * falloff, threshold = bayer(x, y);
    if (s0 <= threshold) continue;
    // s(t) = strength × (1 − t / duration) で、I(t) が閾値を下回る時刻と 0.25 を下回る時刻
    const life = spec.duration * (1 - threshold / s0);
    const innerMs = s0 > 0.25 ? spec.duration * (1 - 0.25 / s0) : 0;
    dots.push({ x, y, life, innerMs });
  }
  const b = allocBatch(dots.length, { ramps: [[spec.outer], [spec.inner, spec.outer]], gravity: 0, drag: 0 });
  dots.forEach((d, i) => {
    b.x0[i] = d.x; b.y0[i] = d.y; b.life[i] = d.life; b.size[i] = 1;
    b.ramp[i] = d.innerMs > 0 ? 1 : 0;
    b.step[i] = d.innerMs > 0 ? d.innerMs : 0;
    // 光は間引かずに閾値で消えるので、消え方の順番は使わない
    b.fade[i] = 0;
  });
  return b;
};

const MUZZLE = 5, DUST = 6, WRECK = 7;

/** 発射の煙の輪（設計書 41 の段階 4）。発射光の後に砲口の前へ 8 粒を輪に広げ、空気の抵抗で止めて 600 ms で消す。位置はセル、angle は弾が飛び出す向き */
export const muzzleSmoke = (x: number, y: number, angle: number, seed: number): ParticleBatch => {
  const count = 8, b = allocBatch(count, { ramps: [SMOKE_STEPS], gravity: -8, drag: 4 });
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, MUZZLE, i), ring = (i / count) * Math.PI * 2;
    b.x0[i] = x * ART_PER_CELL; b.y0[i] = y * ART_PER_CELL;
    b.vx[i] = Math.cos(angle) * 90 + Math.cos(ring) * 45;
    b.vy[i] = Math.sin(angle) * 90 + Math.sin(ring) * 45;
    b.t0[i] = 100; b.life[i] = 500 + 150 * unit(hash32(h, 1));
    b.size[i] = 2; b.fade[i] = unit(hash32(h, 2));
  }
  return b;
};

/** 走行の土煙。後ろの履帯の下から地形の色の 1 art px の粒を 2 粒、後ろ上へ跳ね上げて 300 ms で落とす。位置はセルで接地点 */
export const trackDust = (x: number, y: number, facing: 1 | -1, colors: readonly number[], seed: number): ParticleBatch => {
  const count = 2, b = allocBatch(count, { ramps: [colors], gravity: 260, drag: 0 });
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, DUST, i);
    b.x0[i] = (x + 0.5 - facing * 3.5) * ART_PER_CELL + i; b.y0[i] = y * ART_PER_CELL - 1;
    b.vx[i] = -facing * (10 + 25 * unit(hash32(h, 1)));
    b.vy[i] = -(25 + 25 * unit(hash32(h, 2)));
    b.life[i] = 280 + 120 * unit(hash32(h, 3));
    b.size[i] = 1; b.fade[i] = unit(hash32(h, 4));
  }
  return b;
};

/** 撃破の破片。機体の色の段と金属の段の 24 粒を上へ扇に散らし、重さで落とす。位置はセルで接地点 */
export const wreckDebris = (x: number, y: number, colors: readonly number[], seed: number): ParticleBatch => {
  const count = 24, b = allocBatch(count, { ramps: colors.map(c => [c]), gravity: 420, drag: 0 });
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, WRECK, i), angle = -Math.PI * (0.1 + 0.8 * unit(hash32(h, 1)));
    const speed = 80 + 150 * unit(hash32(h, 2));
    b.x0[i] = (x + 0.5) * ART_PER_CELL; b.y0[i] = (y - 2) * ART_PER_CELL;
    b.vx[i] = Math.cos(angle) * speed; b.vy[i] = Math.sin(angle) * speed;
    b.ramp[i] = i % colors.length;
    b.life[i] = 1200 + 400 * unit(hash32(h, 3));
    b.size[i] = unit(hash32(h, 4)) < 0.4 ? 2 : 1; b.fade[i] = unit(hash32(h, 5));
  }
  return b;
};
