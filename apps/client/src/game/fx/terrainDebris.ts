import type { TerrainOp } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { PALETTE } from "../palette";
import { ART_PER_CELL, getPixel, TRANSPARENT, type PixelGrid, type Rect } from "../pixelGrid";
import { hash32, unit } from "./hash";
import { allocBatch, type ParticleBatch } from "./particles";

// 削れた地形の破片。設計書 41.5 の D1。
// 削る前と後の mask で変わったセルの texel を、削る前の地形の色のまま爆心から外へ散らし、重さで画面の下へ落とす。
// 地形とは当たらない。見た目だけで、mask と当たり判定は変えない。

/** 破片が消えるまで（ms）。画面の下端を越えた粒はそれより前に描かなくなる */
export const DEBRIS_LIFE_MS = 2500;
/** 重力（art px/秒²） */
export const DEBRIS_GRAVITY = 420;
/** 爆風の縁の速さと、爆心で足す速さ（art px/秒） */
export const DEBRIS_EDGE_SPEED = 60;
export const DEBRIS_CORE_SPEED = 200;
/** 速さのばらつき（±） */
export const DEBRIS_SPREAD = 0.25;
/** 上向きに足す速さ（art px/秒） */
export const DEBRIS_LIFT = 120;
/** 熱で光らせる割合。爆心から半径の半分以内のドットだけ */
export const DEBRIS_HEAT_SHARE = 0.25;
/** 熱の色の段を進める ms。黄、橙、赤の 3 段で約 400 ms */
export const DEBRIS_HEAT_STEP_MS = 133;
/** 1 回の着弾で出す粒の上限。超えたら 2 × 2 art px の塊にまとめ、それでも超えたら間引く（TBD-40） */
export const DEBRIS_BUDGET = 16384;

const HEAT: readonly number[] = [PALETTE.fire2, PALETTE.fire3, PALETTE.fire5];

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
const rampTable = () => {
  const ramps: (readonly number[])[] = [], index = new Map<string, number>();
  return {
    ramps,
    of: (color: number, heated: boolean): number => {
      const key = `${heated ? "h" : "c"}${color}`, found = index.get(key);
      if (found !== undefined) return found;
      ramps.push(heated ? [...HEAT, color] : [color]);
      index.set(key, ramps.length - 1);
      return ramps.length - 1;
    },
  };
};

/** 削れた地形の破片のまとまり。削れていなければ 0 粒 */
export const terrainDebris = (input: DebrisInput): ParticleBatch => {
  const rect = removedRect(input.before, input.after, input.op);
  const table = rampTable();
  if (!rect) return allocBatch(0, { ramps: table.ramps, gravity: DEBRIS_GRAVITY, drag: 0 });
  const { size, keep } = densityOf(removedTexels(input.before, input.after, rect), input.budget ?? DEBRIS_BUDGET);
  const units = collectUnits(input, rect, size).filter((u) => keep >= 1 || unit(hash32(input.seed, PURPOSE, u.x, u.y)) < keep);
  const b = allocBatch(units.length, { ramps: table.ramps, gravity: DEBRIS_GRAVITY, drag: 0 });
  const cx = (input.op.cx + 0.5) * ART_PER_CELL, cy = (input.op.cy + 0.5) * ART_PER_CELL, r = Math.max(1, input.op.radius * ART_PER_CELL);
  units.forEach((u, i) => {
    const h = hash32(input.seed, PURPOSE, u.x, u.y);
    const dx = u.x + size / 2 - cx, dy = u.y + size / 2 - cy, d = Math.hypot(dx, dy);
    // 爆心より下のドットも、地中へは飛ばさず上へ噴き上げる。上下の向きは上にそろえる
    const angle = d > 0 ? Math.atan2(-Math.abs(dy), dx) : -unit(hash32(h, 1)) * Math.PI;
    const speed = (DEBRIS_EDGE_SPEED + DEBRIS_CORE_SPEED * Math.max(0, 1 - d / r)) * (1 + DEBRIS_SPREAD * (2 * unit(hash32(h, 2)) - 1));
    const heated = d < r / 2 && unit(hash32(h, 3)) < DEBRIS_HEAT_SHARE;
    b.x0[i] = u.x;
    b.y0[i] = u.y;
    b.vx[i] = Math.cos(angle) * speed;
    b.vy[i] = Math.sin(angle) * speed - DEBRIS_LIFT;
    b.life[i] = DEBRIS_LIFE_MS;
    b.ramp[i] = table.of(u.color, heated);
    b.step[i] = heated ? DEBRIS_HEAT_STEP_MS : 0;
    b.size[i] = size;
    b.fade[i] = unit(hash32(h, 4));
  });
  return b;
};
