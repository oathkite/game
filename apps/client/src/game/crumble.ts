import type { CellPoint, TerrainOp } from "@game/protocol";
import type { TerrainMask } from "@game/sim";

// 地形の縁が崩れる演出。設計書 38 の E2。
// 削る前と後の mask の差のうち、えぐれた縁に当たるセルを白いかけらにして落とす。見た目だけで、mask は変えない。

/** かけらが落ちて消えるまで */
export const CRUMBLE_MS = 400;
/** かけらの数の上限。大きな爆風でも描く量を抑える */
export const CRUMBLE_LIMIT = 24;
/** かけらの重さ（セル/秒²） */
const CRUMBLE_GRAVITY = 220;
/** かけらの初速の上向き成分（セル/秒）。3 種を順に割り当てる */
const CRUMBLE_LIFT: readonly number[] = [20, 28, 36];
/** かけらの横の初速（セル/秒）。中心から外へ */
const CRUMBLE_SPREAD = 14;

const solid = (mask: TerrainMask, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.cells[y * mask.width + x] === 1;

/** 削られたセルのうち、爆風の縁（半径から 1.5 セル以内）にあるもの。上限を超えたら等間隔に間引く */
export const rimCells = (before: TerrainMask, after: TerrainMask, op: TerrainOp, limit: number = CRUMBLE_LIMIT): readonly CellPoint[] => {
  const inner = Math.max(0, op.radius - 1.5) ** 2, outer = op.radius * op.radius;
  const found: CellPoint[] = [];
  for (let y = op.cy - op.radius; y <= op.cy + op.radius; y++) {
    for (let x = op.cx - op.radius; x <= op.cx + op.radius; x++) {
      const d2 = (x - op.cx) ** 2 + (y - op.cy) ** 2;
      if (d2 >= inner && d2 <= outer && solid(before, x, y) && !solid(after, x, y)) found.push({ x, y });
    }
  }
  if (found.length <= limit) return found;
  return Array.from({ length: limit }, (_, i) => found[Math.floor((i * found.length) / limit)]!);
};

/** 削れてから t ミリ秒後のかけらの位置。外へ跳ねてから落ちる。過ぎたら空 */
export const crumbleAt = (t: number, cells: readonly CellPoint[], center: CellPoint): readonly CellPoint[] => {
  if (t < 0 || t >= CRUMBLE_MS) return [];
  const sec = t / 1000;
  return cells.map((c, i) => {
    const side = Math.sign(c.x - center.x);
    const lift = CRUMBLE_LIFT[i % CRUMBLE_LIFT.length] ?? 20;
    return {
      x: c.x + Math.trunc(side * CRUMBLE_SPREAD * sec),
      y: c.y + Math.trunc(-lift * sec + (CRUMBLE_GRAVITY * sec * sec) / 2),
    };
  });
};
