import type { WeaponId } from "@game/protocol";
import { weaponPixels, WEAPON_PIXEL_COLORS } from "@/game/weaponPixels";

const burstPatterns = {
  laser: ["............","............","............","............","............",".1111111111.",".2222222222.",".1111111111.","............","............","............","............"],
  triple: [".11111......","1222211.....",".13331......","............","...11111....","..1222211...","...13331....","............",".....11111..","....1222211.",".....13331..","............"],
  multiple: [".1...1...1..","121.121.121.",".3...3...3..","............",".1...1...1..","121.121.121.",".3...3...3..","............",".1...1...1..","121.121.121.",".3...3...3..","............"],
} as const;
export const weaponIconPixels = (weapon: WeaponId) => weapon === "triple" || weapon === "multiple" || weapon === "laser"
  ? burstPatterns[weapon].flatMap((row, y) => [...row].flatMap((value, x) => value === "." ? [] : [{ x, y, color: WEAPON_PIXEL_COLORS[value as keyof typeof WEAPON_PIXEL_COLORS] }]))
  : weapon === "digger" ? weaponPixels(weapon)
  : weaponPixels(weapon).map(pixel => ({ ...pixel, y: pixel.y + 2 }));
export const WeaponIcon = ({ weapon }: { readonly weapon: WeaponId }) =>
  <svg viewBox="-1 -1 14 14" aria-hidden="true" shapeRendering="crispEdges">
    {weaponIconPixels(weapon).map(p => <rect key={`${p.x}/${p.y}`} x={p.x} y={p.y} width="1" height="1" fill={p.color} />)}
  </svg>;
