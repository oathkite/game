type Point = { readonly x: number; readonly y: number };
import { openingDuration } from "@game/protocol/v2-lab";
export { openingDuration };
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
/** Overview, first actor, turn order, first actor, START. Sampling allows reconnects. */
export const openingPose = (elapsed: number, players: readonly Point[], map: { width: number; height: number }, viewport: { width: number; height: number; scale: number }, reduced = false) => {
  const overview = { x: map.width / 2, y: map.height / 2 };
  const first = players[0] ?? overview;
  const points = [...players, first].map(p => ({ x: p.x, y: p.y - 6 }));
  const travelEnd = 900 + points.length * 700;
  const done = elapsed >= openingDuration(players.length);
  const start = elapsed >= travelEnd && !done;
  const fit = Math.min(viewport.width / map.width, viewport.height / map.height);
  if (reduced || elapsed >= travelEnd) return { center: points[0] ?? first, scale: viewport.scale, start, done };
  if (elapsed < 900) return { center: overview, scale: fit, start, done };
  const step = Math.min(points.length - 1, Math.floor((elapsed - 900) / 700));
  const from = step === 0 ? overview : points[step - 1]!;
  const to = points[step]!;
  const t = ease(Math.min(1, (elapsed - 900 - step * 700) / 550));
  return { center: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
    scale: step === 0 ? fit + (viewport.scale - fit) * t : viewport.scale, start, done };
};

/** 地形を上から描き出す長さ。開幕の俯瞰（900 ms）の中に収める。設計書 38 の L3 */
export const REVEAL_MS = 600;
/** 描き出しの段数。ドットの手触りを保つため連続にしない */
export const REVEAL_STEPS = 12;
/** 開幕から elapsed ミリ秒後に見せる地形の行数。描き終えたら null（全体）。動きを減らす設定では描き出さない */
export const revealRowsAt = (elapsed: number, height: number, reduced = false): number | null => {
  if (reduced || elapsed >= REVEAL_MS) return null;
  const step = Math.floor((Math.max(0, elapsed) / REVEAL_MS) * REVEAL_STEPS) + 1;
  return Math.floor((height * step) / REVEAL_STEPS);
};
