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
