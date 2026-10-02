import { PALETTE } from "../palette";
import { ART_PER_CELL } from "../pixelGrid";
import { hash32, unit } from "./hash";
import { BAYER4 } from "./impactFx";
import { allocBatch, type ParticleBatch } from "./particles";
import { TELEPORT_ARRIVE_MS } from "../teleportMotion";

// テレポートの光の柱と粒（設計書 42.3）。時間の流れは teleportMotion.ts と揃え、弾が着地点に当たった瞬間を 0 とする。
// 柱は着弾の光（lightBurst）と同じく、1 art px の点を秩序だったディザで間引き、明るい点ほど長く残す。
// 位置の引数はセル（着地点の列と接地の行）、粒は art px。

/** 柱の形と時間。height はセル、halfWidth は art px、時間は ms */
export type BeamShape = {
  readonly height: number;
  readonly halfWidth: number;
  /** 柱の点が明るさに応じて残る長さ */
  readonly duration: number;
  /** 空から地面まで降りてくる長さ */
  readonly descend: number;
  /** 芯から縁まで太るのにかかる長さ */
  readonly widen: number;
  /** あれば、この時刻に柱を flareWidth（art px）まで一瞬太らせる。機体が現れる瞬間の閃き */
  readonly flareAt?: number;
  readonly flareWidth?: number;
};

/** 着地点の柱。画面の上の外から降りて、機体が現れる頃に太りきり、細りながら消える */
export const ARRIVE_BEAM: BeamShape = { height: 72, halfWidth: 9, duration: 900, descend: 110, widen: 170, flareAt: TELEPORT_ARRIVE_MS - 20, flareWidth: 16 };
/** 撃った位置の柱。低く細く、機体が消えるまでの短いもの */
export const DEPART_BEAM: BeamShape = { height: 32, halfWidth: 5, duration: 420, descend: 50, widen: 60 };

const CORE = [PALETTE.white, PALETTE.white, PALETTE.white, PALETTE.energy0, PALETTE.energy1];
const MID = [PALETTE.energy0, PALETTE.energy1, PALETTE.energy2];
const RIM = [PALETTE.energy1, PALETTE.energy2];
const SPARK = [PALETTE.white, PALETTE.energy0, PALETTE.energy0, PALETTE.energy1, PALETTE.energy2];

const bayer = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;
const MOTE = 22, RING = 23, BURST = 24, TWINKLE = 25;
/** 閃きの長さ（ms）。外側ほど短い */
const FLARE_MS = 160;

const baseOf = (cx: number, groundY: number) => ({ x: (cx + 0.5) * ART_PER_CELL, y: Math.round((groundY + 0.5) * ART_PER_CELL) });

/** 柱の帯。芯は白から冷め、内側は発光色、縁は発光色の薄い点を 3 回に分けて置き直して揺らめかせる */
const CORE_EDGE = 0.2, INNER_EDGE = 0.55, RIM_WAVES = 3, RIM_WAVE_MS = 110;

/** 1 点の明るさの残る割合。芯ほど長く、地面に近いほど早く消える（柱が空へ引き上げられて消える） */
const keep = (dx: number, v: number): number => (dx < CORE_EDGE ? 1 : dx < INNER_EDGE ? 0.62 : 0.38) * (0.5 + 0.5 * v ** 0.5);

/**
 * 光の柱。上の点ほど先に、外側の点ほど後に生まれ（空から降りて太る）、外側と地面に近い点から消える（細って空へ引き上げられる）。
 * 縁の点は短い寿命で RIM_WAVES 回置き直し、ディザの模様をずらして揺らめかせる
 */
export const teleportBeam = (cx: number, groundY: number, shape: BeamShape): ParticleBatch => {
  const c = baseOf(cx, groundY), H = shape.height * ART_PER_CELL, W = shape.halfWidth;
  const dots: { x: number; y: number; t0: number; life: number; ramp: number }[] = [];
  for (let y = c.y - H; y < c.y; y++) for (let x = Math.floor(c.x - W); x <= Math.ceil(c.x + W); x++) {
    const dx = Math.abs(x + 0.5 - c.x) / W;
    if (dx >= 1) continue;
    const v = (c.y - y) / H, fade = 1 - v * v, born = (1 - v) * shape.descend + dx * shape.widen;
    if (dx < INNER_EDGE) {
      const s0 = (dx < CORE_EDGE ? 1 : 0.75) * fade, threshold = bayer(x, y) * (dx < CORE_EDGE ? 0.3 : 1);
      if (s0 <= threshold) continue;
      dots.push({ x, y, t0: born, life: shape.duration * keep(dx, v) * (1 - threshold / s0), ramp: dx < CORE_EDGE ? 0 : 1 });
      continue;
    }
    for (let w = 0; w < RIM_WAVES; w++) {
      const s0 = 0.55 * (1 - dx) * 2 * fade, threshold = bayer(x + w * 2, y + w * 3);
      if (s0 <= threshold) continue;
      const window = shape.duration * keep(dx, v) / RIM_WAVES;
      dots.push({ x, y, t0: born + w * Math.max(RIM_WAVE_MS, window), life: window * (1 - threshold / s0), ramp: 2 });
    }
  }
  if (shape.flareAt !== undefined && shape.flareWidth) dots.push(...flareDots(c, H, shape.flareWidth, shape.flareAt));
  const b = allocBatch(dots.length, { ramps: [CORE, MID, RIM], gravity: 0, drag: 0 });
  dots.forEach((d, i) => {
    b.x0[i] = d.x; b.y0[i] = d.y; b.t0[i] = d.t0; b.life[i] = d.life; b.ramp[i] = d.ramp; b.size[i] = 1;
    // 光は閾値で消えるので、消え方の順番は使わない
    b.fade[i] = 0;
  });
  return b;
};

/** 柱の閃き。at の時刻に柱を W まで太らせ、外側から FLARE_MS で消す。地面に近いほど明るい */
const flareDots = (c: { readonly x: number; readonly y: number }, H: number, W: number, at: number) => {
  const dots: { x: number; y: number; t0: number; life: number; ramp: number }[] = [];
  for (let y = c.y - H; y < c.y; y++) for (let x = Math.floor(c.x - W); x <= Math.ceil(c.x + W); x++) {
    const dx = Math.abs(x + 0.5 - c.x) / W, v = (c.y - y) / H, s0 = (1 - dx) * (1 - v) ** 2, threshold = bayer(x + 1, y + 2);
    if (dx >= 1 || s0 <= threshold) continue;
    dots.push({ x, y, t0: at, life: FLARE_MS * (1 - threshold / s0), ramp: dx < 0.35 ? 0 : 1 });
  }
  return dots;
};

/** 機体の中心を横切る光の筋。at の時刻に現れ、端から縮んで消える。中心は 1 行、内側の 3 分の 1 は上下にも 1 行ずつ */
export const teleportStreak = (cx: number, groundY: number, at: number): ParticleBatch => {
  const c = baseOf(cx, groundY), L = 44, y = c.y - 6, dots: { x: number; y: number; life: number }[] = [];
  for (let dx = -L; dx <= L; dx++) {
    const f = 1 - Math.abs(dx) / L;
    dots.push({ x: Math.floor(c.x) + dx, y, life: 260 * f });
    if (f > 2 / 3) { dots.push({ x: Math.floor(c.x) + dx, y: y - 1, life: 160 * f }); dots.push({ x: Math.floor(c.x) + dx, y: y + 1, life: 160 * f }); }
  }
  const b = allocBatch(dots.length, { ramps: [[PALETTE.white, PALETTE.white, PALETTE.energy0]], gravity: 0, drag: 0 });
  dots.forEach((d, i) => { b.x0[i] = d.x; b.y0[i] = d.y; b.t0[i] = at; b.life[i] = d.life; b.size[i] = 1; b.fade[i] = 0; });
  return b;
};

/** 機体が現れる瞬間に広がって止まる光の輪。粒を円周に等間隔で並べ、空気の抵抗で半径 SHOCK_SPEED / SHOCK_DRAG で止める */
const SHOCK_SPEED = 220, SHOCK_DRAG = 6;
export const teleportShock = (cx: number, groundY: number, at: number): ParticleBatch => {
  const count = 48, c = baseOf(cx, groundY), b = allocBatch(count, { ramps: [[PALETTE.white, PALETTE.energy0, PALETTE.energy1, PALETTE.energy2]], gravity: 0, drag: SHOCK_DRAG });
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    b.x0[i] = c.x; b.y0[i] = c.y - 6;
    b.vx[i] = Math.cos(angle) * SHOCK_SPEED; b.vy[i] = Math.sin(angle) * SHOCK_SPEED * 0.6;
    b.t0[i] = at; b.life[i] = 380; b.size[i] = 2; b.fade[i] = 0;
  }
  return b;
};

/** 柱の根元の淡い光。柱の倍より広く、地面に近いほど濃いディザで置き、柱が太る頃から長めに残す */
export const teleportBloom = (cx: number, groundY: number, at: number): ParticleBatch => {
  const c = baseOf(cx, groundY), W = 24, H = 64, dots: { x: number; y: number; t0: number; life: number }[] = [];
  for (let y = c.y - H; y < c.y; y++) for (let x = Math.floor(c.x - W); x <= Math.ceil(c.x + W); x++) {
    const dx = Math.abs(x + 0.5 - c.x) / W, v = (c.y - y) / H, s0 = 0.7 * (1 - dx) * (1 - v) ** 2, threshold = bayer(x + 3, y + 1);
    if (dx >= 1 || s0 <= threshold) continue;
    dots.push({ x, y, t0: at + dx * 80, life: 820 * (1 - threshold / s0) });
  }
  const b = allocBatch(dots.length, { ramps: [[PALETTE.energy1, PALETTE.energy2]], gravity: 0, drag: 0 });
  dots.forEach((d, i) => { b.x0[i] = d.x; b.y0[i] = d.y; b.t0[i] = d.t0; b.life[i] = d.life; b.size[i] = 1; b.fade[i] = 0; });
  return b;
};

/** 柱のまわりで瞬く光の点。白か淡い発光色の点が、短い寿命でばらばらの時刻に灯る */
export const teleportTwinkles = (cx: number, groundY: number, seed: number, count: number, from: number, to: number): ParticleBatch => {
  const c = baseOf(cx, groundY), b = allocBatch(count, { ramps: [[PALETTE.white, PALETTE.energy0]], gravity: 0, drag: 0 });
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, TWINKLE, i), side = unit(hash32(h, 1)) * 2 - 1;
    b.x0[i] = Math.round(c.x + side * 30); b.y0[i] = Math.round(c.y - 4 - unit(hash32(h, 2)) * 120);
    b.t0[i] = from + unit(hash32(h, 3)) * (to - from); b.life[i] = 90 + unit(hash32(h, 4)) * 80;
    b.size[i] = unit(hash32(h, 5)) < 0.25 ? 2 : 1; b.fade[i] = 0;
  }
  return b;
};

/** 柱の中から立ちのぼる光の粒。delay ms 後から、柱の下半分の高さに散って生まれる */
export const teleportMotes = (cx: number, groundY: number, seed: number, count: number, shape: BeamShape, delay: number): ParticleBatch => {
  const c = baseOf(cx, groundY), b = allocBatch(count, { ramps: [SPARK], gravity: -30, drag: 0.4 });
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, MOTE, i);
    b.x0[i] = c.x + (unit(hash32(h, 1)) * 2 - 1) * shape.halfWidth * 0.8;
    b.y0[i] = c.y - unit(hash32(h, 2)) * shape.height * ART_PER_CELL * 0.5;
    b.vx[i] = (unit(hash32(h, 3)) * 2 - 1) * 6;
    b.vy[i] = -(40 + unit(hash32(h, 4)) * 90);
    b.t0[i] = delay + unit(hash32(h, 5)) * 600;
    b.life[i] = 600 + unit(hash32(h, 6)) * 600;
    b.size[i] = unit(hash32(h, 7)) < 0.5 ? 2 : 1;
    b.fade[i] = unit(hash32(h, 8));
  }
  return b;
};

/** 地面を左右へ走る光の輪。機体が現れる delay ms 後に、接地点から生まれる */
export const teleportRing = (cx: number, groundY: number, seed: number, delay: number): ParticleBatch => {
  const count = 36, c = baseOf(cx, groundY), b = allocBatch(count, { ramps: [SPARK], gravity: 0, drag: 3 });
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, RING, i), side = i % 2 === 0 ? 1 : -1;
    b.x0[i] = c.x; b.y0[i] = c.y - 1;
    b.vx[i] = side * (70 + unit(hash32(h, 1)) * 140);
    b.vy[i] = -unit(hash32(h, 2)) * 12;
    b.t0[i] = delay; b.life[i] = 450 + unit(hash32(h, 3)) * 250;
    b.size[i] = 2;
    b.fade[i] = unit(hash32(h, 5));
  }
  return b;
};

/** 機体が現れる瞬間に、機体の中心から四方へ散る火花 */
export const teleportBurst = (cx: number, groundY: number, seed: number, delay: number): ParticleBatch => {
  const count = 20, c = baseOf(cx, groundY), b = allocBatch(count, { ramps: [SPARK], gravity: 160, drag: 2 });
  for (let i = 0; i < count; i++) {
    const h = hash32(seed, BURST, i), angle = (i / count) * Math.PI * 2 + unit(hash32(h, 1)) * 0.3, speed = 50 + unit(hash32(h, 2)) * 100;
    b.x0[i] = c.x; b.y0[i] = c.y - 6;
    b.vx[i] = Math.cos(angle) * speed; b.vy[i] = Math.sin(angle) * speed;
    b.t0[i] = delay; b.life[i] = 300 + unit(hash32(h, 3)) * 250;
    b.size[i] = 1; b.fade[i] = unit(hash32(h, 4));
  }
  return b;
};
