import { blastFrameAt, CARVE_AT_MS, debrisAt, flashMsOf, invertCells, invertOn, shakeOffsetAt, type HpBar, type Offset } from "@/game/hitFeedback";
import { hash32, hashText } from "@/game/fx/hash";
import type { ProjectileView } from "@/game/projectileView";
import type { EdgePoint, RendererEffects } from "@/game/renderer";
import type { presentLabReplay } from "@/networkLab/labReplay";
import type { TerrainOp } from "@game/protocol";
import { carve, type TerrainMask } from "@game/sim";

// オンライン対戦の着弾の見せ方。設計書 38 の E1。練習（game/replay.ts）と同じ hitFeedback の時間の流れで描く。
// 着弾の時刻はサーバーが決め、labReplay.ts が clock に換算する。ここは描くだけ。

type Presentation = ReturnType<typeof presentLabReplay>;

/** 機体の被弾の姿。白くなる区間は爆風が最大になってからダメージの段階で決まる長さ */
export const labTankHit = (presentation: Presentation, playerId: string): { readonly flash: boolean; readonly bar: HpBar | undefined } => ({
  flash: presentation.effects.some(effect => effect.damages.some(d => d.playerId === playerId && effect.clock >= CARVE_AT_MS && effect.clock < CARVE_AT_MS + flashMsOf(d.amount))),
  bar: presentation.hpBars[playerId],
});

/** 爆風、破片、反転、外れの印、軌跡。毎フレーム clear した後に呼ぶ */
export const drawLabImpacts = (view: ProjectileView, presentation: Presentation, mask: TerrainMask, reduced: boolean): void => {
  for (const effect of presentation.effects) {
    const blast = blastFrameAt(effect.clock, effect.radius);
    // 動きを減らす設定では明滅させず、熱い火球のまま見せる（設計書 40.9）
    view.setBlast(effect.key, blast ? effect.cx : null, effect.cy, blast?.radius ?? 0, (blast?.on ?? false) || reduced, blast?.ring ?? false);
    view.setDebris(effect.key, debrisAt(effect.clock - CARVE_AT_MS, { x: effect.cx, y: effect.cy }, effect.radius));
    view.setInvert(effect.key, invertOn(effect.clock, effect.damage, reduced) ? invertCells(mask, effect.cx, effect.cy, effect.radius) : null);
  }
  for (const miss of presentation.misses) view.setMissMark(miss.key, miss.x, miss.y, miss.on);
  presentation.trails.forEach((dots, index) => view.setTrail(index, dots));
};

/** 画面揺れ。いちばん新しい被弾の着弾で決める */
export const labShake = (presentation: Presentation, reduced: boolean): Offset => {
  const hit = [...presentation.effects].reverse().find(effect => effect.damage > 0);
  return reduced || !hit ? { dx: 0, dy: 0 } : shakeOffsetAt(hit.clock - CARVE_AT_MS, [hit.damage, 0]);
};

/** 被弾している機体の位置。画面の外なら端に印を出す */
export const labEdgePoints = (presentation: Presentation, players: readonly { readonly playerId: string; readonly x: number; readonly y: number }[], colorOf: (playerId: string) => number): readonly EdgePoint[] => {
  const hit = new Set(presentation.effects.flatMap(effect => effect.damages.map(d => d.playerId)));
  return players.filter(p => hit.has(p.playerId)).map(p => ({ x: p.x, y: p.y - 4, color: colorOf(p.playerId) }));
};

/** 一度に増えた削りがこれより多ければ、再接続などでまとめて届いたとみなして破片を出さない */
const DEBRIS_BATCH_LIMIT = 8;

/** 削れた地形の破片（設計書 41.5 の D1）。地形が増えた瞬間に、増えた削りを順に当てた mask の差から出す。
 * ハッシュの入力は対戦の識別子と、対戦の中での削りの通し番号（41.3）。どの画面でも同じ散り方になる */
export const emitLabDebris = (effects: Pick<RendererEffects, "terrainDebris">, before: TerrainMask, ops: readonly TerrainOp[], firstIndex: number, matchId: string): void => {
  if (ops.length === 0 || ops.length > DEBRIS_BATCH_LIMIT) return;
  const match = hashText(matchId);
  let mask = before;
  ops.forEach((op, i) => {
    const after = carve(mask, op);
    effects.terrainDebris(mask, after, op, hash32(match, firstIndex + i));
    mask = after;
  });
};
