// オンラインの再生の長さのうち、飛翔の終わりから次の手番までの部分。設計書 41.8。
// サーバー（session.ts）と、飛翔の終わりを逆算するクライアント（labReplay.ts など）が同じ関数を使う。値がずれると弾の速さと落下の時刻が崩れる。

/** 飛翔と落下の上限。ダブルシュートは 2 発ぶんの 2 倍にする（設計書 42.7） */
export const REPLAY_MAX_MS = 8000;
/** 飛翔の終わりから落下までの最短の長さ。上限 REPLAY_MAX_MS の中に含める */
export const REPLAY_SETTLE_MS = 300;
/** ダメージがあったときに足す長さ。HP バーの減りと数字を読ませる */
export const DAMAGE_HOLD_MS = 1300;
/** 着弾したがダメージがなかったときに足す長さ。火球と削れた地形の破片を見せる */
export const IMPACT_HOLD_MS = 700;
/** テレポートで着地点へ移れたときに足す長さ。光の柱が立って機体が現れ、柱が消えるまでを見せる（設計書 42.3） */
export const TELEPORT_HOLD_MS = 900;

/** 着弾の列。ダメージはオンラインの { playerId, amount } の列か、練習の席ごとの数の列 */
export type HoldImpact = { readonly damage: readonly (number | { readonly amount: number })[] };

const amountOf = (d: number | { readonly amount: number }): number => (typeof d === "number" ? d : d.amount);

/** 着弾の列から、REPLAY_MAX_MS の上限の外に足す長さを決める。着弾が 1 つでもあれば着弾あり。teleported はテレポートで着地点へ移れた射撃 */
export const replayHoldMs = (impacts: readonly HoldImpact[], teleported = false): number => {
  if (impacts.some(i => i.damage.some(d => amountOf(d) > 0))) return DAMAGE_HOLD_MS;
  if (teleported) return TELEPORT_HOLD_MS;
  return impacts.length > 0 ? IMPACT_HOLD_MS : 0;
};

/** 飛翔の終わりから次の手番までの長さ */
export const replayTailMs = (impacts: readonly HoldImpact[], teleported = false): number => REPLAY_SETTLE_MS + replayHoldMs(impacts, teleported);
