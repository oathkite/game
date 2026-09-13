/** Same integer pixel silhouette for the lobby SVG and the world renderer. */
export const TANK_PIXELS = [
  { x:12, y:35, w:52, h:18, part:"body" }, { x:8, y:39, w:60, h:10, part:"body" },
  { x:20, y:27, w:36, h:8, part:"body" }, { x:28, y:19, w:20, h:8, part:"turret" },
] as const;
export const treadPixels = (distance: number) => {
  const shift = ((Math.floor(distance * 8) % 12) + 12) % 12;
  return [-1,0,1,2,3,4].map(i => ({ x: 16 + i * 12 - shift, y: 41, w: 8, h: 6 }))
    .map(p => ({ ...p, x: Math.max(12, p.x), w: Math.max(0, Math.min(64, p.x + p.w) - Math.max(12, p.x)) }))
    .filter(p => p.w > 0);
};
