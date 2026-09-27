import type { TerrainOp } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { PALETTE } from "../palette";
import { ART_PER_CELL, getPixel, TRANSPARENT, type PixelGrid, type Rect } from "../pixelGrid";
import { hash32, unit } from "./hash";
import { allocBatch, allocBounce, type Bounce, type ParticleBatch } from "./particles";

// 削れた地形の破片。設計書 41.5 の D1。
// 削る前と後の mask で変わったセルの texel を、削る前の地形の色のまま爆心から外へ散らし、重さで画面の下へ落とす。
// 地形とは当たらない。見た目だけで、mask と当たり判定は変えない。

/** 破片が消えるまで（ms）。画面の下端を越えた粒はそれより前に描かなくなる */
export const DEBRIS_LIFE_MS = 2500;
/** 重力（art px/秒²） */
export const DEBRIS_GRAVITY = 420;
/** 爆風の縁の速さと、爆心で足す速さ（art px/秒） */
export const DEBRIS_EDGE_SPEED = 50;
export const DEBRIS_CORE_SPEED = 150;
/** 速さのばらつき（±） */
export const DEBRIS_SPREAD = 0.25;
/** 上向きに足す速さ（art px/秒） */
export const DEBRIS_LIFT = 100;
/** 熱で光らせる割合。爆風の内側のドットのうち、この割合を白から冷ます（設計書 41.13 の評価で 25% の半径の半分以内から改めた） */
export const DEBRIS_HEAT_SHARE = 0.35;
/** 熱の色の段を進める ms。淡い黄 80、黄 80、橙 160、赤 240 ms で元の色に戻る */
export const DEBRIS_HEAT_STEP_MS = 80;
/** 草の色の破片を残す割合。草は表層にしか無いのに、そのまま飛ばすと緑の紙吹雪に見えた */
export const DEBRIS_GRASS_KEEP = 0.4;
/** 生まれた高さまで戻ってから消えるまで（ms）。落ち切るまで描くと、地形の上がざらついて見えた */
export const DEBRIS_AFTER_RETURN_MS = 1000;
/** 地面で 1 回跳ねてから消える破片の割合（2026-09-27 のユーザーの案）。ほかの破片は地形の奥へ落ちていく */
export const DEBRIS_BOUNCE_SHARE = 0.4;
/** 跳ね返りで残る縦の速さと横の速さの割合 */
export const DEBRIS_RESTITUTION = 0.35;
export const DEBRIS_FRICTION = 0.5;
/** 跳ねてから消えるまでの上限（ms）。跳ねて落ちてきたところで消す */
export const DEBRIS_HOP_MAX_MS = 320;
/** 地面に着く時刻を探す刻み（ms） */
const LANDING_STEP_MS = 16;

/** 1 回の着弾で出す粒の上限。超えたら 2 × 2 art px の塊にまとめ、それでも超えたら間引く（TBD-40） */
export const DEBRIS_BUDGET = 16384;

/** 熱い粒の色の段の既定。淡い黄から始め、白は使わない（白い粒が多いと砂嵐に見えた） */
const HEAT: readonly number[] = [PALETTE.fire1, PALETTE.fire2, PALETTE.fire3, PALETTE.fire3, PALETTE.fire5, PALETTE.fire5, PALETTE.fire5];
const GRASS: ReadonlySet<number> = new Set([PALETTE.greenPale, PALETTE.greenLight, PALETTE.green, PALETTE.greenMid, PALETTE.greenDark, PALETTE.greenDeep, PALETTE.greenBlack]);

/** 用途の番号。ハッシュの入力を他の演出と分ける */
const PURPOSE = 1;

export type DebrisInput = {
  readonly before: TerrainMask;
  readonly after: TerrainMask;
  readonly op: TerrainOp;
  /** 削る前の地形を、rect（セル）の範囲だけ texel の格子に塗ったもの */
  readonly texels: (rect: Rect) => PixelGrid;
  readonly seed: number;
  readonly budget?: number;
  /** 速さと上向きの勢いの倍率。掘削弾で大きくする（設計書 41 の段階 5） */
  readonly power?: number;
  /** 熱い粒の色の段。省けば炎の色 */
  readonly heat?: readonly number[];
};

const solid = (mask: TerrainMask, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.cells[y * mask.width + x] === 1;

/** 削れたセルを囲む矩形（セル）。削れていなければ null */
const removedRect = (before: TerrainMask, after: TerrainMask, op: TerrainOp): Rect | null => {
  const r = Math.ceil(op.radius) + 1;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = op.cy - r; y <= op.cy + r; y++) for (let x = op.cx - r; x <= op.cx + r; x++) {
    if (!solid(before, x, y) || solid(after, x, y)) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return minX === Infinity ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

type Unit = { readonly x: number; readonly y: number; readonly color: number };

/** 削れた texel を size art px 四方の塊にして並べる。塊の色は左上の texel の色 */
const collectUnits = (input: DebrisInput, rect: Rect, size: number): Unit[] => {
  const grid = input.texels(rect), units: Unit[] = [];
  for (let cy = rect.top; cy < rect.top + rect.height; cy++) for (let cx = rect.left; cx < rect.left + rect.width; cx++) {
    if (!solid(input.before, cx, cy) || solid(input.after, cx, cy)) continue;
    for (let sy = 0; sy < ART_PER_CELL; sy += size) for (let sx = 0; sx < ART_PER_CELL; sx += size) {
      const x = cx * ART_PER_CELL + sx, y = cy * ART_PER_CELL + sy, color = getPixel(grid, x, y);
      if (color !== TRANSPARENT) units.push({ x, y, color });
    }
  }
  return units;
};

/** 塊の大きさと残す割合。上限に収まれば 1 texel ずつ、収まらなければ 2 × 2 にまとめ、それでも超えたら間引く */
const densityOf = (texelCount: number, budget: number): { readonly size: 1 | 2; readonly keep: number } => {
  if (texelCount <= budget) return { size: 1, keep: 1 };
  return { size: 2, keep: Math.min(1, budget / (texelCount / 4)) };
};

/** 削れた texel の数。セル 1 つで 16 texel */
const removedTexels = (before: TerrainMask, after: TerrainMask, rect: Rect): number => {
  let cells = 0;
  for (let y = rect.top; y < rect.top + rect.height; y++) for (let x = rect.left; x < rect.left + rect.width; x++) if (solid(before, x, y) && !solid(after, x, y)) cells++;
  return cells * ART_PER_CELL * ART_PER_CELL;
};

/** 色ごとの段の番号。熱い粒は熱の 3 段の後に元の色へ戻る */
const rampTable = (heat: readonly number[]) => {
  const ramps: (readonly number[])[] = [], index = new Map<string, number>();
  return {
    ramps,
    of: (color: number, heated: boolean): number => {
      const key = `${heated ? "h" : "c"}${color}`, found = index.get(key);
      if (found !== undefined) return found;
      ramps.push(heated ? [...heat, color] : [color]);
      index.set(key, ramps.length - 1);
      return ramps.length - 1;
    },
  };
};

/** 削れた後の地形に、落ちてくる途中で初めて入る時刻と、その直前の位置と速さ。入らなければ null */
const landingOf = (after: TerrainMask, x0: number, y0: number, vx: number, vy: number, life: number) => {
  let px = x0, py = y0;
  for (let t = LANDING_STEP_MS; t <= life; t += LANDING_STEP_MS) {
    const s = t / 1000, x = x0 + vx * s, y = y0 + vy * s + (DEBRIS_GRAVITY * s * s) / 2;
    if (vy + DEBRIS_GRAVITY * s > 0 && solid(after, Math.floor(x / ART_PER_CELL), Math.floor(y / ART_PER_CELL))) {
      const before = (t - LANDING_STEP_MS) / 1000;
      return { at: t - LANDING_STEP_MS, x: px, y: py, vy: vy + DEBRIS_GRAVITY * before };
    }
    px = x; py = y;
  }
  return null;
};

/** 地面に着く破片に跳ね返りを付ける。跳ねたら縦は 35%、横は半分の速さで跳ね、落ちてきたところで消える */
const addBounce = (b: ParticleBatch, bounce: Bounce, i: number, after: TerrainMask): void => {
  const landing = landingOf(after, b.x0[i]!, b.y0[i]!, b.vx[i]!, b.vy[i]!, b.life[i]!);
  if (!landing) return;
  const bvy = -Math.abs(landing.vy) * DEBRIS_RESTITUTION;
  bounce.hitAt[i] = landing.at; bounce.hitX[i] = landing.x; bounce.hitY[i] = landing.y;
  bounce.bvx[i] = b.vx[i]! * DEBRIS_FRICTION; bounce.bvy[i] = bvy;
  b.life[i] = landing.at + Math.min((2000 * Math.abs(bvy)) / DEBRIS_GRAVITY, DEBRIS_HOP_MAX_MS) + 30;
};

/** 削れた地形の破片のまとまり。削れていなければ 0 粒 */
export const terrainDebris = (input: DebrisInput): ParticleBatch => {
  const rect = removedRect(input.before, input.after, input.op);
  const table = rampTable(input.heat ?? HEAT);
  if (!rect) return allocBatch(0, { ramps: table.ramps, gravity: DEBRIS_GRAVITY, drag: 0 });
  const { size, keep } = densityOf(removedTexels(input.before, input.after, rect), input.budget ?? DEBRIS_BUDGET);
  const units = collectUnits(input, rect, size).filter((u) => {
    const h = unit(hash32(input.seed, PURPOSE, u.x, u.y));
    return (keep >= 1 || h < keep) && (!GRASS.has(u.color) || unit(hash32(input.seed, PURPOSE + 100, u.x, u.y)) < DEBRIS_GRASS_KEEP);
  });
  const b = allocBatch(units.length, { ramps: table.ramps, gravity: DEBRIS_GRAVITY, drag: 0 }), bounce = allocBounce(units.length);
  const cx = (input.op.cx + 0.5) * ART_PER_CELL, cy = (input.op.cy + 0.5) * ART_PER_CELL, r = Math.max(1, input.op.radius * ART_PER_CELL);
  units.forEach((u, i) => {
    const h = hash32(input.seed, PURPOSE, u.x, u.y);
    const dx = u.x + size / 2 - cx, dy = u.y + size / 2 - cy, d = Math.hypot(dx, dy);
    // 爆心より下のドットも、地中へは飛ばさず上へ噴き上げる。上下の向きは上にそろえる
    const angle = d > 0 ? Math.atan2(-Math.abs(dy), dx) : -unit(hash32(h, 1)) * Math.PI;
    const power = input.power ?? 1;
    const speed = power * (DEBRIS_EDGE_SPEED + DEBRIS_CORE_SPEED * Math.max(0, 1 - d / r)) * (1 + DEBRIS_SPREAD * (2 * unit(hash32(h, 2)) - 1));
    const heated = d < r && unit(hash32(h, 3)) < DEBRIS_HEAT_SHARE;
    b.x0[i] = u.x;
    b.y0[i] = u.y;
    b.vx[i] = Math.cos(angle) * speed;
    b.vy[i] = Math.sin(angle) * speed - DEBRIS_LIFT * power;
    // 上へ飛んで生まれた高さへ戻るまで 2|vy|/g 秒。そこから DEBRIS_AFTER_RETURN_MS だけ落として消す
    b.life[i] = Math.min(DEBRIS_LIFE_MS, (2000 * Math.abs(b.vy[i]!)) / DEBRIS_GRAVITY + DEBRIS_AFTER_RETURN_MS);
    b.ramp[i] = table.of(u.color, heated);
    b.step[i] = heated ? DEBRIS_HEAT_STEP_MS : 0;
    b.size[i] = size;
    b.fade[i] = unit(hash32(h, 4));
    if (unit(hash32(h, 5)) < DEBRIS_BOUNCE_SHARE) addBounce(b, bounce, i, input.after);
  });
  return { ...b, bounce };
};
