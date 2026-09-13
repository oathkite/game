import type { WeaponId } from "@game/protocol";
import { weaponPixels } from "@/game/weaponPixels";
export const WeaponIcon = ({ weapon }: { readonly weapon: WeaponId }) =>
  <svg viewBox="-1 -1 14 10" aria-hidden="true" shapeRendering="crispEdges">
    {weaponPixels(weapon).map(p => <rect key={`${p.x}/${p.y}`} x={p.x} y={p.y} width="1" height="1" fill={p.color} />)}
  </svg>;
